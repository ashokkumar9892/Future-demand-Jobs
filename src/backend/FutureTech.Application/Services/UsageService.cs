using FutureTech.Application.Abstractions;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IUsageService
{
    Task RecordAsync(UsageHeartbeatRequest request, CancellationToken ct = default);
    Task<UsageOverviewDto> OverviewAsync(int days, CancellationToken ct = default);
}

/// <summary>
/// Accumulates how long people have the application open, and reports on it.
/// <para>
/// The browser sends a heartbeat carrying the seconds it counted since the last
/// one, and only counts while the tab is visible. Server-side duration cannot be
/// derived from request timing: this application is a SPA that can go minutes
/// without a request while someone reads, and a tab left open all night makes
/// no requests at all yet would look identical to one being read.
/// </para>
/// </summary>
public class UsageService(IAppDbContext db, ICurrentUser currentUser, IDateTimeProvider clock) : IUsageService
{
    /// <summary>
    /// Most a single heartbeat may add. The client sends every 60s; this allows
    /// a generous margin for a delayed flush while stopping a forged request
    /// from writing a day's worth of time in one call.
    /// </summary>
    private const int MaxSecondsPerBeat = 15 * 60;

    /// <summary>A day has 86,400 seconds; no honest row can exceed that.</summary>
    private const int MaxSecondsPerDay = 24 * 60 * 60;

    private const int MaxVisitorIdLength = 64;

    public async Task RecordAsync(UsageHeartbeatRequest request, CancellationToken ct = default)
    {
        var seconds = Math.Clamp(request.Seconds, 0, MaxSecondsPerBeat);
        if (seconds == 0) return;

        var userId = currentUser.UserId;

        // An account is always the better identity: once someone signs in, their
        // time belongs to the account rather than to the browser they used.
        var visitorId = userId is null ? Clean(request.VisitorId) : null;
        if (userId is null && visitorId is null) return;

        var today = clock.Today;

        var row = await db.AppUsageDays.FirstOrDefaultAsync(
            u => u.OnDate == today && (userId != null ? u.UserId == userId : u.VisitorId == visitorId), ct);

        if (row is null)
        {
            row = new AppUsageDay { UserId = userId, VisitorId = visitorId, OnDate = today };
            db.AppUsageDays.Add(row);
        }

        row.Seconds = Math.Min(row.Seconds + seconds, MaxSecondsPerDay);
        row.LastSeenAt = clock.Now;
        row.UpdatedAt = clock.Now;

        await db.SaveChangesAsync(ct);
    }

    public async Task<UsageOverviewDto> OverviewAsync(int days, CancellationToken ct = default)
    {
        days = Math.Clamp(days, 1, 365);
        var today = clock.Today;
        var from = today.AddDays(-(days - 1));

        var rows = await db.AppUsageDays.AsNoTracking()
            .Where(u => u.OnDate >= from)
            .Select(u => new { u.UserId, u.VisitorId, u.OnDate, u.Seconds, u.LastSeenAt })
            .ToListAsync(ct);

        var daily = new List<UsageDayDto>(days);
        for (var i = 0; i < days; i++)
        {
            var date = from.AddDays(i);
            var onDay = rows.Where(r => r.OnDate == date).ToList();
            daily.Add(new UsageDayDto(
                date.ToString("yyyy-MM-dd"),
                Minutes(onDay.Where(r => r.UserId != null).Sum(r => r.Seconds)),
                Minutes(onDay.Where(r => r.UserId == null).Sum(r => r.Seconds)),
                onDay.Where(r => r.UserId != null).Select(r => r.UserId).Distinct().Count(),
                onDay.Where(r => r.UserId == null).Select(r => r.VisitorId).Distinct().Count()));
        }

        var learnerSeconds = rows.Where(r => r.UserId != null).Sum(r => r.Seconds);
        var visitorSeconds = rows.Where(r => r.UserId == null).Sum(r => r.Seconds);
        var activeLearners = rows.Where(r => r.UserId != null).Select(r => r.UserId).Distinct().Count();
        var activeVisitors = rows.Where(r => r.UserId == null).Select(r => r.VisitorId).Distinct().Count();

        var names = await db.Users.AsNoTracking()
            .Select(u => new { u.Id, u.DisplayName, u.Email })
            .ToDictionaryAsync(u => u.Id, ct);

        var topLearners = rows
            .Where(r => r.UserId != null)
            .GroupBy(r => r.UserId!.Value)
            .Select(g => new UsagePersonDto(
                g.Key,
                names.TryGetValue(g.Key, out var u) ? (string.IsNullOrWhiteSpace(u.DisplayName) ? u.Email : u.DisplayName) : "Deleted account",
                Minutes(g.Sum(r => r.Seconds)),
                g.Select(r => r.OnDate).Distinct().Count(),
                g.Max(r => r.LastSeenAt)))
            .OrderByDescending(p => p.Minutes)
            .Take(25)
            .ToList();

        return new UsageOverviewDto(
            days,
            Minutes(learnerSeconds + visitorSeconds),
            Minutes(learnerSeconds),
            Minutes(visitorSeconds),
            activeLearners,
            activeVisitors,
            activeLearners == 0 ? 0 : Math.Round(Minutes(learnerSeconds) / (double)activeLearners, 1),
            activeVisitors == 0 ? 0 : Math.Round(Minutes(visitorSeconds) / (double)activeVisitors, 1),
            Minutes(rows.Where(r => r.OnDate == today).Sum(r => r.Seconds)),
            daily,
            topLearners);
    }

    private static int Minutes(int seconds) => (int)Math.Round(seconds / 60.0);

    private static string? Clean(string? visitorId)
    {
        var trimmed = visitorId?.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.Length > MaxVisitorIdLength) return null;
        // Opaque identifier, so anything outside this alphabet is not one of ours.
        return trimmed.All(c => char.IsAsciiLetterOrDigit(c) || c == '-') ? trimmed : null;
    }
}
