using FutureTech.Domain.Common;

namespace FutureTech.Domain.Entities;

/// <summary>
/// A market the platform publishes figures for. A table rather than an enum so
/// an operator can add a country through Admin without a deployment.
/// </summary>
public class Country : Entity
{
    /// <summary>ISO 3166-1 alpha-2, upper case. "US", "GB", "IN".</summary>
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    /// <summary>ISO 4217. Drives how salary figures are formatted.</summary>
    public string CurrencyCode { get; set; } = string.Empty;
    public string CurrencySymbol { get; set; } = string.Empty;
    /// <summary>
    /// Thousands-style abbreviation used when shortening a figure. India quotes
    /// salaries in lakh, not thousands, so the unit is per country rather than
    /// a single hard-coded "K".
    /// </summary>
    public string ShortUnit { get; set; } = "K";
    public int ShortUnitDivisor { get; set; } = 1_000;
    public int SortOrder { get; set; }
    public bool IsEnabled { get; set; } = true;
}

/// <summary>
/// What one career pays in one country, in that country's own currency.
/// <para>
/// Figures are not converted between countries. A salary is a market fact, not
/// a unit conversion: applying an exchange rate to a US band would produce a
/// number no Indian or British employer would recognise. Each band therefore
/// carries its own <see cref="Source"/>, and a country with no band shows as
/// "no published figures" rather than as a guess.
/// </para>
/// </summary>
public class CareerSalaryBand : Entity
{
    public Guid CareerPathId { get; set; }
    public CareerPath? CareerPath { get; set; }

    /// <summary>Matches <see cref="Country.Code"/>.</summary>
    public string CountryCode { get; set; } = string.Empty;
    public string CurrencyCode { get; set; } = string.Empty;

    public int SalaryMin { get; set; }
    public int SalaryMax { get; set; }
    public int SeniorSalaryMin { get; set; }
    public int SeniorSalaryMax { get; set; }

    public DateOnly AsOf { get; set; }
    /// <summary>Where the figures came from. A band with no source is not shown as sourced data.</summary>
    public string Source { get; set; } = string.Empty;
    public string? Notes { get; set; }
}
