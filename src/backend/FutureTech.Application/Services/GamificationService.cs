using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IGamificationService
{
    /// <summary>Records XP and study minutes for an activity. Caller still saves.</summary>
    void Record(Guid userId, int xp, string reason, string refType, Guid? refId, int minutes, StudyActivityType activity);
    Task<GamificationDto> GetAsync(CancellationToken ct = default);
    Task<int> CurrentStreakAsync(Guid userId, CancellationToken ct = default);
    Task EvaluateBadgesAsync(Guid userId, CancellationToken ct = default);
}

public class GamificationService(IAppDbContext db, ICurrentUser currentUser, IDateTimeProvider clock) : IGamificationService
{
    public void Record(Guid userId, int xp, string reason, string refType, Guid? refId, int minutes, StudyActivityType activity)
    {
        if (xp > 0)
            db.XpEvents.Add(new XpEvent { UserId = userId, Amount = xp, Reason = reason, RefType = refType, RefId = refId });

        if (minutes > 0)
            db.StudySessions.Add(new StudySession
            {
                UserId = userId,
                OnDate = clock.Today,
                Minutes = minutes,
                ActivityType = activity,
                RefType = refType,
                RefId = refId
            });
    }

    public async Task<GamificationDto> GetAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var totalXp = await db.XpEvents.AsNoTracking().Where(x => x.UserId == userId).SumAsync(x => (int?)x.Amount, ct) ?? 0;
        var level = Math.Max(1, totalXp / Xp.PerLevel + 1);

        var badges = await db.Badges.AsNoTracking().OrderBy(b => b.Tier).ThenBy(b => b.Name).ToListAsync(ct);
        var earned = await db.UserBadges.AsNoTracking().Where(ub => ub.UserId == userId)
            .ToDictionaryAsync(ub => ub.BadgeId, ub => ub.EarnedAt, ct);

        var dates = await db.StudySessions.AsNoTracking()
            .Where(s => s.UserId == userId).Select(s => s.OnDate).Distinct().ToListAsync(ct);

        return new GamificationDto(
            totalXp, level, Xp.LevelTitle(level),
            totalXp % Xp.PerLevel, Xp.PerLevel,
            Streak(dates, clock.Today), LongestStreak(dates),
            earned.Count, badges.Count,
            badges.Select(b => new BadgeDto(
                b.Id, b.Code, b.Name, b.Description, b.Tier.ToString(), b.Criteria,
                earned.ContainsKey(b.Id),
                earned.TryGetValue(b.Id, out var at) ? at.ToString("yyyy-MM-dd") : null)).ToList());
    }

    public async Task<int> CurrentStreakAsync(Guid userId, CancellationToken ct = default)
    {
        var dates = await db.StudySessions.AsNoTracking()
            .Where(s => s.UserId == userId).Select(s => s.OnDate).Distinct().ToListAsync(ct);
        return Streak(dates, clock.Today);
    }

    /// <summary>
    /// Awards badges whose criteria the learner's measured activity now satisfies.
    /// Deliberately based on completed work only, never on time spent logged in.
    /// </summary>
    public async Task EvaluateBadgesAsync(Guid userId, CancellationToken ct = default)
    {
        var badges = await db.Badges.AsNoTracking().ToListAsync(ct);
        if (badges.Count == 0) return;

        var earnedIds = (await db.UserBadges.AsNoTracking()
            .Where(ub => ub.UserId == userId).Select(ub => ub.BadgeId).ToListAsync(ct)).ToHashSet();

        var completedLessons = await db.LessonProgress.AsNoTracking()
            .CountAsync(p => p.UserId == userId && p.Status == ProgressStatus.Completed, ct);
        var completedProjects = await db.UserProjectProgress.AsNoTracking()
            .CountAsync(p => p.UserId == userId && p.Status == ProgressStatus.Completed, ct);
        var practiceCount = await db.PracticeAttempts.AsNoTracking().CountAsync(p => p.UserId == userId, ct);
        var architectureBest = await db.ArchitectureAttempts.AsNoTracking()
            .Where(a => a.UserId == userId).MaxAsync(a => (int?)a.Score, ct) ?? 0;
        var interviewCount = await db.InterviewAttempts.AsNoTracking().CountAsync(a => a.UserId == userId, ct);
        var certsPassed = await db.UserCertifications.AsNoTracking()
            .CountAsync(c => c.UserId == userId && c.Status == CertificationStatus.Passed, ct);
        var streak = await CurrentStreakAsync(userId, ct);

        var completedProjectSlugs = await db.UserProjectProgress.AsNoTracking()
            .Where(p => p.UserId == userId && p.Status == ProgressStatus.Completed)
            .Select(p => p.Project!.Slug).ToListAsync(ct);

        foreach (var badge in badges)
        {
            if (earnedIds.Contains(badge.Id)) continue;
            var qualifies = badge.Code switch
            {
                "first-lesson" => completedLessons >= 1,
                "ten-lessons" => completedLessons >= 10,
                "fifty-lessons" => completedLessons >= 50,
                "streak-7" => streak >= 7,
                "streak-30" => streak >= 30,
                "practice-25" => practiceCount >= 25,
                "practice-100" => practiceCount >= 100,
                "architecture-master" => architectureBest >= 85,
                "rag-builder" => completedProjectSlugs.Any(s => s.Contains("rag") || s.Contains("document-chat")),
                "ai-agent-builder" => completedProjectSlugs.Any(s => s.Contains("agent")),
                "azure-architect" => certsPassed >= 1,
                "cloud-security" => completedLessons >= 25 && architectureBest >= 70,
                "interview-ready" => interviewCount >= 20,
                "project-finisher" => completedProjects >= 3,
                "capstone" => completedProjectSlugs.Any(s => s.Contains("final")),
                _ => false
            };

            if (!qualifies) continue;
            db.UserBadges.Add(new UserBadge { UserId = userId, BadgeId = badge.Id });
            if (badge.XpReward > 0)
                db.XpEvents.Add(new XpEvent { UserId = userId, Amount = badge.XpReward, Reason = $"Badge: {badge.Name}", RefType = "badge", RefId = badge.Id });
        }
    }

    internal static int Streak(IReadOnlyCollection<DateOnly> dates, DateOnly today)
    {
        if (dates.Count == 0) return 0;
        var set = dates.ToHashSet();
        // A streak stays alive if the learner studied today or yesterday.
        var cursor = set.Contains(today) ? today : today.AddDays(-1);
        if (!set.Contains(cursor)) return 0;
        var streak = 0;
        while (set.Contains(cursor)) { streak++; cursor = cursor.AddDays(-1); }
        return streak;
    }

    internal static int LongestStreak(IReadOnlyCollection<DateOnly> dates)
    {
        if (dates.Count == 0) return 0;
        var ordered = dates.Distinct().OrderBy(d => d).ToList();
        var best = 1;
        var run = 1;
        for (var i = 1; i < ordered.Count; i++)
        {
            run = ordered[i] == ordered[i - 1].AddDays(1) ? run + 1 : 1;
            best = Math.Max(best, run);
        }
        return best;
    }
}
