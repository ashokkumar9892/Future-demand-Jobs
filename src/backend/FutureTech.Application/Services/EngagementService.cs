using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

/// <summary>
/// Read-only reporting for the admin console: who has an account, which course
/// each of them is working through, where they signed in from, and how the
/// feedback queue is moving.
/// </summary>
public interface IEngagementService
{
    Task<EngagementOverviewDto> OverviewAsync(CancellationToken ct = default);
    Task<PagedDto<LearnerRowDto>> LearnersAsync(
        string? search, string? sort, int page, int pageSize, CancellationToken ct = default);
    Task<LearnerDetailDto> LearnerAsync(Guid userId, CancellationToken ct = default);
    Task<PagedDto<LoginEventDto>> LoginsAsync(
        string? search, string? outcome, Guid? userId, int page, int pageSize, CancellationToken ct = default);
    Task<IReadOnlyList<CourseEngagementDto>> CoursesAsync(CancellationToken ct = default);
}

public class EngagementService(IAppDbContext db, IDateTimeProvider clock) : IEngagementService
{
    /// <summary>Which course a lesson belongs to, flattened so progress can be rolled up in one pass.</summary>
    private sealed record LessonOwner(Guid LessonId, Guid CourseId, string Title, string Slug, int PhaseNumber, string Level);

    public async Task<EngagementOverviewDto> OverviewAsync(CancellationToken ct = default)
    {
        var now = clock.Now;
        var last7 = now.AddDays(-7);
        var last30 = now.AddDays(-30);

        var totalLearners = await db.Users.CountAsync(u => u.Role == UserRole.Learner, ct);
        var newLast30 = await db.Users.CountAsync(u => u.Role == UserRole.Learner && u.CreatedAt >= last30, ct);

        // "Active" means studied, not merely signed in — a login with no lesson
        // activity would overstate engagement.
        var activeIds7 = await db.LessonProgress
            .Where(p => p.UpdatedAt >= last7 || p.CreatedAt >= last7)
            .Select(p => p.UserId).Distinct().CountAsync(ct);
        var activeIds30 = await db.LessonProgress
            .Where(p => p.UpdatedAt >= last30 || p.CreatedAt >= last30)
            .Select(p => p.UserId).Distinct().CountAsync(ct);

        var logins7 = await db.LoginEvents.CountAsync(e => e.CreatedAt >= last7 && e.Outcome == LoginOutcome.Success, ct);
        var failed7 = await db.LoginEvents.CountAsync(e => e.CreatedAt >= last7 && e.Outcome != LoginOutcome.Success, ct);

        var feedback = await db.Feedback.AsNoTracking().Select(f => new { f.Status, f.Rating }).ToListAsync(ct);
        var rated = feedback.Where(f => f.Rating > 0).ToList();

        var topLocations = await TopLocationsAsync(null, 8, ct);
        var courses = await CoursesAsync(ct);

        return new EngagementOverviewDto(
            totalLearners,
            newLast30,
            activeIds7,
            activeIds30,
            logins7,
            failed7,
            feedback.Count(f => f.Status != FeedbackStatus.Implemented && f.Status != FeedbackStatus.Declined),
            feedback.Count(f => f.Status == FeedbackStatus.Implemented),
            rated.Count == 0 ? 0 : Math.Round(rated.Average(f => f.Rating), 2),
            topLocations,
            courses.OrderByDescending(c => c.Learners).ThenByDescending(c => c.MinutesStudied).Take(6).ToList());
    }

    public async Task<PagedDto<LearnerRowDto>> LearnersAsync(
        string? search, string? sort, int page, int pageSize, CancellationToken ct = default)
    {
        var query = db.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(u => EF.Functions.Like(u.Email, term) || EF.Functions.Like(u.DisplayName, term));
        }

        var total = await query.CountAsync(ct);
        var (safePage, safeSize) = Paging.Normalise(page, pageSize);

        query = sort?.ToLowerInvariant() switch
        {
            "name" => query.OrderBy(u => u.DisplayName),
            "joined" => query.OrderByDescending(u => u.CreatedAt),
            // Never signed in sorts last rather than first, which a plain
            // descending sort on a nullable column would do on some providers.
            _ => query.OrderByDescending(u => u.LastLoginAt ?? DateTimeOffset.MinValue).ThenBy(u => u.DisplayName)
        };

        var users = await query.Skip((safePage - 1) * safeSize).Take(safeSize).ToListAsync(ct);
        var rows = await BuildRowsAsync(users, ct);

        return new PagedDto<LearnerRowDto>(total, safePage, safeSize, rows);
    }

    public async Task<LearnerDetailDto> LearnerAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
                   ?? throw AppException.NotFound("Learner");

        var row = (await BuildRowsAsync([user], ct))[0];

        var owners = await LessonOwnersAsync(ct);
        var lessonsPerCourse = owners.Values
            .GroupBy(o => o.CourseId)
            .ToDictionary(g => g.Key, g => g.Count());

        var progress = await db.LessonProgress.AsNoTracking().Where(p => p.UserId == userId).ToListAsync(ct);

        var courses = progress
            .Where(p => owners.ContainsKey(p.LessonId))
            .GroupBy(p => owners[p.LessonId].CourseId)
            .Select(g =>
            {
                var owner = owners[g.First().LessonId];
                var totalLessons = lessonsPerCourse.GetValueOrDefault(g.Key);
                var completed = g.Count(p => p.Status == ProgressStatus.Completed);
                var inProgress = g.Count(p => p.Status == ProgressStatus.InProgress);
                var percent = totalLessons == 0 ? 0 : Math.Round(completed * 100.0 / totalLessons, 1);

                return new LearnerCourseProgressDto(
                    owner.CourseId, owner.Title, owner.Slug, owner.PhaseNumber, owner.Level,
                    totalLessons, completed, inProgress, percent,
                    g.Sum(p => p.MinutesSpent),
                    completed >= totalLessons && totalLessons > 0 ? "Completed"
                        : inProgress > 0 || completed > 0 ? "In progress" : "Not started",
                    g.Min(p => p.CreatedAt),
                    g.Max(p => LastTouched(p)));
            })
            .OrderByDescending(c => c.LastActivityAt)
            .ToList();

        var logins = await db.LoginEvents.AsNoTracking()
            .Where(e => e.UserId == userId)
            .OrderByDescending(e => e.CreatedAt)
            .Take(50)
            .ToListAsync(ct);

        var feedback = await db.Feedback.AsNoTracking()
            .Where(f => f.UserId == userId)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync(ct);

        return new LearnerDetailDto(
            row,
            courses,
            logins.Select(e => MapLogin(e, user.DisplayName)).ToList(),
            await TopLocationsAsync(userId, 10, ct),
            feedback.Select(f => FeedbackService.Map(f, user.DisplayName, user.Email)).ToList());
    }

    public async Task<PagedDto<LoginEventDto>> LoginsAsync(
        string? search, string? outcome, Guid? userId, int page, int pageSize, CancellationToken ct = default)
    {
        var query = db.LoginEvents.AsNoTracking().Include(e => e.User).AsQueryable();

        if (userId is not null) query = query.Where(e => e.UserId == userId);

        if (!string.IsNullOrWhiteSpace(outcome) && !outcome.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            if (outcome.Equals("failed", StringComparison.OrdinalIgnoreCase))
                query = query.Where(e => e.Outcome != LoginOutcome.Success);
            else if (Enum.TryParse<LoginOutcome>(outcome, true, out var parsed))
                query = query.Where(e => e.Outcome == parsed);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(e =>
                EF.Functions.Like(e.Email, term) ||
                EF.Functions.Like(e.IpAddress, term) ||
                (e.City != null && EF.Functions.Like(e.City, term)) ||
                (e.Country != null && EF.Functions.Like(e.Country, term)) ||
                (e.Region != null && EF.Functions.Like(e.Region, term)));
        }

        var total = await query.CountAsync(ct);
        var (safePage, safeSize) = Paging.Normalise(page, pageSize);

        var rows = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((safePage - 1) * safeSize)
            .Take(safeSize)
            .ToListAsync(ct);

        return new PagedDto<LoginEventDto>(
            total, safePage, safeSize,
            rows.Select(e => MapLogin(e, e.User?.DisplayName)).ToList());
    }

    public async Task<IReadOnlyList<CourseEngagementDto>> CoursesAsync(CancellationToken ct = default)
    {
        var last7 = clock.Now.AddDays(-7);
        var owners = await LessonOwnersAsync(ct);

        var courses = await db.Courses.AsNoTracking()
            .Select(c => new { c.Id, c.Title, c.Slug, c.PhaseNumber })
            .ToListAsync(ct);

        var lessonsPerCourse = owners.Values.GroupBy(o => o.CourseId).ToDictionary(g => g.Key, g => g.Count());

        var progress = await db.LessonProgress.AsNoTracking()
            .Select(p => new { p.UserId, p.LessonId, p.Status, p.MinutesSpent, p.CreatedAt, p.UpdatedAt, p.CompletedAt })
            .ToListAsync(ct);

        var byCourse = progress
            .Where(p => owners.ContainsKey(p.LessonId))
            .GroupBy(p => owners[p.LessonId].CourseId)
            .ToDictionary(g => g.Key, g => g.ToList());

        return courses
            .Select(course =>
            {
                var totalLessons = lessonsPerCourse.GetValueOrDefault(course.Id);
                var rows = byCourse.GetValueOrDefault(course.Id) ?? [];

                var perLearner = rows.GroupBy(r => r.UserId).ToList();
                var completedLearners = totalLessons == 0
                    ? 0
                    : perLearner.Count(g => g.Count(r => r.Status == ProgressStatus.Completed) >= totalLessons);

                var averagePercent = totalLessons == 0 || perLearner.Count == 0
                    ? 0
                    : Math.Round(
                        perLearner.Average(g => g.Count(r => r.Status == ProgressStatus.Completed) * 100.0 / totalLessons),
                        1);

                return new CourseEngagementDto(
                    course.Id, course.Title, course.Slug, course.PhaseNumber, totalLessons,
                    perLearner.Count,
                    perLearner.Count(g => g.Any(r => (r.CompletedAt ?? r.UpdatedAt ?? r.CreatedAt) >= last7)),
                    completedLearners,
                    averagePercent,
                    rows.Sum(r => r.MinutesSpent),
                    rows.Count == 0 ? null : rows.Max(r => r.CompletedAt ?? r.UpdatedAt ?? r.CreatedAt));
            })
            .OrderBy(c => c.PhaseNumber)
            .ToList();
    }

    // ----- shared building blocks ----------------------------------------

    private async Task<IReadOnlyList<LearnerRowDto>> BuildRowsAsync(IReadOnlyList<AppUser> users, CancellationToken ct)
    {
        if (users.Count == 0) return [];

        var ids = users.Select(u => u.Id).ToList();
        var owners = await LessonOwnersAsync(ct);
        var lessonsPerCourse = owners.Values.GroupBy(o => o.CourseId).ToDictionary(g => g.Key, g => g.Count());

        var progress = await db.LessonProgress.AsNoTracking()
            .Where(p => ids.Contains(p.UserId))
            .ToListAsync(ct);

        var minutes = (await db.StudySessions.AsNoTracking()
                .Where(s => ids.Contains(s.UserId))
                .Select(s => new { s.UserId, s.Minutes })
                .ToListAsync(ct))
            .GroupBy(s => s.UserId).ToDictionary(g => g.Key, g => g.Sum(x => x.Minutes));

        var xp = (await db.XpEvents.AsNoTracking()
                .Where(e => ids.Contains(e.UserId))
                .Select(e => new { e.UserId, e.Amount })
                .ToListAsync(ct))
            .GroupBy(e => e.UserId).ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        var feedbackCounts = (await db.Feedback.AsNoTracking()
                .Where(f => ids.Contains(f.UserId))
                .Select(f => f.UserId)
                .ToListAsync(ct))
            .GroupBy(id => id).ToDictionary(g => g.Key, g => g.Count());

        var loginRows = await db.LoginEvents.AsNoTracking()
            .Where(e => e.UserId != null && ids.Contains(e.UserId.Value))
            .Select(e => new
            {
                UserId = e.UserId!.Value,
                e.CreatedAt, e.Outcome, e.IpAddress, e.GeoState,
                e.City, e.Region, e.Country, e.Browser, e.OperatingSystem, e.DeviceKind
            })
            .ToListAsync(ct);

        var loginsByUser = loginRows.GroupBy(e => e.UserId).ToDictionary(g => g.Key, g => g.ToList());
        var profiles = await db.StudyProfiles.AsNoTracking()
            .Include(p => p.TargetCareerPath)
            .Where(p => ids.Contains(p.UserId))
            .ToListAsync(ct);

        var progressByUser = progress.GroupBy(p => p.UserId).ToDictionary(g => g.Key, g => g.ToList());

        return users.Select(user =>
        {
            var mine = progressByUser.GetValueOrDefault(user.Id) ?? [];
            var profile = profiles.FirstOrDefault(p => p.UserId == user.Id);
            var logins = loginsByUser.GetValueOrDefault(user.Id) ?? [];
            var lastSuccess = logins
                .Where(e => e.Outcome == LoginOutcome.Success)
                .OrderByDescending(e => e.CreatedAt)
                .FirstOrDefault();

            var perCourse = mine
                .Where(p => owners.ContainsKey(p.LessonId))
                .GroupBy(p => owners[p.LessonId].CourseId)
                .ToList();

            var current = perCourse
                .OrderByDescending(g => g.Max(LastTouched))
                .FirstOrDefault();

            var currentTotal = current is null ? 0 : lessonsPerCourse.GetValueOrDefault(current.Key);
            var currentDone = current?.Count(p => p.Status == ProgressStatus.Completed) ?? 0;

            return new LearnerRowDto(
                user.Id, user.Email, user.DisplayName, user.Role.ToString(), user.YearsExperience,
                user.CreatedAt,
                profile?.OnboardingCompletedAt is not null,
                profile?.TargetCareerPath?.Title,
                user.LastLoginAt,
                lastSuccess is null
                    ? null
                    : LocationLabel(lastSuccess.GeoState, lastSuccess.City, lastSuccess.Region, lastSuccess.Country),
                lastSuccess is null ? null : $"{lastSuccess.Browser} on {lastSuccess.OperatingSystem}",
                lastSuccess?.IpAddress,
                logins.Count(e => e.Outcome == LoginOutcome.Success),
                logins.Count(e => e.Outcome != LoginOutcome.Success),
                current is null ? null : owners[current.First().LessonId].Title,
                current?.Key,
                currentTotal == 0 ? 0 : Math.Round(currentDone * 100.0 / currentTotal, 1),
                perCourse.Count,
                perCourse.Count(g =>
                {
                    var total = lessonsPerCourse.GetValueOrDefault(g.Key);
                    return total > 0 && g.Count(p => p.Status == ProgressStatus.Completed) >= total;
                }),
                mine.Count(p => p.Status == ProgressStatus.Completed),
                mine.Count(p => p.Status == ProgressStatus.InProgress),
                minutes.GetValueOrDefault(user.Id),
                xp.GetValueOrDefault(user.Id),
                feedbackCounts.GetValueOrDefault(user.Id),
                mine.Count == 0 ? null : mine.Max(LastTouched));
        }).ToList();
    }

    /// <summary>Lesson → owning course, loaded once per request. Content tables are small.</summary>
    private async Task<Dictionary<Guid, LessonOwner>> LessonOwnersAsync(CancellationToken ct)
    {
        var rows = await db.Lessons.AsNoTracking()
            .Join(db.Modules.AsNoTracking(), l => l.ModuleId, m => m.Id, (l, m) => new { l.Id, m.CourseId })
            .Join(db.Courses.AsNoTracking(), x => x.CourseId, c => c.Id,
                (x, c) => new LessonOwner(x.Id, c.Id, c.Title, c.Slug, c.PhaseNumber, c.Level.ToString()))
            .ToListAsync(ct);

        return rows.ToDictionary(r => r.LessonId);
    }

    private async Task<IReadOnlyList<LocationRollupDto>> TopLocationsAsync(Guid? userId, int take, CancellationToken ct)
    {
        var query = db.LoginEvents.AsNoTracking().Where(e => e.Outcome == LoginOutcome.Success);
        if (userId is not null) query = query.Where(e => e.UserId == userId);

        var rows = await query
            .Select(e => new { e.UserId, e.CreatedAt, e.GeoState, e.City, e.Region, e.Country, e.CountryCode })
            .ToListAsync(ct);

        return rows
            .GroupBy(e => LocationLabel(e.GeoState, e.City, e.Region, e.Country))
            .Select(g => new LocationRollupDto(
                g.Key,
                g.Select(e => e.CountryCode).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c)),
                g.Count(),
                g.Select(e => e.UserId).Distinct().Count(),
                g.Max(e => e.CreatedAt)))
            .OrderByDescending(l => l.LoginCount)
            .Take(take)
            .ToList();
    }

    /// <summary>Progress rows carry three timestamps; the most recent one is the activity date.</summary>
    private static DateTimeOffset LastTouched(LessonProgress p) => p.CompletedAt ?? p.UpdatedAt ?? p.CreatedAt;

    internal static string LocationLabel(GeoLookupState state, string? city, string? region, string? country)
    {
        if (state == GeoLookupState.Private) return "Local network";
        if (state == GeoLookupState.Pending) return "Resolving…";

        var parts = new[] { city, region, country }
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Select(p => p!.Trim())
            .Distinct()
            .ToArray();

        return parts.Length == 0 ? "Unknown" : string.Join(", ", parts);
    }

    internal static LoginEventDto MapLogin(LoginEvent e, string? displayName) => new(
        e.Id, e.UserId, e.Email, displayName ?? "Unknown account", e.Outcome.ToString(), e.CreatedAt,
        e.IpAddress,
        LocationLabel(e.GeoState, e.City, e.Region, e.Country),
        e.City, e.Region, e.Country, e.CountryCode, e.TimeZone, e.Isp, e.Latitude, e.Longitude,
        e.Browser, e.OperatingSystem, e.DeviceKind, e.GeoState.ToString());
}
