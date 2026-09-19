using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IStudyPlanGenerator
{
    /// <summary>
    /// Rebuilds the plan for a window. Days already marked complete are left
    /// alone, so regenerating never rewrites history.
    /// </summary>
    Task GenerateAsync(Guid userId, DateOnly from, int weeks, CancellationToken ct = default);
}

/// <summary>
/// The single implementation of plan generation. It takes an explicit user id
/// rather than reading the current principal, so the seeder can build a demo
/// learner's calendar with exactly the same logic the application uses.
/// </summary>
public class StudyPlanGenerator(IAppDbContext db) : IStudyPlanGenerator
{
    /// <summary>
    /// The weekly rhythm from the programme design. Weights are relative shares of
    /// that day's available minutes, so the same shape works for 1.5h and 4h days.
    /// </summary>
    private static readonly Dictionary<DayOfWeek, (StudyActivityType Type, double Weight)[]> DayTemplate = new()
    {
        [DayOfWeek.Monday] = [(StudyActivityType.Video, 1), (StudyActivityType.Reading, 1), (StudyActivityType.Practice, 1)],
        [DayOfWeek.Tuesday] = [(StudyActivityType.Video, 1), (StudyActivityType.Coding, 1.5), (StudyActivityType.Quiz, 0.5)],
        [DayOfWeek.Wednesday] = [(StudyActivityType.Reading, 1), (StudyActivityType.Architecture, 1)],
        [DayOfWeek.Thursday] = [(StudyActivityType.Video, 1), (StudyActivityType.Coding, 2)],
        [DayOfWeek.Friday] = [(StudyActivityType.Review, 1), (StudyActivityType.Quiz, 1), (StudyActivityType.Interview, 1)],
        [DayOfWeek.Saturday] = [(StudyActivityType.Project, 1)],
        [DayOfWeek.Sunday] = [(StudyActivityType.Project, 2), (StudyActivityType.Assessment, 1)]
    };

    public async Task GenerateAsync(Guid userId, DateOnly from, int weeks, CancellationToken ct = default)
    {
        var profile = await db.StudyProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);
        if (profile is null) return;

        var studyDays = Text.Csv(profile.StudyDays)
            .Select(d => Enum.TryParse<DayOfWeek>(d, true, out var dow) ? dow : (DayOfWeek?)null)
            .Where(d => d is not null).Select(d => d!.Value).ToHashSet();
        if (studyDays.Count == 0) studyDays = Enum.GetValues<DayOfWeek>().ToHashSet();

        var until = from.AddDays(weeks * 7 - 1);

        // Only future/unstarted days are rebuilt: completed history is preserved.
        var stale = await db.StudyPlanDays.Include(d => d.Items)
            .Where(d => d.UserId == userId && d.OnDate >= from && d.OnDate <= until && d.Status != PlanStatus.Completed)
            .ToListAsync(ct);
        db.StudyPlanItems.RemoveRange(stale.SelectMany(d => d.Items));
        db.StudyPlanDays.RemoveRange(stale);
        await db.SaveChangesAsync(ct);

        var queues = await BuildContentQueuesAsync(userId, profile, ct);
        var existingDates = (await db.StudyPlanDays.AsNoTracking()
            .Where(d => d.UserId == userId && d.OnDate >= from && d.OnDate <= until)
            .Select(d => d.OnDate).ToListAsync(ct)).ToHashSet();

        for (var date = from; date <= until; date = date.AddDays(1))
        {
            if (!studyDays.Contains(date.DayOfWeek) || existingDates.Contains(date)) continue;

            var hours = date.DayOfWeek switch
            {
                DayOfWeek.Saturday => profile.SaturdayHours,
                DayOfWeek.Sunday => profile.SundayHours,
                _ => profile.WeekdayHours
            };
            var targetMinutes = (int)Math.Round(hours * 60);
            if (targetMinutes < 15) continue;

            var day = new StudyPlanDay
            {
                UserId = userId,
                OnDate = date,
                TargetMinutes = targetMinutes,
                Status = PlanStatus.Scheduled
            };

            var template = DayTemplate[date.DayOfWeek];
            var totalWeight = template.Sum(t => t.Weight);
            var order = 1;
            var allocated = 0;

            for (var i = 0; i < template.Length; i++)
            {
                var (type, weight) = template[i];
                var minutes = i == template.Length - 1
                    ? targetMinutes - allocated
                    : Math.Max(15, (int)Math.Round(targetMinutes * weight / totalWeight / 5) * 5);
                if (minutes < 10) continue;
                allocated += minutes;

                var item = queues.Next(type, minutes, order);
                if (item is null) continue;
                day.Items.Add(item);
                order++;
            }

            if (day.Items.Count == 0) continue;
            db.StudyPlanDays.Add(day);
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task<ContentQueues> BuildContentQueuesAsync(Guid userId, StudyProfile profile, CancellationToken ct)
    {
        var careerId = profile.TargetCareerPathId;

        var completedLessons = (await db.LessonProgress.AsNoTracking()
            .Where(p => p.UserId == userId && p.Status == ProgressStatus.Completed)
            .Select(p => p.LessonId).ToListAsync(ct)).ToHashSet();

        var lessons = await db.Lessons.AsNoTracking()
            .Where(l => careerId == null || l.Module!.Course!.CareerPathId == careerId)
            .Where(l => l.MinimumTrack <= profile.TrackMode)
            .OrderBy(l => l.Module!.Course!.Order).ThenBy(l => l.Module!.Order).ThenBy(l => l.Order)
            .Select(l => new ContentRef(l.Id, l.Title, l.Slug))
            .ToListAsync(ct);
        lessons = lessons.Where(l => !completedLessons.Contains(l.Id)).ToList();

        var attemptedPractice = (await db.PracticeAttempts.AsNoTracking()
            .Where(a => a.UserId == userId)
            .Select(a => a.PracticeQuestionId).Distinct().ToListAsync(ct)).ToHashSet();

        var practice = (await db.PracticeQuestions.AsNoTracking()
            .Where(q => careerId == null || q.CareerPathId == careerId || q.CareerPathId == null)
            .OrderBy(q => q.Mode).ThenBy(q => q.Category)
            .Select(q => new ContentRef(q.Id, q.Prompt, q.Id.ToString()))
            .ToListAsync(ct)).Where(q => !attemptedPractice.Contains(q.Id)).ToList();

        var coding = await db.CodingExercises.AsNoTracking()
            .OrderBy(e => e.Difficulty).ThenBy(e => e.Category)
            .Select(e => new ContentRef(e.Id, e.Title, e.Slug))
            .ToListAsync(ct);

        var architecture = await db.ArchitectureChallenges.AsNoTracking()
            .OrderBy(a => a.Difficulty)
            .Select(a => new ContentRef(a.Id, a.Title, a.Slug))
            .ToListAsync(ct);

        var interview = await db.InterviewQuestions.AsNoTracking()
            .OrderBy(q => q.Category).ThenBy(q => q.Difficulty)
            .Select(q => new ContentRef(q.Id, q.Question, q.Id.ToString()))
            .ToListAsync(ct);

        var projects = await db.Projects.AsNoTracking()
            .OrderBy(p => p.Order)
            .Select(p => new ContentRef(p.Id, p.Title, p.Slug))
            .ToListAsync(ct);

        return new ContentQueues(lessons, practice, coding, architecture, interview, projects);
    }

    /// <summary>Cycles curriculum content into concrete, deep-linked plan items.</summary>
    private sealed class ContentQueues(
        List<ContentRef> lessons, List<ContentRef> practice, List<ContentRef> coding,
        List<ContentRef> architecture, List<ContentRef> interview, List<ContentRef> projects)
    {
        private int _lesson, _practice, _coding, _architecture, _interview, _project;
        private ContentRef? _lastLesson;

        public StudyPlanItem? Next(StudyActivityType type, int minutes, int order)
        {
            ContentRef? item;
            string refType, deepLink, prefix;

            switch (type)
            {
                case StudyActivityType.Video:
                case StudyActivityType.Reading:
                case StudyActivityType.Review:
                    item = Take(lessons, ref _lesson);
                    if (item is null) return null;
                    _lastLesson = item;
                    refType = "lesson";
                    deepLink = $"/learn/{item.Slug}";
                    prefix = type == StudyActivityType.Video ? "Watch" : type == StudyActivityType.Review ? "Review" : "Read";
                    break;

                case StudyActivityType.Quiz:
                    item = _lastLesson ?? Peek(lessons, _lesson);
                    if (item is null) return null;
                    refType = "quiz";
                    deepLink = $"/learn/{item.Slug}?tab=quiz";
                    prefix = "Quiz";
                    break;

                case StudyActivityType.Practice:
                    item = Take(practice, ref _practice);
                    if (item is null) return null;
                    refType = "practice";
                    deepLink = $"/practice/{item.Id}";
                    prefix = "Practice";
                    break;

                case StudyActivityType.Coding:
                    item = Take(coding, ref _coding);
                    if (item is null) return null;
                    refType = "coding";
                    deepLink = $"/coding-labs/{item.Slug}";
                    prefix = "Lab";
                    break;

                case StudyActivityType.Architecture:
                    item = Take(architecture, ref _architecture);
                    if (item is null) return null;
                    refType = "architecture";
                    deepLink = $"/architecture-lab/{item.Id}";
                    prefix = "Architecture";
                    break;

                case StudyActivityType.Interview:
                    item = Take(interview, ref _interview);
                    if (item is null) return null;
                    refType = "interview";
                    deepLink = $"/interview-prep?question={item.Id}";
                    prefix = "Interview";
                    break;

                case StudyActivityType.Project:
                    item = Take(projects, ref _project);
                    if (item is null) return null;
                    refType = "project";
                    deepLink = $"/projects/{item.Slug}";
                    prefix = "Build";
                    break;

                case StudyActivityType.Assessment:
                    return new StudyPlanItem
                    {
                        Order = order,
                        ActivityType = type,
                        Title = "Weekly assessment: readiness check",
                        Minutes = minutes,
                        RefType = "assessment",
                        DeepLink = "/job-readiness",
                        Status = PlanStatus.Scheduled
                    };

                default:
                    return null;
            }

            return new StudyPlanItem
            {
                Order = order,
                ActivityType = type,
                Title = Truncate($"{prefix}: {item.Title}", 120),
                Minutes = minutes,
                RefType = refType,
                RefId = item.Id,
                DeepLink = deepLink,
                Status = PlanStatus.Scheduled
            };
        }

        // Content wraps around rather than running dry, so a long plan window
        // always has something scheduled even after the backlog is exhausted.
        private static ContentRef? Take(List<ContentRef> source, ref int cursor)
        {
            if (source.Count == 0) return null;
            var item = source[cursor % source.Count];
            cursor++;
            return item;
        }

        private static ContentRef? Peek(List<ContentRef> source, int cursor) =>
            source.Count == 0 ? null : source[cursor % source.Count];

        private static string Truncate(string value, int max) =>
            value.Length <= max ? value : value[..(max - 1)] + "…";
    }

    private sealed record ContentRef(Guid Id, string Title, string Slug);
}
