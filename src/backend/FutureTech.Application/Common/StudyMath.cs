using System.Globalization;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;

namespace FutureTech.Application.Common;

/// <summary>
/// The single place hours are turned into weeks, dates and daily targets, so the
/// dashboard, career cards, onboarding wizard and calendar never disagree.
/// </summary>
public static class StudyMath
{
    /// <summary>
    /// Share of a Balanced track's hours each mode schedules.
    /// FastTrack keeps only job-critical lessons; Deep adds optional depth.
    /// </summary>
    public static double TrackFactor(TrackMode mode) => mode switch
    {
        TrackMode.FastTrack => 0.58,
        TrackMode.Deep => 1.40,
        _ => 1.0
    };

    public static int HoursForTrack(int balancedHours, TrackMode mode) =>
        (int)Math.Round(balancedHours * TrackFactor(mode), MidpointRounding.AwayFromZero);

    public static int Weeks(double hoursRemaining, double weeklyHours)
    {
        if (weeklyHours <= 0) return 0;
        return Math.Max(1, (int)Math.Ceiling(hoursRemaining / weeklyHours));
    }

    public static double Months(int weeks) => Math.Round(weeks / 4.345, 1);

    public static DateOnly CompletionDate(DateOnly from, int weeks) => from.AddDays(weeks * 7);

    public static string MonthLabel(DateOnly date) =>
        date.ToDateTime(TimeOnly.MinValue).ToString("MMMM yyyy", CultureInfo.InvariantCulture);

    public static string DateLabel(DateOnly date) =>
        date.ToDateTime(TimeOnly.MinValue).ToString("dd MMM yyyy", CultureInfo.InvariantCulture);

    /// <summary>Weekly hours spread across the days the learner actually studies.</summary>
    public static double DailyHours(double weeklyHours, int studyDaysPerWeek) =>
        studyDaysPerWeek <= 0 ? 0 : Math.Round(weeklyHours / studyDaysPerWeek, 2);

    public static TrainingEstimateDto Estimate(
        int totalHours, double weeklyHours, int studyDaysPerWeek, DateOnly from, TrackMode mode)
    {
        var weeks = Weeks(totalHours, weeklyHours);
        var end = CompletionDate(from, weeks);
        return new TrainingEstimateDto(
            totalHours,
            Math.Round(weeklyHours, 2),
            weeks,
            Months(weeks),
            DateLabel(end),
            MonthLabel(end),
            DailyHours(weeklyHours, studyDaysPerWeek),
            mode.ToString(),
            Disclaimers.Estimate);
    }

    /// <summary>The "what if I study N hours/week" table shown next to every estimate.</summary>
    public static IReadOnlyList<PaceScenarioDto> PaceScenarios(int totalHours) =>
        new double[] { 5, 10, 12, 15, 20, 25 }
            .Select(h =>
            {
                var weeks = Weeks(totalHours, h);
                return new PaceScenarioDto(h, weeks, Months(weeks), $"{h:0.#} hrs/week");
            })
            .ToArray();
}
