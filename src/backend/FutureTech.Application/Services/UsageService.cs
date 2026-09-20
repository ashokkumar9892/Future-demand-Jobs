using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IUsageService
{
    Task RecordAsync(UsageHeartbeatRequest request, CancellationToken ct = default);
    Task<UsageOverviewDto> OverviewAsync(int days, CancellationToken ct = default);

    /// <summary>Everyone who used the application, account or not, longest first.</summary>
    Task<PagedDto<VisitorRowDto>> VisitorsAsync(
        int days, string? search, int page, int pageSize, CancellationToken ct = default);
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
public class UsageService(
    IAppDbContext db, ICurrentUser currentUser, IRequestContext http, IDateTimeProvider clock)
    : IUsageService
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
            row = new AppUsageDay
            {
                UserId = userId,
                VisitorId = visitorId,
                OnDate = today,
                FirstSeenAt = clock.Now
            };
            db.AppUsageDays.Add(row);
        }

        row.Seconds = Math.Min(row.Seconds + seconds, MaxSecondsPerDay);
        row.LastSeenAt = clock.Now;
        row.UpdatedAt = clock.Now;

        // Kept for the visitor list. The address is stored raw and turned into
        // a place only when a report is read, so no heartbeat waits on a geo
        // lookup and no outbound call happens once a minute per reader.
        var ip = http.IpAddress;
        if (!string.IsNullOrWhiteSpace(ip)) row.LastIpAddress = ip;

        var agent = http.UserAgent;
        if (!string.IsNullOrWhiteSpace(agent))
            row.LastUserAgent = agent.Length > 400 ? agent[..400] : agent;

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

    public async Task<PagedDto<VisitorRowDto>> VisitorsAsync(
        int days, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        days = Math.Clamp(days, 1, 365);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        var from = clock.Today.AddDays(-(days - 1));

        var rows = await db.AppUsageDays.AsNoTracking()
            .Where(u => u.OnDate >= from)
            .ToListAsync(ct);

        var names = await db.Users.AsNoTracking()
            .Select(u => new { u.Id, u.DisplayName, u.Email })
            .ToDictionaryAsync(u => u.Id, ct);

        // Resolved from the cache the login audit already fills. A place is
        // shown when some earlier sign-in happened to resolve that address, and
        // left blank otherwise, rather than calling out during a report.
        var addresses = rows.Select(r => r.LastIpAddress)
            .Where(ip => !string.IsNullOrWhiteSpace(ip))
            .Distinct()
            .ToList();

        var places = await db.IpLocations.AsNoTracking()
            .Where(l => addresses.Contains(l.IpAddress))
            .ToDictionaryAsync(l => l.IpAddress, l => l, ct);

        var visitors = rows
            .GroupBy(r => r.UserId is { } id ? $"user:{id}" : $"guest:{r.VisitorId}")
            .Select(g =>
            {
                var latest = g.OrderByDescending(r => r.LastSeenAt).First();
                var userId = latest.UserId;
                names.TryGetValue(userId ?? Guid.Empty, out var account);

                return new VisitorRowDto(
                    g.Key,
                    userId is not null,
                    userId is null
                        // Enough of the opaque id to tell two guests apart in a
                        // table, without implying it names anyone.
                        ? $"Guest {ShortId(latest.VisitorId)}"
                        : account is null
                            ? "Deleted account"
                            : string.IsNullOrWhiteSpace(account.DisplayName) ? account.Email : account.DisplayName,
                    userId is null ? null : account?.Email,
                    Minutes(g.Sum(r => r.Seconds)),
                    g.Select(r => r.OnDate).Distinct().Count(),
                    g.Min(r => r.FirstSeenAt == default ? r.LastSeenAt : r.FirstSeenAt),
                    g.Max(r => r.LastSeenAt),
                    Place(latest.LastIpAddress, places),
                    Device(latest.LastUserAgent));
            })
            .ToList();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            visitors = visitors.Where(v =>
                v.Label.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                (v.Email?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false) ||
                (v.Location?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false))
                .ToList();
        }

        var total = visitors.Count;
        var items = visitors
            .OrderByDescending(v => v.Minutes)
            .ThenByDescending(v => v.LastSeenAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return new PagedDto<VisitorRowDto>(total, page, pageSize, items);
    }

    private static string ShortId(string? visitorId) =>
        string.IsNullOrWhiteSpace(visitorId) ? "unknown" : visitorId.Replace("-", "")[..Math.Min(6, visitorId.Replace("-", "").Length)];

    private static string? Place(string? ip, IReadOnlyDictionary<string, IpLocation> places)
    {
        if (string.IsNullOrWhiteSpace(ip) || !places.TryGetValue(ip, out var place)) return null;
        var parts = new[] { place.City, place.Region, place.Country }
            .Where(p => !string.IsNullOrWhiteSpace(p));
        var label = string.Join(", ", parts);
        return string.IsNullOrWhiteSpace(label) ? null : label;
    }

    private static string? Device(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent)) return null;
        var agent = UserAgentParser.Parse(userAgent);
        return $"{agent.Browser} / {agent.OperatingSystem} · {agent.DeviceKind}";
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
