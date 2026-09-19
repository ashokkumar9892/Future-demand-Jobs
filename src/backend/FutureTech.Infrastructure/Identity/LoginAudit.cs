using System.Net;
using System.Net.Sockets;
using System.Threading.Channels;
using FutureTech.Application.Abstractions;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using FutureTech.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Infrastructure.Identity;

/// <summary>
/// Writes one <see cref="LoginEvent"/> per sign-in attempt.
/// <para>
/// A cached location is copied onto the event inline. An unseen address is
/// written as <see cref="GeoLookupState.Pending"/> and handed to the background
/// queue, so signing in never waits on a third-party geo service that may be
/// slow, rate-limited or unreachable.
/// </para>
/// </summary>
public class LoginAuditService(
    AppDbContext db,
    IRequestContext request,
    IDateTimeProvider clock,
    GeoIpOptions options,
    GeoLookupQueue queue) : ILoginAuditService
{
    public async Task RecordAsync(Guid? userId, string email, LoginOutcome outcome, CancellationToken ct = default)
    {
        var ip = Normalise(request.IpAddress);
        var agent = UserAgentParser.Parse(request.UserAgent);

        var entry = new LoginEvent
        {
            UserId = userId,
            Email = (email ?? string.Empty).Trim().ToLowerInvariant(),
            Outcome = outcome,
            IpAddress = ip,
            UserAgent = Truncate(request.UserAgent, 512),
            Browser = agent.Browser,
            OperatingSystem = agent.OperatingSystem,
            DeviceKind = agent.DeviceKind,
            CreatedAt = clock.Now
        };

        if (!options.Enabled)
        {
            entry.GeoState = GeoLookupState.Unavailable;
        }
        else if (IsPrivate(ip))
        {
            entry.GeoState = GeoLookupState.Private;
        }
        else
        {
            var cached = await db.IpLocations.AsNoTracking().FirstOrDefaultAsync(x => x.IpAddress == ip, ct);
            var fresh = cached is not null && cached.ResolvedAt > clock.Now.AddDays(-options.CacheDays);

            if (fresh && cached!.State == GeoLookupState.Resolved)
            {
                Apply(entry, cached);
            }
            else
            {
                entry.GeoState = GeoLookupState.Pending;
                queue.Enqueue(ip);
            }
        }

        db.LoginEvents.Add(entry);
        await db.SaveChangesAsync(ct);
    }

    internal static void Apply(LoginEvent entry, IpLocation location)
    {
        entry.GeoState = location.State;
        entry.City = location.City;
        entry.Region = location.Region;
        entry.Country = location.Country;
        entry.CountryCode = location.CountryCode;
        entry.TimeZone = location.TimeZone;
        entry.Isp = location.Isp;
        entry.Latitude = location.Latitude;
        entry.Longitude = location.Longitude;
    }

    /// <summary>
    /// Kestrel reports an IPv4 client as "::ffff:203.0.113.4" when the socket is
    /// dual-stack. Unwrapping it keeps the cache keyed one way per address.
    /// </summary>
    private static string Normalise(string? ip)
    {
        if (string.IsNullOrWhiteSpace(ip)) return "unknown";
        var value = ip.Trim();

        if (IPAddress.TryParse(value, out var parsed))
        {
            if (parsed.IsIPv4MappedToIPv6) parsed = parsed.MapToIPv4();
            return parsed.ToString();
        }

        return Truncate(value, 64);
    }

    /// <summary>Loopback, RFC1918, CGNAT, link-local and IPv6 unique-local have no public location.</summary>
    internal static bool IsPrivate(string ip)
    {
        if (ip == "unknown") return true;
        if (!IPAddress.TryParse(ip, out var address)) return true;
        if (IPAddress.IsLoopback(address)) return true;

        if (address.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = address.GetAddressBytes();
            return b[0] switch
            {
                10 => true,
                127 => true,
                169 when b[1] == 254 => true,
                172 when b[1] >= 16 && b[1] <= 31 => true,
                192 when b[1] == 168 => true,
                100 when b[1] >= 64 && b[1] <= 127 => true,
                0 => true,
                _ => false
            };
        }

        if (address.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (address.IsIPv6LinkLocal || address.IsIPv6SiteLocal) return true;
            // fc00::/7 — unique local addresses.
            return (address.GetAddressBytes()[0] & 0xFE) == 0xFC;
        }

        return false;
    }

    private static string Truncate(string? value, int max) =>
        string.IsNullOrEmpty(value) ? string.Empty : value.Length <= max ? value : value[..max];
}

/// <summary>
/// Enough of the user-agent string to answer "which browser, which device".
/// Deliberately small: a full UA database is a dependency this platform does
/// not need, and the admin console only shows a label.
/// </summary>
public static class UserAgentParser
{
    public record Result(string Browser, string OperatingSystem, string DeviceKind);

    public static Result Parse(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent)) return new Result("Unknown", "Unknown", "Unknown");
        var ua = userAgent;

        var browser =
            Has(ua, "Edg/") || Has(ua, "Edge/") ? "Edge"
            : Has(ua, "OPR/") || Has(ua, "Opera") ? "Opera"
            : Has(ua, "SamsungBrowser") ? "Samsung Internet"
            : Has(ua, "Firefox") ? "Firefox"
            // Chrome's UA contains "Safari", so Chrome has to be tested first.
            : Has(ua, "Chrome") || Has(ua, "CriOS") ? "Chrome"
            : Has(ua, "Safari") ? "Safari"
            : Has(ua, "curl") || Has(ua, "PostmanRuntime") || Has(ua, "HttpClient") ? "API client"
            : "Unknown";

        var os =
            Has(ua, "Windows NT 10") ? "Windows"
            : Has(ua, "Windows") ? "Windows"
            : Has(ua, "Android") ? "Android"
            : Has(ua, "iPhone") || Has(ua, "iPad") || Has(ua, "iOS") ? "iOS"
            : Has(ua, "Mac OS X") || Has(ua, "Macintosh") ? "macOS"
            : Has(ua, "CrOS") ? "ChromeOS"
            : Has(ua, "Linux") ? "Linux"
            : "Unknown";

        var device =
            Has(ua, "bot") || Has(ua, "crawler") || Has(ua, "spider") ? "Bot"
            : Has(ua, "iPad") || (Has(ua, "Android") && !Has(ua, "Mobile")) ? "Tablet"
            : Has(ua, "Mobi") || Has(ua, "iPhone") || Has(ua, "Android") ? "Mobile"
            : os == "Unknown" && browser == "Unknown" ? "Unknown"
            : "Desktop";

        return new Result(browser, os, device);
    }

    private static bool Has(string haystack, string needle) =>
        haystack.Contains(needle, StringComparison.OrdinalIgnoreCase);
}

public record GeoIpOptions
{
    /// <summary>Turn off to stop the platform making any outbound geo request at all.</summary>
    public bool Enabled { get; init; } = true;

    /// <summary>
    /// Lookup URL with a <c>{ip}</c> placeholder. Defaults to ip-api.com's free
    /// endpoint, which is plain HTTP and rate-limited to roughly 45 requests a
    /// minute — hence the queue and the cache. Any service returning similar
    /// JSON keys can be substituted without a code change.
    /// </summary>
    public string Endpoint { get; init; } =
        "http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,regionName,city,timezone,isp,lat,lon";

    public string Source { get; init; } = "ip-api.com";
    public int TimeoutSeconds { get; init; } = 5;
    /// <summary>How long a cached answer is trusted before the address is looked up again.</summary>
    public int CacheDays { get; init; } = 30;
    /// <summary>Gap between outbound lookups, to stay inside the provider's rate limit.</summary>
    public int MinIntervalMilliseconds { get; init; } = 1500;
}

/// <summary>
/// Addresses waiting to be placed. Bounded and lossy on purpose: a flood of
/// sign-ins must not grow memory, and a dropped lookup only means one login row
/// keeps showing its IP instead of a city.
/// </summary>
public class GeoLookupQueue
{
    private readonly Channel<string> channel = Channel.CreateBounded<string>(
        new BoundedChannelOptions(500) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true });

    public void Enqueue(string ip)
    {
        if (!string.IsNullOrWhiteSpace(ip)) channel.Writer.TryWrite(ip);
    }

    public IAsyncEnumerable<string> ReadAllAsync(CancellationToken ct) => channel.Reader.ReadAllAsync(ct);
}
