using System.Globalization;
using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IStudyPlannerService
{
    Task<StudyProfileDto> GetProfileAsync(CancellationToken ct = default);
    Task<StudyProfileDto> UpdateProfileAsync(StudyProfileUpdateRequest request, CancellationToken ct = default);
    Task<StudyCalculationDto> CalculateAsync(StudyCalculationRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<StudyPlanDayDto>> GetPlanAsync(DateOnly? from, DateOnly? to, CancellationToken ct = default);
    Task<IReadOnlyList<StudyPlanDayDto>> GeneratePlanAsync(GeneratePlanRequest request, CancellationToken ct = default);
    Task<StudyPlanDayDto?> GetTodayAsync(CancellationToken ct = default);
    Task<StartTodayResponse> StartTodayAsync(CancellationToken ct = default);
    Task<StudyPlanItemDto> CompleteItemAsync(Guid itemId, CancellationToken ct = default);
    Task<CalendarMonthDto> GetMonthAsync(int year, int month, CancellationToken ct = default);
}

public class StudyPlannerService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IDateTimeProvider clock,
    IGamificationService gamification,
    IStudyPlanGenerator generator) : IStudyPlannerService
{
    public async Task<StudyProfileDto> GetProfileAsync(CancellationToken ct = default) =>
        ToDto(await RequireProfileAsync(ct));

    public async Task<StudyProfileDto> UpdateProfileAsync(StudyProfileUpdateRequest request, CancellationToken ct = default)
    {
        var profile = await RequireProfileAsync(ct, tracked: true);

        profile.WeekdayHours = Clamp(request.WeekdayHours);
        profile.SaturdayHours = Clamp(request.SaturdayHours);
        profile.SundayHours = Clamp(request.SundayHours);
        profile.StudyDays = request.StudyDays.Count > 0
            ? string.Join(',', request.StudyDays.Select(d => d.Trim()).Where(d => d.Length > 0))
            : profile.StudyDays;
        profile.TargetCompletionDate = ParseDate(request.TargetCompletionDate);
        profile.TargetCareerPathId = request.TargetCareerPathId ?? profile.TargetCareerPathId;
        profile.DesiredSalaryUsd = request.DesiredSalaryUsd > 0 ? request.DesiredSalaryUsd : profile.DesiredSalaryUsd;
        profile.CurrentSkillLevel = Math.Clamp(request.CurrentSkillLevel, 0, 100);
        profile.TrackMode = Text.ParseEnum(request.TrackMode, profile.TrackMode);
        profile.UpdatedAt = clock.Now;
        if (request.CompleteOnboarding && profile.OnboardingCompletedAt is null)
            profile.OnboardingCompletedAt = clock.Now;

        // Lives on the user, not the study profile, because the resume summary
        // reads it from there. Null means "not supplied by this caller", which
        // keeps a partial profile save from wiping a figure already set.
        if (request.YearsExperience is { } years)
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == profile.UserId, ct);
            if (user is not null) user.YearsExperience = Math.Clamp(years, 0, 60);
        }

        await db.SaveChangesAsync(ct);

        // Study capacity or target changed: the schedule ahead is now stale.
        await generator.GenerateAsync(profile.UserId, clock.Today, 26, ct);
        return ToDto(profile);
    }

    public async Task<StudyCalculationDto> CalculateAsync(StudyCalculationRequest request, CancellationToken ct = default)
    {
        var profile = currentUser.IsAuthenticated ? await RequireProfileAsync(ct) : null;
        var careerId = request.CareerPathId ?? profile?.TargetCareerPathId;

        var career = careerId is { } id
            ? await db.CareerPaths.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct)
            : await db.CareerPaths.AsNoTracking().OrderBy(c => c.Rank).FirstOrDefaultAsync(c => c.IsPrimaryRecommended, ct);
        if (career is null) throw AppException.NotFound("Career path");

        var mode = Text.ParseEnum(request.TrackMode, profile?.TrackMode ?? TrackMode.Balanced);
        var weekly = request.WeeklyHours > 0 ? request.WeeklyHours : profile?.WeeklyHours ?? 12;
        var studyDays = profile is null ? 7 : Math.Max(1, Text.Csv(profile.StudyDays).Count);

        var courses = await db.Courses.AsNoTracking()
            .Where(c => c.CareerPathId == career.Id)
            .OrderBy(c => c.Order)
            .Select(c => new { c.Id, c.Title, c.EstimatedHours, LessonIds = c.Modules.SelectMany(m => m.Lessons).Select(l => l.Id).ToList() })
            .ToListAsync(ct);

        var completedLessons = await CompletedLessonIdsAsync(ct);

        var breakdown = courses.Select(c =>
        {
            var hours = StudyMath.HoursForTrack(c.EstimatedHours, mode);
            var share = c.LessonIds.Count == 0 ? 0 : (double)c.LessonIds.Count(completedLessons.Contains) / c.LessonIds.Count;
            return new TrackBreakdownDto(c.Title, hours, (int)Math.Round(hours * share));
        }).ToList();

        var totalHours = breakdown.Sum(b => b.Hours);
        if (totalHours == 0) totalHours = StudyMath.HoursForTrack(career.EstimatedHours, mode);

        var completedHours = breakdown.Sum(b => b.CompletedHours);
        var remaining = Math.Max(0, totalHours - completedHours);
        var weeks = StudyMath.Weeks(remaining, weekly);
        var end = StudyMath.CompletionDate(clock.Today, weeks);

        return new StudyCalculationDto(
            career.Title,
            mode.ToString(),
            totalHours,
            completedHours,
            remaining,
            Math.Round(weekly, 2),
            StudyMath.DailyHours(weekly, studyDays),
            weeks,
            weeks * 7,
            StudyMath.Months(weeks),
            StudyMath.DateLabel(end),
            StudyMath.MonthLabel(end),
            breakdown,
            StudyMath.PaceScenarios(remaining == 0 ? totalHours : remaining),
            Disclaimers.Estimate);
    }

    public async Task<IReadOnlyList<StudyPlanDayDto>> GetPlanAsync(DateOnly? from, DateOnly? to, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var start = from ?? clock.Today;
        var end = to ?? start.AddDays(13);

        var days = await db.StudyPlanDays.AsNoTracking()
            .Include(d => d.Items)
            .Where(d => d.UserId == userId && d.OnDate >= start && d.OnDate <= end)
            .OrderBy(d => d.OnDate)
            .ToListAsync(ct);

        return days.Select(ToDayDto).ToList();
    }

    public async Task<IReadOnlyList<StudyPlanDayDto>> GeneratePlanAsync(GeneratePlanRequest request, CancellationToken ct = default)
    {
        var profile = await RequireProfileAsync(ct, tracked: true);
        var from = ParseDate(request.FromDate) ?? clock.Today;
        var weeks = Math.Clamp(request.Weeks <= 0 ? 12 : request.Weeks, 1, 52);
        await generator.GenerateAsync(profile.UserId, from, weeks, ct);
        return await GetPlanAsync(from, from.AddDays(weeks * 7 - 1), ct);
    }

    public async Task<StudyPlanDayDto?> GetTodayAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var day = await db.StudyPlanDays.AsNoTracking().Include(d => d.Items)
            .FirstOrDefaultAsync(d => d.UserId == userId && d.OnDate == clock.Today, ct);
        return day is null ? null : ToDayDto(day);
    }

    public async Task<StartTodayResponse> StartTodayAsync(CancellationToken ct = default)
    {
        var profile = await RequireProfileAsync(ct, tracked: true);
        var userId = profile.UserId;

        var day = await db.StudyPlanDays.Include(d => d.Items)
            .FirstOrDefaultAsync(d => d.UserId == userId && d.OnDate == clock.Today, ct);

        if (day is null)
        {
            // Nothing scheduled yet (fresh account, or a rest day): build the
            // window on demand so the button is never a dead end.
            await generator.GenerateAsync(profile.UserId, clock.Today, 12, ct);
            day = await db.StudyPlanDays.Include(d => d.Items)
                .FirstOrDefaultAsync(d => d.UserId == userId && d.OnDate == clock.Today, ct);
        }

        if (day is null)
            return new StartTodayResponse(null, null, null,
                "Today is a scheduled rest day. Open Calendar to pull work forward.");

        var next = day.Items.Where(i => i.Status != PlanStatus.Completed).OrderBy(i => i.Order).FirstOrDefault();
        if (next is null)
            return new StartTodayResponse(null, null, ToDayDto(day),
                "Today's plan is complete. Well done — the streak is safe.");

        if (next.Status == PlanStatus.NotStarted || next.Status == PlanStatus.Scheduled)
        {
            next.Status = PlanStatus.InProgress;
            day.Status = PlanStatus.InProgress;
            await db.SaveChangesAsync(ct);
        }

        return new StartTodayResponse(ToItemDto(next), next.DeepLink, ToDayDto(day), $"Starting: {next.Title}");
    }

    public async Task<StudyPlanItemDto> CompleteItemAsync(Guid itemId, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var item = await db.StudyPlanItems.Include(i => i.Day).ThenInclude(d => d!.Items)
            .FirstOrDefaultAsync(i => i.Id == itemId && i.Day!.UserId == userId, ct)
            ?? throw AppException.NotFound("Plan item");

        if (item.Status != PlanStatus.Completed)
        {
            item.Status = PlanStatus.Completed;
            item.CompletedAt = clock.Now;
            gamification.Record(userId, 10, $"Plan item: {item.Title}", item.RefType, item.RefId, item.Minutes, item.ActivityType);
        }

        var day = item.Day!;
        day.Status = day.Items.All(i => i.Status == PlanStatus.Completed) ? PlanStatus.Completed : PlanStatus.InProgress;

        await db.SaveChangesAsync(ct);
        await gamification.EvaluateBadgesAsync(userId, ct);
        await db.SaveChangesAsync(ct);
        return ToItemDto(item);
    }

    public async Task<CalendarMonthDto> GetMonthAsync(int year, int month, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var first = new DateOnly(year, month, 1);
        var last = first.AddMonths(1).AddDays(-1);

        var days = await db.StudyPlanDays.AsNoTracking().Include(d => d.Items)
            .Where(d => d.UserId == userId && d.OnDate >= first && d.OnDate <= last)
            .ToListAsync(ct);

        var byDate = days.ToDictionary(d => d.OnDate);
        var weeks = new List<CalendarWeekDto>();

        // Weeks run Monday-first, clipped to the month, matching the UI grid.
        var cursor = first.AddDays(-(((int)first.DayOfWeek + 6) % 7));
        var weekNumber = 1;
        while (cursor <= last)
        {
            var weekDays = new List<CalendarDayDto>();
            for (var i = 0; i < 7; i++)
            {
                var date = cursor.AddDays(i);
                if (date < first || date > last) continue;
                if (byDate.TryGetValue(date, out var planned))
                    weekDays.Add(new CalendarDayDto(
                        date.ToString("yyyy-MM-dd"),
                        EffectiveStatus(planned, clock.Today).ToString(),
                        planned.TargetMinutes,
                        planned.Items.Where(i => i.Status == PlanStatus.Completed).Sum(i => i.Minutes),
                        planned.Items.Count,
                        planned.Items.OrderBy(i => i.Order).Select(i => i.Title).Take(4).ToList()));
                else
                    weekDays.Add(new CalendarDayDto(date.ToString("yyyy-MM-dd"), nameof(PlanStatus.NotStarted), 0, 0, 0, []));
            }

            if (weekDays.Count > 0)
            {
                var theme = days
                    .Where(d => d.OnDate >= cursor && d.OnDate < cursor.AddDays(7))
                    .SelectMany(d => d.Items)
                    .GroupBy(i => i.Title.Split(':')[0].Trim())
                    .OrderByDescending(g => g.Count())
                    .Select(g => g.Key)
                    .FirstOrDefault() ?? "Open";

                weeks.Add(new CalendarWeekDto(
                    weekNumber, $"Week {weekNumber}", weekDays[0].OnDate, weekDays[^1].OnDate, theme, weekDays));
                weekNumber++;
            }
            cursor = cursor.AddDays(7);
        }

        return new CalendarMonthDto(
            year, month,
            new DateTime(year, month, 1).ToString("MMMM yyyy", CultureInfo.InvariantCulture),
            weeks,
            days.Sum(d => d.TargetMinutes),
            days.SelectMany(d => d.Items).Where(i => i.Status == PlanStatus.Completed).Sum(i => i.Minutes));
    }

    // ----- helpers -------------------------------------------------------

    private static double Clamp(double hours) => Math.Clamp(Math.Round(hours, 2), 0, 16);

    private static DateOnly? ParseDate(string? value) =>
        DateOnly.TryParse(value, CultureInfo.InvariantCulture, out var date) ? date : null;

    private static PlanStatus EffectiveStatus(StudyPlanDay day, DateOnly today)
    {
        if (day.Status == PlanStatus.Completed) return PlanStatus.Completed;
        if (day.OnDate < today && day.Items.Any(i => i.Status != PlanStatus.Completed)) return PlanStatus.Late;
        return day.Status;
    }

    private async Task<StudyProfile> RequireProfileAsync(CancellationToken ct, bool tracked = false)
    {
        var userId = currentUser.RequireUserId();
        var query = tracked ? db.StudyProfiles : db.StudyProfiles.AsNoTracking();
        var profile = await query.Include(p => p.TargetCareerPath).FirstOrDefaultAsync(p => p.UserId == userId, ct);
        if (profile is not null) return profile;

        profile = new StudyProfile { UserId = userId };
        db.StudyProfiles.Add(profile);
        await db.SaveChangesAsync(ct);
        return profile;
    }

    private async Task<HashSet<Guid>> CompletedLessonIdsAsync(CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId) return [];
        var ids = await db.LessonProgress.AsNoTracking()
            .Where(p => p.UserId == userId && p.Status == ProgressStatus.Completed)
            .Select(p => p.LessonId).ToListAsync(ct);
        return ids.ToHashSet();
    }

    private StudyProfileDto ToDto(StudyProfile p) => new(
        p.WeekdayHours, p.SaturdayHours, p.SundayHours, Text.Csv(p.StudyDays),
        p.TargetCompletionDate?.ToString("yyyy-MM-dd"), p.TargetCareerPathId,
        p.TargetCareerPath?.Title, p.DesiredSalaryUsd, p.CurrentSkillLevel,
        p.TrackMode.ToString(), p.WeeklyHours, p.OnboardingCompletedAt is not null);

    private StudyPlanDayDto ToDayDto(StudyPlanDay d) => new(
        d.Id, d.OnDate.ToString("yyyy-MM-dd"), d.OnDate.DayOfWeek.ToString(),
        EffectiveStatus(d, clock.Today).ToString(), d.TargetMinutes,
        d.Items.Where(i => i.Status == PlanStatus.Completed).Sum(i => i.Minutes),
        d.Items.OrderBy(i => i.Order).Select(ToItemDto).ToList());

    private static StudyPlanItemDto ToItemDto(StudyPlanItem i) => new(
        i.Id, i.Order, i.ActivityType.ToString(), i.Title, i.Minutes,
        i.RefType, i.RefId, i.DeepLink, i.Status.ToString());
}
