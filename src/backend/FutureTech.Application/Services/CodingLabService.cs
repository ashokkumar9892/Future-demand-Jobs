using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface ICodingLabService
{
    Task<IReadOnlyList<CodingExerciseListItemDto>> ListAsync(string? category, string? difficulty, string? search, CancellationToken ct = default);
    Task<CodingExerciseDetailDto> GetAsync(string slug, CancellationToken ct = default);
    Task<CodingResultDto> AttemptAsync(Guid id, CodingAttemptRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<string>> CategoriesAsync(CancellationToken ct = default);
}

/// <summary>
/// Browser-based exercises. Submissions are checked statically against the
/// constructs the exercise requires — the build does not execute learner code.
/// Wiring a sandboxed runner behind this service is a documented next step.
/// </summary>
public class CodingLabService(
    IAppDbContext db, ICurrentUser currentUser, IGamificationService gamification) : ICodingLabService
{
    public async Task<IReadOnlyList<CodingExerciseListItemDto>> ListAsync(
        string? category, string? difficulty, string? search, CancellationToken ct = default)
    {
        var query = db.CodingExercises.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(e => e.Category == category);
        if (!string.IsNullOrWhiteSpace(difficulty))
        {
            var level = Text.ParseEnum(difficulty, DifficultyLevel.Intermediate);
            query = query.Where(e => e.Difficulty == level);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(e => e.Title.ToLower().Contains(term) || e.Category.ToLower().Contains(term));
        }

        var exercises = await query.OrderBy(e => e.Category).ThenBy(e => e.Difficulty).ToListAsync(ct);
        var stats = await StatsAsync(ct);

        return exercises.Select(e =>
        {
            stats.TryGetValue(e.Id, out var stat);
            return new CodingExerciseListItemDto(
                e.Id, e.Category, e.Title, e.Slug, Text.Humanize(e.Difficulty), e.Language,
                e.EstimatedMinutes, stat.Passed, stat.Count == 0 ? null : stat.Best);
        }).ToList();
    }

    public async Task<CodingExerciseDetailDto> GetAsync(string slug, CancellationToken ct = default)
    {
        var exercise = await db.CodingExercises.AsNoTracking().FirstOrDefaultAsync(e => e.Slug == slug, ct)
                       ?? throw AppException.NotFound("Coding exercise");

        string? lastSubmission = null;
        var passed = false;
        var bookmarked = false;

        if (currentUser.UserId is { } userId)
        {
            var attempt = await db.CodingAttempts.AsNoTracking()
                .Where(a => a.UserId == userId && a.CodingExerciseId == exercise.Id)
                .OrderByDescending(a => a.CreatedAt).FirstOrDefaultAsync(ct);
            lastSubmission = attempt?.SubmittedCode;
            passed = await db.CodingAttempts.AsNoTracking()
                .AnyAsync(a => a.UserId == userId && a.CodingExerciseId == exercise.Id && a.Passed, ct);
            bookmarked = await db.Bookmarks.AsNoTracking().AnyAsync(
                b => b.UserId == userId && b.ItemType == BookmarkItemType.CodingExercise && b.RefId == exercise.Id, ct);
        }

        var tests = Text.FromJson<List<TestSpec>>(exercise.TestsJson) ?? [];

        return new CodingExerciseDetailDto(
            exercise.Id, exercise.Category, exercise.Title, exercise.Slug,
            Text.Humanize(exercise.Difficulty), exercise.ProblemMarkdown, exercise.Language,
            exercise.StarterCode, tests.Select(t => t.Name).ToList(), exercise.EstimatedMinutes,
            lastSubmission, passed, bookmarked);
    }

    public async Task<CodingResultDto> AttemptAsync(Guid id, CodingAttemptRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var exercise = await db.CodingExercises.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id, ct)
                       ?? throw AppException.NotFound("Coding exercise");

        if (string.IsNullOrWhiteSpace(request.Code)) throw new AppException("Write some code before running the tests.");

        var tests = Text.FromJson<List<TestSpec>>(exercise.TestsJson) ?? [];
        var code = request.Code;
        var results = new List<CodingTestResultDto>();

        foreach (var test in tests)
        {
            var hasRequired = test.MustContain is null || test.MustContain.All(
                token => code.Contains(token, StringComparison.OrdinalIgnoreCase));
            var hasForbidden = test.MustNotContain is not null && test.MustNotContain.Any(
                token => code.Contains(token, StringComparison.OrdinalIgnoreCase));
            var ok = hasRequired && !hasForbidden;
            results.Add(new CodingTestResultDto(test.Name, ok, ok ? string.Empty : test.Hint ?? string.Empty));
        }

        var passedCount = results.Count(r => r.Passed);
        var score = results.Count == 0 ? 0 : (int)Math.Round(passedCount * 100.0 / results.Count);
        var passed = results.Count > 0 && passedCount == results.Count;

        db.CodingAttempts.Add(new CodingAttempt
        {
            UserId = userId,
            CodingExerciseId = id,
            SubmittedCode = code,
            Passed = passed,
            TestResultsJson = Text.ToJson(results),
            Score = score
        });

        gamification.Record(userId, passed ? Xp.CodingPassed : 15, $"Coding lab: {exercise.Title}",
            "coding", id, exercise.EstimatedMinutes, StudyActivityType.Coding);

        await db.SaveChangesAsync(ct);
        await gamification.EvaluateBadgesAsync(userId, ct);
        await db.SaveChangesAsync(ct);

        return new CodingResultDto(
            passed, score, results,
            // The worked solution unlocks once every check passes, so the learner
            // wrestles with the problem first.
            passed ? exercise.SolutionCode : null,
            passed ? exercise.Explanation : null,
            passed ? Xp.CodingPassed : 15,
            Disclaimers.StaticCodeCheck);
    }

    public async Task<IReadOnlyList<string>> CategoriesAsync(CancellationToken ct = default) =>
        await db.CodingExercises.AsNoTracking().Select(e => e.Category).Distinct().OrderBy(c => c).ToListAsync(ct);

    private async Task<Dictionary<Guid, (int Best, int Count, bool Passed)>> StatsAsync(CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId) return [];
        var rows = await db.CodingAttempts.AsNoTracking()
            .Where(a => a.UserId == userId)
            .GroupBy(a => a.CodingExerciseId)
            .Select(g => new { g.Key, Best = g.Max(a => a.Score), Count = g.Count(), Passed = g.Any(a => a.Passed) })
            .ToListAsync(ct);
        return rows.ToDictionary(r => r.Key, r => (r.Best, r.Count, r.Passed));
    }

    internal sealed record TestSpec(string Name, List<string>? MustContain, List<string>? MustNotContain, string? Hint);
}
