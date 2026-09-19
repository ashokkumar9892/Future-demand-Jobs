using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IPracticeService
{
    Task<IReadOnlyList<PracticeListItemDto>> ListAsync(string? mode, string? category, Guid? careerPathId, string? search, CancellationToken ct = default);
    Task<PracticeDetailDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<PracticeResultDto> AttemptAsync(Guid id, PracticeAttemptRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<string>> CategoriesAsync(CancellationToken ct = default);
}

public class PracticeService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IAnswerEvaluator evaluator,
    IGamificationService gamification) : IPracticeService
{
    public async Task<IReadOnlyList<PracticeListItemDto>> ListAsync(
        string? mode, string? category, Guid? careerPathId, string? search, CancellationToken ct = default)
    {
        var query = db.PracticeQuestions.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(mode))
        {
            var parsed = Text.ParseEnum<PracticeMode>(mode, PracticeMode.Medium);
            query = query.Where(q => q.Mode == parsed);
        }
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(q => q.Category == category);
        if (careerPathId is { } id) query = query.Where(q => q.CareerPathId == id || q.CareerPathId == null);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(q => q.Prompt.ToLower().Contains(term) || q.Tags.ToLower().Contains(term));
        }

        var questions = await query.OrderBy(q => q.Mode).ThenBy(q => q.Category).ToListAsync(ct);
        var attempts = await AttemptStatsAsync(ct);

        return questions.Select(q =>
        {
            attempts.TryGetValue(q.Id, out var stat);
            return new PracticeListItemDto(
                q.Id, q.Category, q.Mode.ToString(), q.Prompt, q.Tags, q.EstimatedMinutes,
                stat.Count == 0 ? null : stat.Best, stat.Count);
        }).ToList();
    }

    public async Task<PracticeDetailDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var question = await db.PracticeQuestions.AsNoTracking().FirstOrDefaultAsync(q => q.Id == id, ct)
                       ?? throw AppException.NotFound("Practice question");

        PracticeAttempt? last = null;
        int? best = null;
        var bookmarked = false;

        if (currentUser.UserId is { } userId)
        {
            var attempts = await db.PracticeAttempts.AsNoTracking()
                .Where(a => a.UserId == userId && a.PracticeQuestionId == id)
                .OrderByDescending(a => a.CreatedAt).ToListAsync(ct);
            last = attempts.FirstOrDefault();
            if (attempts.Count > 0) best = attempts.Max(a => a.Score);
            bookmarked = await db.Bookmarks.AsNoTracking().AnyAsync(
                b => b.UserId == userId && b.ItemType == BookmarkItemType.PracticeQuestion && b.RefId == id, ct);
        }

        var rubric = Text.FromJson<List<RubricSpec>>(question.RubricJson) ?? [];

        return new PracticeDetailDto(
            question.Id, question.Category, question.Mode.ToString(), question.Prompt, question.Scenario,
            question.Tags, question.EstimatedMinutes,
            rubric.Select(r => new RubricDimensionDto(r.Dimension, r.Weight, r.Guidance ?? string.Empty)).ToList(),
            best, last?.AnswerText, bookmarked);
    }

    public async Task<PracticeResultDto> AttemptAsync(Guid id, PracticeAttemptRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var question = await db.PracticeQuestions.AsNoTracking().FirstOrDefaultAsync(q => q.Id == id, ct)
                       ?? throw AppException.NotFound("Practice question");

        if (string.IsNullOrWhiteSpace(request.AnswerText))
            throw new AppException("Write an answer before submitting.");

        var evaluation = evaluator.Evaluate(request.AnswerText, question.RubricJson, question.ModelAnswer);
        var dimensions = evaluation.Dimensions
            .Select(d => new DimensionScoreDto(d.Dimension, d.Score, d.Weight, d.Comment)).ToList();

        db.PracticeAttempts.Add(new PracticeAttempt
        {
            UserId = userId,
            PracticeQuestionId = id,
            AnswerText = request.AnswerText,
            Score = evaluation.Score,
            DimensionScoresJson = Text.ToJson(dimensions),
            Strengths = string.Join('\n', evaluation.Strengths),
            Weaknesses = string.Join('\n', evaluation.Weaknesses),
            MinutesSpent = Math.Max(0, request.MinutesSpent)
        });

        gamification.Record(userId, Xp.PracticeAttempt, $"Practice: {question.Category}", "practice", id,
            Math.Max(request.MinutesSpent, question.EstimatedMinutes / 2), StudyActivityType.Practice);

        await db.SaveChangesAsync(ct);
        await gamification.EvaluateBadgesAsync(userId, ct);
        await db.SaveChangesAsync(ct);

        return new PracticeResultDto(
            evaluation.Score, dimensions, evaluation.Strengths, evaluation.Weaknesses,
            question.ModelAnswer, evaluation.Method, Xp.PracticeAttempt);
    }

    public async Task<IReadOnlyList<string>> CategoriesAsync(CancellationToken ct = default) =>
        await db.PracticeQuestions.AsNoTracking().Select(q => q.Category).Distinct().OrderBy(c => c).ToListAsync(ct);

    private async Task<Dictionary<Guid, (int Best, int Count)>> AttemptStatsAsync(CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId) return [];
        var rows = await db.PracticeAttempts.AsNoTracking()
            .Where(a => a.UserId == userId)
            .GroupBy(a => a.PracticeQuestionId)
            .Select(g => new { g.Key, Best = g.Max(a => a.Score), Count = g.Count() })
            .ToListAsync(ct);
        return rows.ToDictionary(r => r.Key, r => (r.Best, r.Count));
    }

    internal sealed record RubricSpec(string Dimension, double Weight, List<string>? Keywords, string? Guidance);
}
