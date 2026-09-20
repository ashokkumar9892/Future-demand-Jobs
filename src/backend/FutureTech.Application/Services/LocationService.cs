using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

/// <summary>
/// Resolves which market a request is about, and formats money in that market's
/// own currency.
/// </summary>
public interface ILocationService
{
    Task<IReadOnlyList<CountryDto>> ListAsync(CancellationToken ct = default);

    /// <summary>
    /// Explicit request wins, then the learner's saved preference, then the
    /// platform default. Always returns a country that exists and is enabled.
    /// </summary>
    Task<Country> ResolveAsync(string? requested, CancellationToken ct = default);

    /// <summary>Salary bands for one career, keyed by country code.</summary>
    Task<Dictionary<string, CareerSalaryBand>> BandsForAsync(
        IReadOnlyList<Guid> careerPathIds, string countryCode, CancellationToken ct = default);

    SalaryBandDto ToBandDto(Country country, CareerSalaryBand? band);

    /// <summary>
    /// Every career's band for one market, including the careers that have none
    /// yet. Admin needs the gaps as much as the figures: an empty row is the
    /// prompt to publish one, and is what the learner currently sees.
    /// </summary>
    Task<IReadOnlyList<AdminSalaryBandDto>> ListBandsForAdminAsync(
        string countryCode, CancellationToken ct = default);

    /// <summary>Creates or replaces one career's band in one market.</summary>
    Task<AdminSalaryBandDto> SaveBandAsync(
        Guid careerPathId, string countryCode, SalaryBandRequest request, CancellationToken ct = default);

    /// <summary>Withdraws a published band, returning that market to "no figures published".</summary>
    Task DeleteBandAsync(Guid careerPathId, string countryCode, CancellationToken ct = default);
}

public class LocationService(IAppDbContext db, ICurrentUser currentUser) : ILocationService
{
    /// <summary>
    /// Used when nothing else resolves. The seeded content quotes USA figures,
    /// so defaulting anywhere else would show "no data" to every new visitor.
    /// </summary>
    public const string DefaultCode = "US";

    public async Task<IReadOnlyList<CountryDto>> ListAsync(CancellationToken ct = default)
    {
        var countries = await db.Countries.AsNoTracking()
            .Where(c => c.IsEnabled)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .ToListAsync(ct);

        return countries.Select(c => new CountryDto(
            c.Code, c.Name, c.CurrencyCode, c.CurrencySymbol, c.Code == DefaultCode)).ToList();
    }

    public async Task<Country> ResolveAsync(string? requested, CancellationToken ct = default)
    {
        var enabled = await db.Countries.AsNoTracking().Where(c => c.IsEnabled).ToListAsync(ct);

        // An empty Countries table means the geography step has not run yet.
        // Returning a synthetic USA keeps every career screen working rather
        // than failing the whole request over a missing reference row.
        if (enabled.Count == 0) return Fallback();

        Country? Find(string? code) => code is null
            ? null
            : enabled.FirstOrDefault(c => c.Code.Equals(code.Trim(), StringComparison.OrdinalIgnoreCase));

        if (Find(requested) is { } explicitChoice) return explicitChoice;

        if (currentUser.UserId is { } userId)
        {
            var saved = await db.LearnerPreferences.AsNoTracking()
                .Where(p => p.UserId == userId)
                .Select(p => p.CountryCode)
                .FirstOrDefaultAsync(ct);

            if (Find(saved) is { } preferred) return preferred;
        }

        return Find(DefaultCode) ?? enabled[0];
    }

    public async Task<Dictionary<string, CareerSalaryBand>> BandsForAsync(
        IReadOnlyList<Guid> careerPathIds, string countryCode, CancellationToken ct = default)
    {
        if (careerPathIds.Count == 0) return [];

        var bands = await db.CareerSalaryBands.AsNoTracking()
            .Where(b => b.CountryCode == countryCode && careerPathIds.Contains(b.CareerPathId))
            .ToListAsync(ct);

        // Keyed by career, not country: one country per call.
        return bands.GroupBy(b => b.CareerPathId).ToDictionary(g => g.Key.ToString(), g => g.First());
    }

    public SalaryBandDto ToBandDto(Country country, CareerSalaryBand? band)
    {
        // A band with no figures is the same as no band: there is nothing to show.
        var hasData = band is not null && band.SalaryMax > 0 && !string.IsNullOrWhiteSpace(band.Source);

        if (!hasData)
        {
            return new SalaryBandDto(
                country.Code, country.Name, country.CurrencyCode, country.CurrencySymbol,
                0, 0, 0, 0, null, null, null, null, false,
                $"No salary figures have been published for {country.Name} yet.");
        }

        var b = band!;
        return new SalaryBandDto(
            country.Code, country.Name, b.CurrencyCode, country.CurrencySymbol,
            b.SalaryMin, b.SalaryMax, b.SeniorSalaryMin, b.SeniorSalaryMax,
            Range(country, b.SalaryMin, b.SalaryMax),
            b.SeniorSalaryMax > 0 ? Range(country, b.SeniorSalaryMin, b.SeniorSalaryMax) : null,
            b.AsOf == default ? null : b.AsOf.ToString("MMM yyyy"),
            b.Source,
            true,
            null);
    }

    public async Task<IReadOnlyList<AdminSalaryBandDto>> ListBandsForAdminAsync(
        string countryCode, CancellationToken ct = default)
    {
        var country = await ResolveAsync(countryCode, ct);

        var careers = await db.CareerPaths.AsNoTracking()
            .OrderBy(c => c.Rank)
            .Select(c => new { c.Id, c.Title, c.Slug })
            .ToListAsync(ct);

        var bands = await db.CareerSalaryBands.AsNoTracking()
            .Where(b => b.CountryCode == country.Code)
            .ToDictionaryAsync(b => b.CareerPathId, ct);

        return careers.Select(c =>
        {
            bands.TryGetValue(c.Id, out var band);
            return new AdminSalaryBandDto(
                c.Id, c.Title, c.Slug, country.Code,
                band?.CurrencyCode ?? country.CurrencyCode,
                band?.SalaryMin ?? 0, band?.SalaryMax ?? 0,
                band?.SeniorSalaryMin ?? 0, band?.SeniorSalaryMax ?? 0,
                band is null || band.AsOf == default ? null : band.AsOf.ToString("yyyy-MM-dd"),
                band?.Source ?? string.Empty,
                band is not null && band.SalaryMax > 0 && !string.IsNullOrWhiteSpace(band.Source));
        }).ToList();
    }

    public async Task<AdminSalaryBandDto> SaveBandAsync(
        Guid careerPathId, string countryCode, SalaryBandRequest request, CancellationToken ct = default)
    {
        var country = await ResolveAsync(countryCode, ct);

        if (!await db.CareerPaths.AnyAsync(c => c.Id == careerPathId, ct))
            throw AppException.NotFound("Career");

        if (request.SalaryMax <= 0 || request.SalaryMin < 0 || request.SalaryMin > request.SalaryMax)
            throw new AppException("Salary minimum must be zero or more and not above the maximum.");

        if (request.SeniorSalaryMax > 0 && request.SeniorSalaryMin > request.SeniorSalaryMax)
            throw new AppException("Senior salary minimum must not be above the senior maximum.");

        // A band without a source is indistinguishable from no band: ToBandDto
        // treats it as unpublished, so saving one would look like a silent
        // no-op to whoever just typed the figures in.
        if (string.IsNullOrWhiteSpace(request.Source))
            throw new AppException("A source is required — it is what makes the figures publishable.");

        var band = await db.CareerSalaryBands
            .FirstOrDefaultAsync(b => b.CareerPathId == careerPathId && b.CountryCode == country.Code, ct);

        if (band is null)
        {
            band = new CareerSalaryBand { CareerPathId = careerPathId, CountryCode = country.Code };
            db.CareerSalaryBands.Add(band);
        }

        band.CurrencyCode = country.CurrencyCode;
        band.SalaryMin = request.SalaryMin;
        band.SalaryMax = request.SalaryMax;
        band.SeniorSalaryMin = request.SeniorSalaryMin;
        band.SeniorSalaryMax = request.SeniorSalaryMax;
        band.Source = request.Source.Trim();
        band.AsOf = DateOnly.TryParse(request.AsOf, out var asOf) ? asOf : DateOnly.FromDateTime(DateTime.UtcNow);
        band.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        var career = await db.CareerPaths.AsNoTracking()
            .Where(c => c.Id == careerPathId)
            .Select(c => new { c.Title, c.Slug })
            .FirstAsync(ct);

        return new AdminSalaryBandDto(
            careerPathId, career.Title, career.Slug, country.Code, band.CurrencyCode,
            band.SalaryMin, band.SalaryMax, band.SeniorSalaryMin, band.SeniorSalaryMax,
            band.AsOf.ToString("yyyy-MM-dd"), band.Source, true);
    }

    public async Task DeleteBandAsync(Guid careerPathId, string countryCode, CancellationToken ct = default)
    {
        var band = await db.CareerSalaryBands
            .FirstOrDefaultAsync(b => b.CareerPathId == careerPathId && b.CountryCode == countryCode, ct);
        if (band is null) return;

        db.CareerSalaryBands.Remove(band);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>"$180K–$240K+", "£95K–£130K+", "₹45L–₹70L+".</summary>
    private static string Range(Country country, int min, int max) =>
        $"{Money(country, min)}–{Money(country, max)}+";

    private static string Money(Country country, int amount)
    {
        var divisor = country.ShortUnitDivisor <= 0 ? 1_000 : country.ShortUnitDivisor;
        if (amount < divisor) return $"{country.CurrencySymbol}{amount:N0}";

        var scaled = amount / (double)divisor;
        // One decimal only when it carries information: 1.5L, but 45L not 45.0L.
        var text = scaled % 1 == 0 ? scaled.ToString("0") : scaled.ToString("0.#");
        return $"{country.CurrencySymbol}{text}{country.ShortUnit}";
    }

    private static Country Fallback() => new()
    {
        Code = DefaultCode,
        Name = "United States",
        CurrencyCode = "USD",
        CurrencySymbol = "$",
        ShortUnit = "K",
        ShortUnitDivisor = 1_000
    };
}
