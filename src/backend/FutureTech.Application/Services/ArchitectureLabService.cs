using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IArchitectureLabService
{
    Task<IReadOnlyList<ArchitectureChallengeListItemDto>> ListAsync(CancellationToken ct = default);
    Task<ArchitectureChallengeDetailDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<ArchitectureResultDto> AttemptAsync(Guid id, ArchitectureAttemptRequest request, CancellationToken ct = default);
}

public class ArchitectureLabService(
    IAppDbContext db, ICurrentUser currentUser, IGamificationService gamification) : IArchitectureLabService
{
    public async Task<IReadOnlyList<ArchitectureChallengeListItemDto>> ListAsync(CancellationToken ct = default)
    {
        var challenges = await db.ArchitectureChallenges.AsNoTracking()
            .OrderBy(c => c.Difficulty).ThenBy(c => c.Title).ToListAsync(ct);
        var best = await BestScoresAsync(ct);

        return challenges.Select(c => new ArchitectureChallengeListItemDto(
            c.Id, c.Title, c.Slug, c.Scenario, Text.Humanize(c.Difficulty), c.EstimatedMinutes,
            best.TryGetValue(c.Id, out var score) ? score : null)).ToList();
    }

    public async Task<ArchitectureChallengeDetailDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var challenge = await db.ArchitectureChallenges.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct)
                        ?? throw AppException.NotFound("Architecture challenge");
        var best = await BestScoresAsync(ct);

        return new ArchitectureChallengeDetailDto(
            challenge.Id, challenge.Title, challenge.Slug, challenge.Scenario,
            Text.Humanize(challenge.Difficulty), challenge.EstimatedMinutes,
            Text.FromJson<List<string>>(challenge.RequirementsJson) ?? [],
            (Text.FromJson<List<ChoiceGroupSpec>>(challenge.ChoiceGroupsJson) ?? [])
                .Select(g => new ArchitectureChoiceGroupDto(g.Key, g.Label, g.Options)).ToList(),
            challenge.DiagramMermaid,
            best.TryGetValue(id, out var score) ? score : null);
    }

    public async Task<ArchitectureResultDto> AttemptAsync(Guid id, ArchitectureAttemptRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var challenge = await db.ArchitectureChallenges.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct)
                        ?? throw AppException.NotFound("Architecture challenge");

        var groups = Text.FromJson<List<ChoiceGroupSpec>>(challenge.ChoiceGroupsJson) ?? [];
        var suggested = Text.FromJson<List<SuggestionSpec>>(challenge.SuggestedArchitectureJson) ?? [];

        var results = new List<ArchitectureGroupResultDto>();
        double earned = 0;

        foreach (var group in groups)
        {
            request.Selections.TryGetValue(group.Key, out var choice);
            choice ??= string.Empty;
            var answer = suggested.FirstOrDefault(s => s.Key == group.Key);

            var matched = answer is not null && string.Equals(choice, answer.Answer, StringComparison.OrdinalIgnoreCase);
            // A defensible alternative earns most of the credit: architecture
            // rarely has exactly one right answer.
            var acceptable = !matched && answer?.Acceptable is not null &&
                             answer.Acceptable.Any(a => string.Equals(a, choice, StringComparison.OrdinalIgnoreCase));

            earned += matched ? 1 : acceptable ? 0.7 : 0;
            results.Add(new ArchitectureGroupResultDto(
                group.Key, group.Label, choice, answer?.Answer ?? "—", matched, acceptable,
                answer?.Rationale ?? string.Empty));
        }

        var score = groups.Count == 0 ? 0 : (int)Math.Round(earned * 100 / groups.Count);

        db.ArchitectureAttempts.Add(new ArchitectureAttempt
        {
            UserId = userId,
            ArchitectureChallengeId = id,
            SelectionsJson = Text.ToJson(request.Selections),
            Score = score,
            PerGroupScoresJson = Text.ToJson(results)
        });

        gamification.Record(userId, Xp.ArchitectureAttempt, $"Architecture: {challenge.Title}",
            "architecture", id, challenge.EstimatedMinutes, StudyActivityType.Architecture);

        await db.SaveChangesAsync(ct);
        await gamification.EvaluateBadgesAsync(userId, ct);
        await db.SaveChangesAsync(ct);

        return new ArchitectureResultDto(score, results, challenge.Rationale, challenge.DiagramMermaid, Xp.ArchitectureAttempt);
    }

    private async Task<Dictionary<Guid, int>> BestScoresAsync(CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId) return [];
        var rows = await db.ArchitectureAttempts.AsNoTracking()
            .Where(a => a.UserId == userId)
            .GroupBy(a => a.ArchitectureChallengeId)
            .Select(g => new { g.Key, Best = g.Max(a => a.Score) })
            .ToListAsync(ct);
        return rows.ToDictionary(r => r.Key, r => r.Best);
    }

    internal sealed record ChoiceGroupSpec(string Key, string Label, List<string> Options);
    internal sealed record SuggestionSpec(string Key, string Answer, List<string>? Acceptable, string Rationale);
}
