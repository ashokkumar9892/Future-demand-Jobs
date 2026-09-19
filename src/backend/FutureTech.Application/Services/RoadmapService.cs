using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public record RoadmapPhaseDto(
    int PhaseNumber, string Title, string Slug, string Summary, int EstimatedHours,
    int LessonCount, int CompletedLessons, int ProgressPercent, string Status,
    string EstimatedStartMonth, string EstimatedEndMonth);

public record RoadmapDto(
    string CurrentRole,
    string TargetCareerTitle,
    string TargetCareerSlug,
    string TargetSalaryRange,
    IReadOnlyList<LadderStageDto> Ladder,
    IReadOnlyList<RoadmapPhaseDto> Phases,
    TrainingEstimateDto Estimate,
    int OverallProgressPercent,
    string Disclaimer);

public interface IRoadmapService
{
    Task<RoadmapDto> GetAsync(Guid? careerPathId, CancellationToken ct = default);
}

public class RoadmapService(IAppDbContext db, ICurrentUser currentUser, IDateTimeProvider clock) : IRoadmapService
{
    public async Task<RoadmapDto> GetAsync(Guid? careerPathId, CancellationToken ct = default)
    {
        var userId = currentUser.UserId;
        var profile = userId is { } uid
            ? await db.StudyProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == uid, ct)
            : null;

        var targetId = careerPathId ?? profile?.TargetCareerPathId;
        var career = targetId is { } id
            ? await db.CareerPaths.AsNoTracking().Include(c => c.LadderStages).FirstOrDefaultAsync(c => c.Id == id, ct)
            : await db.CareerPaths.AsNoTracking().Include(c => c.LadderStages)
                .OrderBy(c => c.Rank).FirstOrDefaultAsync(c => c.IsPrimaryRecommended, ct);
        if (career is null) throw AppException.NotFound("Career path");

        var trackMode = profile?.TrackMode ?? TrackMode.Balanced;
        var weekly = profile?.WeeklyHours ?? 12;
        var studyDays = profile is null ? 7 : Math.Max(1, Text.Csv(profile.StudyDays).Count);

        var courses = await db.Courses.AsNoTracking()
            .Where(c => c.CareerPathId == career.Id)
            .OrderBy(c => c.Order)
            .Select(c => new
            {
                c.PhaseNumber, c.Title, c.Slug, c.Summary, c.EstimatedHours,
                LessonIds = c.Modules.SelectMany(m => m.Lessons).Select(l => l.Id).ToList()
            })
            .ToListAsync(ct);

        var completed = userId is { } uid2
            ? (await db.LessonProgress.AsNoTracking()
                .Where(p => p.UserId == uid2 && p.Status == ProgressStatus.Completed)
                .Select(p => p.LessonId).ToListAsync(ct)).ToHashSet()
            : [];

        var phases = new List<RoadmapPhaseDto>();
        var cursor = clock.Today;
        var totalHours = 0;
        var completedHours = 0d;

        foreach (var course in courses)
        {
            var hours = StudyMath.HoursForTrack(course.EstimatedHours, trackMode);
            totalHours += hours;

            var done = course.LessonIds.Count(completed.Contains);
            var percent = course.LessonIds.Count == 0 ? 0 : (int)Math.Round(done * 100.0 / course.LessonIds.Count);
            completedHours += hours * (percent / 100.0);

            var status = percent switch { 100 => "Completed", > 0 => "InProgress", _ => "NotStarted" };

            // Remaining phases are laid out end to end at the learner's pace, so
            // the roadmap shows when each phase realistically lands.
            var remainingHours = hours * (1 - percent / 100.0);
            var start = cursor;
            var weeks = StudyMath.Weeks(remainingHours, weekly);
            var end = remainingHours <= 0 ? cursor : StudyMath.CompletionDate(cursor, weeks);
            cursor = end;

            phases.Add(new RoadmapPhaseDto(
                course.PhaseNumber, course.Title, course.Slug, course.Summary, hours,
                course.LessonIds.Count, done, percent, status,
                StudyMath.MonthLabel(start), StudyMath.MonthLabel(end)));
        }

        var remaining = Math.Max(0, totalHours - (int)Math.Round(completedHours));

        return new RoadmapDto(
            ".NET / Angular / SQL Server / Azure & AWS Full Stack Developer",
            career.Title,
            career.Slug,
            Text.SalaryRange(career.SalaryMinUsd, career.SalaryMaxUsd),
            career.LadderStages.OrderBy(s => s.StageOrder).Select(s => new LadderStageDto(
                s.StageOrder, s.Title, s.RoleTitle, s.Description, s.SalaryMinUsd, s.SalaryMaxUsd,
                s.DurationMonths, Text.Lines(s.Milestones), s.IsCurrentPosition)).ToList(),
            phases,
            StudyMath.Estimate(remaining == 0 ? totalHours : remaining, weekly, studyDays, clock.Today, trackMode),
            totalHours == 0 ? 0 : (int)Math.Round(completedHours * 100 / totalHours),
            Disclaimers.Estimate);
    }
}
