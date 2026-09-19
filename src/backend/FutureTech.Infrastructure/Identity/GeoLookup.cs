using System.Text.Json;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using FutureTech.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace FutureTech.Infrastructure.Identity;

/// <summary>Places a public IP address. Returns null when the provider cannot answer.</summary>
public interface IGeoIpResolver
{
    Task<IpLocation?> ResolveAsync(string ip, CancellationToken ct = default);
}

/// <summary>
/// Reads whichever geo service <see cref="GeoIpOptions.Endpoint"/> points at.
/// <para>
/// The common free providers return the same facts under different key names,
/// so the parser accepts the handful of spellings in use rather than binding to
/// one vendor's schema. Any failure returns null — a login row simply keeps
/// showing its IP address.
/// </para>
/// </summary>
public class HttpGeoIpResolver(HttpClient http, GeoIpOptions options, ILogger<HttpGeoIpResolver> logger) : IGeoIpResolver
{
    public async Task<IpLocation?> ResolveAsync(string ip, CancellationToken ct = default)
    {
        if (!options.Enabled) return null;

        var url = options.Endpoint.Replace("{ip}", Uri.EscapeDataString(ip));

        try
        {
            using var response = await http.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogDebug("Geo lookup for {Ip} returned {Status}", ip, (int)response.StatusCode);
                return null;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            var root = document.RootElement;

            if (root.ValueKind != JsonValueKind.Object) return null;

            // ip-api reports failure in the body with a 200 status.
            if (String(root, "status") is { } status && status.Equals("fail", StringComparison.OrdinalIgnoreCase))
            {
                logger.LogDebug("Geo lookup for {Ip} failed: {Message}", ip, String(root, "message"));
                return null;
            }
            if (root.TryGetProperty("error", out var error) && error.ValueKind != JsonValueKind.Null) return null;

            var city = String(root, "city");
            var region = String(root, "regionName") ?? String(root, "region_name") ?? String(root, "region");
            var country = String(root, "country") ?? String(root, "country_name");
            var code = String(root, "countryCode") ?? String(root, "country_code");

            if (city is null && region is null && country is null) return null;

            return new IpLocation
            {
                IpAddress = ip,
                State = GeoLookupState.Resolved,
                City = city,
                Region = region,
                Country = country,
                CountryCode = code,
                TimeZone = String(root, "timezone") ?? String(root, "time_zone"),
                Isp = String(root, "isp") ?? String(root, "org") ?? String(root, "asn"),
                Latitude = Number(root, "lat") ?? Number(root, "latitude"),
                Longitude = Number(root, "lon") ?? Number(root, "longitude"),
                Source = options.Source,
                ResolvedAt = DateTimeOffset.UtcNow
            };
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogDebug(ex, "Geo lookup for {Ip} could not complete", ip);
            return null;
        }
    }

    private static string? String(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() is { Length: > 0 } text ? text : null
            : null;

    private static double? Number(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number &&
        value.TryGetDouble(out var number)
            ? number
            : null;
}

/// <summary>
/// Drains <see cref="GeoLookupQueue"/>, caches each answer and backfills the
/// login rows that were written before the address was known.
/// </summary>
public class GeoLookupWorker(
    GeoLookupQueue queue,
    IServiceScopeFactory scopes,
    GeoIpOptions options,
    ILogger<GeoLookupWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!options.Enabled)
        {
            logger.LogInformation("Geo-IP lookup is disabled; login locations will show the IP address only.");
            return;
        }

        await RequeuePendingAsync(ct);

        await foreach (var ip in queue.ReadAllAsync(ct))
        {
            try
            {
                await ProcessAsync(ip, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                // A failed lookup must never take the host down; the row keeps its IP.
                logger.LogWarning(ex, "Geo lookup for {Ip} failed", ip);
            }

            // Free geo endpoints are rate-limited per minute. Spacing requests
            // out costs nothing here — nothing is waiting on this queue.
            if (options.MinIntervalMilliseconds > 0)
                await Task.Delay(options.MinIntervalMilliseconds, ct);
        }
    }

    private async Task ProcessAsync(string ip, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var resolver = scope.ServiceProvider.GetRequiredService<IGeoIpResolver>();

        var existing = await db.IpLocations.FirstOrDefaultAsync(x => x.IpAddress == ip, ct);
        var cutoff = DateTimeOffset.UtcNow.AddDays(-options.CacheDays);

        // Another login may have queued the same address while this one waited.
        if (existing is { State: GeoLookupState.Resolved } && existing.ResolvedAt > cutoff)
        {
            await BackfillAsync(db, existing, ct);
            return;
        }

        var resolved = await resolver.ResolveAsync(ip, ct);

        var location = existing ?? new IpLocation { IpAddress = ip };
        if (resolved is null)
        {
            location.State = GeoLookupState.Unavailable;
            location.Source = options.Source;
        }
        else
        {
            location.State = GeoLookupState.Resolved;
            location.City = resolved.City;
            location.Region = resolved.Region;
            location.Country = resolved.Country;
            location.CountryCode = resolved.CountryCode;
            location.TimeZone = resolved.TimeZone;
            location.Isp = resolved.Isp;
            location.Latitude = resolved.Latitude;
            location.Longitude = resolved.Longitude;
            location.Source = resolved.Source;
        }

        location.ResolvedAt = DateTimeOffset.UtcNow;
        location.UpdatedAt = DateTimeOffset.UtcNow;
        if (existing is null) db.IpLocations.Add(location);

        await db.SaveChangesAsync(ct);
        await BackfillAsync(db, location, ct);
    }

    private static async Task BackfillAsync(AppDbContext db, IpLocation location, CancellationToken ct)
    {
        var pending = await db.LoginEvents
            .Where(e => e.IpAddress == location.IpAddress && e.GeoState == GeoLookupState.Pending)
            .ToListAsync(ct);

        if (pending.Count == 0) return;

        foreach (var entry in pending) LoginAuditService.Apply(entry, location);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Picks up addresses left pending when the process last stopped, so a
    /// restart mid-queue does not leave login rows permanently unresolved.
    /// </summary>
    private async Task RequeuePendingAsync(CancellationToken ct)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Taken in memory: a provider-side Take after Distinct has no
            // defined order, and the pending set is tiny either way.
            var addresses = (await db.LoginEvents.AsNoTracking()
                    .Where(e => e.GeoState == GeoLookupState.Pending)
                    .Select(e => e.IpAddress)
                    .Distinct()
                    .ToListAsync(ct))
                .Take(100)
                .ToList();

            foreach (var ip in addresses) queue.Enqueue(ip);
            if (addresses.Count > 0)
                logger.LogInformation("Queued {Count} unresolved login addresses from a previous run.", addresses.Count);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not requeue pending login locations.");
        }
    }
}
