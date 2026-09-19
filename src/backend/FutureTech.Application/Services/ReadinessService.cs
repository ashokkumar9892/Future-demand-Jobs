using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IReadinessService
{
    Task<IReadOnlyList<CareerReadinessDto>> ListAsync(CancellationToken ct = default);
    Task<CareerReadinessDto> GetAsync(string careerSlug, CancellationToken ct = default);
}

/// <summary>
/// Readiness is derived only from measured platform activity: lessons completed,
/// quiz results, scored practice and interview attempts, and finished project
/// milestones. Self-assessed skill levels are deliberately excluded so the score
/// cannot be inflated by editing the skill matrix.
/// </summary>
public class ReadinessService(IAppDbContext db, ICurrentUser currentUser) : IReadinessService
{
    private const double LessonWeight = 0.45;
    private const double AssessmentWeight = 0.35;
    private const double ProjectWeight = 0.20;

    public async Task<IReadOnlyList<CareerReadinessDto>> ListAsync(CancellationToken ct = default)
    {
        var careers = await db.CareerPaths.AsNoTracking()
            .Include(c => c.ReadinessDimensions).OrderBy(c => c.Rank).ToListAsync(ct);
        var signals = await LoadSignalsAsync(ct);
        return careers.Select(c => Compute(c, signals)).ToList();
    }

    public async Task<CareerReadinessDto> GetAsync(string careerSlug, CancellationToken ct = default)
    {
        var career = await db.CareerPaths.AsNoTracking()
            .Include(c => c.ReadinessDimensions)
            .FirstOrDefaultAsync(c => c.Slug == careerSlug, ct) ?? throw AppException.NotFound("Career path");
        return Compute(career, await LoadSignalsAsync(ct));
    }

    // ----- computation ---------------------------------------------------

    private CareerReadinessDto Compute(CareerPath career, Signals signals)
    {
        var dimensions = career.ReadinessDimensions.OrderByDescending(d => d.Weight).ToList();
        var scored = new List<ReadinessDimensionDto>();

        foreach (var dimension in dimensions)
        {
            var slugs = Text.Csv(dimension.SkillSlugs).Select(s => s.ToLowerInvariant()).ToHashSet();
            scored.Add(new ReadinessDimensionDto(dimension.Name, ScoreDimension(slugs, signals), dimension.Weight));
        }

        var totalWeight = scored.Sum(d => d.Weight);
        var overall = totalWeight <= 0
            ? 0
            : (int)Math.Round(scored.Sum(d => d.Score * d.Weight) / totalWeight);

        var verdict = overall switch
        {
            >= 80 => ReadinessVerdict.Ready,
            >= 60 => ReadinessVerdict.AlmostReady,
            _ => ReadinessVerdict.NeedsTraining
        };

        return new CareerReadinessDto(
            career.Id, career.Title, career.Slug, career.Rank, overall,
            verdict.ToString(), Text.Humanize(verdict).ToUpperInvariant(), scored, Disclaimers.Readiness);
    }

    private static int ScoreDimension(IReadOnlySet<string> slugs, Signals signals)
    {
        if (slugs.Count == 0) return 0;

        var lessons = signals.Lessons.Where(l => l.Slugs.Overlaps(slugs)).ToList();
        var lessonScore = lessons.Count == 0
            ? 0
            : lessons.Count(l => l.Completed) * 100.0 / lessons.Count;

        var quizScores = lessons.Where(l => l.QuizScore is not null).Select(l => (double)l.QuizScore!.Value).ToList();
        var practiceScores = signals.Practice.Where(p => p.Tags.Overlaps(slugs)).Select(p => (double)p.Score).ToList();
        var assessments = quizScores.Concat(practiceScores).ToList();
        var assessmentScore = assessments.Count == 0 ? 0 : assessments.Average();

        var projects = signals.Projects.Where(p => p.Slugs.Overlaps(slugs)).ToList();
        var projectScore = projects.Count == 0 ? 0 : projects.Average(p => (double)p.PercentComplete);

        // Re-weight around the components that actually have data, so a
        // dimension with no projects yet is not permanently capped at 80.
        double weighted = 0, weight = 0;
        if (lessons.Count > 0) { weighted += lessonScore * LessonWeight; weight += LessonWeight; }
        if (assessments.Count > 0) { weighted += assessmentScore * AssessmentWeight; weight += AssessmentWeight; }
        if (projects.Count > 0) { weighted += projectScore * ProjectWeight; weight += ProjectWeight; }

        return weight <= 0 ? 0 : (int)Math.Round(weighted / weight);
    }

    private async Task<Signals> LoadSignalsAsync(CancellationToken ct)
    {
        var userId = currentUser.UserId;

        var courseSkills = await db.Courses.AsNoTracking()
            .Select(c => new { c.Id, c.SkillSlugs }).ToListAsync(ct);
        var courseSlugMap = courseSkills.ToDictionary(
            c => c.Id,
            c => Text.Csv(c.SkillSlugs).Select(s => s.ToLowerInvariant()).ToHashSet());

        var lessonRows = await db.Lessons.AsNoTracking()
            .Select(l => new { l.Id, CourseId = l.Module!.CourseId }).ToListAsync(ct);

        var progress = userId is { } uid
            ? await db.LessonProgress.AsNoTracking().Where(p => p.UserId == uid)
                .ToDictionaryAsync(p => p.LessonId, p => p, ct)
            : [];

        var lessons = lessonRows.Select(l =>
        {
            progress.TryGetValue(l.Id, out var p);
            return new LessonSignal(
                courseSlugMap.TryGetValue(l.CourseId, out var slugs) ? slugs : [],
                p?.Status == ProgressStatus.Completed,
                p?.QuizScorePercent);
        }).ToList();

        var practice = new List<PracticeSignal>();
        var projects = new List<ProjectSignal>();

        if (userId is { } id)
        {
            var attempts = await db.PracticeAttempts.AsNoTracking()
                .Where(a => a.UserId == id)
                .GroupBy(a => a.PracticeQuestionId)
                .Select(g => new { QuestionId = g.Key, Best = g.Max(a => a.Score) })
                .ToListAsync(ct);
            var questionTags = await db.PracticeQuestions.AsNoTracking()
                .Select(q => new { q.Id, q.Tags }).ToListAsync(ct);
            var tagMap = questionTags.ToDictionary(
                q => q.Id, q => Text.Csv(q.Tags).Select(t => t.ToLowerInvariant()).ToHashSet());

            practice = attempts
                .Select(a => new PracticeSignal(tagMap.TryGetValue(a.QuestionId, out var tags) ? tags : [], a.Best))
                .ToList();

            var projectRows = await db.Projects.AsNoTracking()
                .Select(p => new { p.Id, p.SkillSlugs }).ToListAsync(ct);
            var projectProgress = await db.UserProjectProgress.AsNoTracking()
                .Where(p => p.UserId == id).ToDictionaryAsync(p => p.ProjectId, p => p.PercentComplete, ct);

            projects = projectRows.Select(p => new ProjectSignal(
                Text.Csv(p.SkillSlugs).Select(s => s.ToLowerInvariant()).ToHashSet(),
                projectProgress.TryGetValue(p.Id, out var pct) ? pct : 0)).ToList();
        }

        return new Signals(lessons, practice, projects);
    }

    private sealed record LessonSignal(HashSet<string> Slugs, bool Completed, int? QuizScore);
    private sealed record PracticeSignal(HashSet<string> Tags, int Score);
    private sealed record ProjectSignal(HashSet<string> Slugs, int PercentComplete);
    private sealed record Signals(
        List<LessonSignal> Lessons, List<PracticeSignal> Practice, List<ProjectSignal> Projects);
}
