using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IDashboardService
{
    Task<DashboardDto> GetAsync(CancellationToken ct = default);
}

public class DashboardService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IDateTimeProvider clock,
    IReadinessService readiness,
    ISkillService skills,
    IGamificationService gamification,
    IStudyPlannerService planner) : IDashboardService
{
    public async Task<DashboardDto> GetAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
                   ?? throw AppException.NotFound("User");
        var profile = await db.StudyProfiles.AsNoTracking().Include(p => p.TargetCareerPath)
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);
        var career = profile?.TargetCareerPath;

        var courses = await db.Courses.AsNoTracking()
            .Where(c => career == null || c.CareerPathId == career.Id)
            .Select(c => new { c.Id, c.EstimatedHours, LessonIds = c.Modules.SelectMany(m => m.Lessons).Select(l => l.Id).ToList() })
            .ToListAsync(ct);

        var completedLessonIds = (await db.LessonProgress.AsNoTracking()
            .Where(p => p.UserId == userId && p.Status == ProgressStatus.Completed)
            .Select(p => p.LessonId).ToListAsync(ct)).ToHashSet();

        var trackMode = profile?.TrackMode ?? TrackMode.Balanced;
        var totalHours = courses.Sum(c => StudyMath.HoursForTrack(c.EstimatedHours, trackMode));
        var hoursCompleted = (int)Math.Round(courses.Sum(c =>
        {
            if (c.LessonIds.Count == 0) return 0d;
            var share = (double)c.LessonIds.Count(completedLessonIds.Contains) / c.LessonIds.Count;
            return StudyMath.HoursForTrack(c.EstimatedHours, trackMode) * share;
        }));

        var coursesCompleted = courses.Count(c => c.LessonIds.Count > 0 && c.LessonIds.All(completedLessonIds.Contains));
        var totalProjects = await db.Projects.AsNoTracking().CountAsync(ct);
        var projectsCompleted = await db.UserProjectProgress.AsNoTracking()
            .CountAsync(p => p.UserId == userId && p.Status == ProgressStatus.Completed, ct);
        var practiceAnswered = await db.PracticeAttempts.AsNoTracking().CountAsync(a => a.UserId == userId, ct);

        var progressPercent = totalHours == 0 ? 0 : (int)Math.Round(hoursCompleted * 100.0 / totalHours);

        var readinessRings = new List<ProgressRingDto>();
        if (career is not null)
        {
            var report = await readiness.GetAsync(career.Slug, ct);
            readinessRings.Add(new ProgressRingDto("Overall readiness", report.Overall, report.VerdictLabel));
            readinessRings.AddRange(report.Dimensions
                .OrderByDescending(d => d.Weight).Take(4)
                .Select(d => new ProgressRingDto(d.Name, d.Score, null)));
        }

        var matrix = await skills.GetMatrixAsync(career?.Id, ct);
        var radar = matrix.Rows.Where(r => r.Target > 0)
            .OrderByDescending(r => r.Target).Take(8)
            .Select(r => new SkillRadarPointDto(r.Name, r.Current, r.Target)).ToList();

        var weeklyHours = await WeeklyHoursAsync(userId, profile?.WeeklyHours ?? 12, ct);
        var todayDay = await planner.GetTodayAsync(ct);
        var today = todayDay?.Items
            .Select(i => new DashboardTodayItemDto(i.Title, i.ActivityType, i.Minutes, i.DeepLink, i.Status))
            .ToList() ?? [];

        var nextUp = await NextUpAsync(userId, career?.Id, completedLessonIds, ct);
        var currentProject = await CurrentProjectAsync(userId, ct);
        var upcomingCert = await UpcomingCertificationAsync(userId, career?.Id, ct);
        var game = await gamification.GetAsync(ct);

        var remainingHours = Math.Max(0, totalHours - hoursCompleted);
        var weekly = profile?.WeeklyHours ?? 12;
        var eta = StudyMath.CompletionDate(clock.Today, StudyMath.Weeks(remainingHours, weekly));

        return new DashboardDto(
            Greeting(clock.Now),
            user.DisplayName,
            career?.Title,
            career?.Slug,
            career is null ? "—" : Text.SalaryRange(career.SalaryMinUsd, career.SalaryMaxUsd),
            remainingHours == 0 ? "Track complete" : StudyMath.MonthLabel(eta),
            progressPercent,
            game.StudyStreakDays,
            hoursCompleted,
            totalHours,
            coursesCompleted,
            courses.Count,
            projectsCompleted,
            totalProjects,
            practiceAnswered,
            readinessRings,
            radar,
            weeklyHours,
            today,
            nextUp,
            currentProject,
            upcomingCert,
            game);
    }

    private static string Greeting(DateTimeOffset now) => now.LocalDateTime.Hour switch
    {
        < 12 => "Good morning",
        < 18 => "Good afternoon",
        _ => "Good evening"
    };

    /// <summary>Planned vs actual for the last eight weeks, Monday-aligned.</summary>
    private async Task<IReadOnlyList<WeeklyHoursPointDto>> WeeklyHoursAsync(Guid userId, double weeklyTarget, CancellationToken ct)
    {
        var start = clock.Today.AddDays(-7 * 7);
        start = start.AddDays(-(((int)start.DayOfWeek + 6) % 7));

        var sessions = await db.StudySessions.AsNoTracking()
            .Where(s => s.UserId == userId && s.OnDate >= start)
            .Select(s => new { s.OnDate, s.Minutes }).ToListAsync(ct);

        var points = new List<WeeklyHoursPointDto>();
        for (var i = 0; i < 8; i++)
        {
            var weekStart = start.AddDays(i * 7);
            var weekEnd = weekStart.AddDays(6);
            var minutes = sessions.Where(s => s.OnDate >= weekStart && s.OnDate <= weekEnd).Sum(s => s.Minutes);
            points.Add(new WeeklyHoursPointDto(
                weekStart.ToString("dd MMM"),
                Math.Round(weeklyTarget, 1),
                Math.Round(minutes / 60.0, 1)));
        }
        return points;
    }

    private async Task<NextUpDto> NextUpAsync(Guid userId, Guid? careerId, HashSet<Guid> completed, CancellationToken ct)
    {
        var nextLesson = await db.Lessons.AsNoTracking()
            .Where(l => careerId == null || l.Module!.Course!.CareerPathId == careerId)
            .OrderBy(l => l.Module!.Course!.Order).ThenBy(l => l.Module!.Order).ThenBy(l => l.Order)
            .Select(l => new { l.Id, l.Title, l.Slug }).ToListAsync(ct);
        var lesson = nextLesson.FirstOrDefault(l => !completed.Contains(l.Id));

        var attempted = (await db.PracticeAttempts.AsNoTracking()
            .Where(a => a.UserId == userId).Select(a => a.PracticeQuestionId).Distinct().ToListAsync(ct)).ToHashSet();
        var practice = (await db.PracticeQuestions.AsNoTracking()
            .Where(q => careerId == null || q.CareerPathId == careerId || q.CareerPathId == null)
            .OrderBy(q => q.Mode).Select(q => new { q.Id, q.Prompt }).ToListAsync(ct))
            .FirstOrDefault(q => !attempted.Contains(q.Id));

        var startedProjects = await db.UserProjectProgress.AsNoTracking()
            .Where(p => p.UserId == userId && p.Status == ProgressStatus.Completed)
            .Select(p => p.ProjectId).ToListAsync(ct);
        var project = await db.Projects.AsNoTracking()
            .Where(p => !startedProjects.Contains(p.Id))
            .OrderBy(p => p.Order).Select(p => new { p.Title, p.Slug }).FirstOrDefaultAsync(ct);

        return new NextUpDto(
            lesson?.Title, lesson?.Slug,
            practice?.Prompt, practice?.Id,
            project?.Title, project?.Slug);
    }

    private async Task<CurrentProjectDto?> CurrentProjectAsync(Guid userId, CancellationToken ct)
    {
        var record = await db.UserProjectProgress.AsNoTracking().Include(p => p.Project)
            .Where(p => p.UserId == userId && p.Status == ProgressStatus.InProgress)
            .OrderByDescending(p => p.UpdatedAt ?? p.CreatedAt).FirstOrDefaultAsync(ct);
        if (record?.Project is null) return null;

        var total = await db.ProjectMilestones.AsNoTracking().CountAsync(m => m.ProjectId == record.ProjectId, ct);
        var done = await db.UserProjectMilestones.AsNoTracking().CountAsync(m => m.UserProjectProgressId == record.Id, ct);

        return new CurrentProjectDto(
            record.Project.Id, record.Project.Title, record.Project.Slug, record.PercentComplete, done, total);
    }

    private async Task<UpcomingCertificationDto?> UpcomingCertificationAsync(Guid userId, Guid? careerId, CancellationToken ct)
    {
        var planned = await db.UserCertifications.AsNoTracking().Include(c => c.Certification)
            .Where(c => c.UserId == userId && c.Status != CertificationStatus.Passed)
            .OrderBy(c => c.TargetDate ?? DateOnly.MaxValue).FirstOrDefaultAsync(ct);

        if (planned?.Certification is not null)
            return new UpcomingCertificationDto(
                planned.Certification.Id, planned.Certification.Code, planned.Certification.Name,
                planned.Status.ToString(), planned.TargetDate?.ToString("yyyy-MM-dd"),
                planned.Certification.EstimatedPrepHours);

        if (careerId is not { } id) return null;

        // Nothing planned yet: surface the highest-priority certification for the target role.
        var recommended = await db.CareerCertifications.AsNoTracking().Include(cc => cc.Certification)
            .Where(cc => cc.CareerPathId == id).OrderBy(cc => cc.Priority).FirstOrDefaultAsync(ct);

        return recommended?.Certification is null ? null : new UpcomingCertificationDto(
            recommended.Certification.Id, recommended.Certification.Code, recommended.Certification.Name,
            nameof(CertificationStatus.NotStarted), null, recommended.Certification.EstimatedPrepHours);
    }
}
