using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface ICareerService
{
    Task<IReadOnlyList<CareerSummaryDto>> ListAsync(string? search, string? sort, CancellationToken ct = default);
    Task<CareerDetailDto> GetAsync(string slug, CancellationToken ct = default);
    Task<IReadOnlyList<LadderStageDto>> GetLadderAsync(string slug, CancellationToken ct = default);
    Task<IReadOnlyList<SkillGapEntryDto>> GetSkillGapAsync(string slug, CancellationToken ct = default);
    Task<CareerSummaryDto> UpdateSalaryAsync(Guid id, SalaryUpdateRequest request, CancellationToken ct = default);
}

public class CareerService(IAppDbContext db, ICurrentUser currentUser, IDateTimeProvider clock) : ICareerService
{
    private const double DefaultWeeklyHours = 12;

    public async Task<IReadOnlyList<CareerSummaryDto>> ListAsync(string? search, string? sort, CancellationToken ct = default)
    {
        var query = db.CareerPaths.AsNoTracking().Include(c => c.CareerSkills).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(c =>
                c.Title.ToLower().Contains(term) ||
                c.Summary.ToLower().Contains(term) ||
                c.ResumeKeywords.ToLower().Contains(term));
        }

        query = sort switch
        {
            "salary" => query.OrderByDescending(c => c.SalaryMaxUsd),
            "hours" => query.OrderBy(c => c.EstimatedHours),
            _ => query.OrderBy(c => c.Rank)
        };

        var careers = await query.ToListAsync(ct);
        var userLevels = await CurrentUserLevelsAsync(ct);
        return careers.Select(c => ToSummary(c, userLevels)).ToList();
    }

    public async Task<CareerDetailDto> GetAsync(string slug, CancellationToken ct = default)
    {
        var career = await db.CareerPaths.AsNoTracking()
            .Include(c => c.CareerSkills).ThenInclude(cs => cs.Skill)
            .Include(c => c.LadderStages)
            .Include(c => c.CareerCertifications).ThenInclude(cc => cc.Certification)
            .Include(c => c.CareerProjects).ThenInclude(cp => cp.Project)
            .FirstOrDefaultAsync(c => c.Slug == slug, ct)
            ?? throw AppException.NotFound("Career path");

        var userLevels = await CurrentUserLevelsAsync(ct);
        var gap = BuildGap(career, userLevels);

        var courses = await db.Courses.AsNoTracking()
            .Where(c => c.CareerPathId == career.Id)
            .OrderBy(c => c.Order)
            .Select(c => new
            {
                c.Id, c.PhaseNumber, c.Title, c.Slug, c.Summary, c.EstimatedHours, c.Level,
                LessonCount = c.Modules.SelectMany(m => m.Lessons).Count()
            })
            .ToListAsync(ct);

        var completedLessonIds = await CompletedLessonIdsAsync(ct);
        var lessonsByCourse = await db.Lessons.AsNoTracking()
            .Where(l => l.Module!.Course!.CareerPathId == career.Id)
            .Select(l => new { CourseId = l.Module!.CourseId, l.Id })
            .ToListAsync(ct);

        var courseDtos = courses.Select(c => new CareerCourseDto(
            c.Id, c.PhaseNumber, c.Title, c.Slug, c.Summary, c.EstimatedHours,
            Text.Humanize(c.Level), c.LessonCount,
            lessonsByCourse.Count(l => l.CourseId == c.Id && completedLessonIds.Contains(l.Id)))).ToList();

        var (weeklyHours, studyDays, trackMode) = await PaceAsync(ct);
        var hours = StudyMath.HoursForTrack(career.EstimatedHours, trackMode);

        return new CareerDetailDto(
            ToSummary(career, userLevels),
            Text.Lines(career.ResumeKeywords),
            Text.Lines(career.Responsibilities),
            Text.Lines(career.InterviewFocus),
            gap.Where(g => g.Gap <= 0).OrderByDescending(g => g.CurrentLevel).ToList(),
            gap.Where(g => g.Gap > 0).OrderByDescending(g => g.Gap).ToList(),
            career.LadderStages.OrderBy(s => s.StageOrder).Select(ToLadderDto).ToList(),
            career.CareerCertifications.OrderBy(cc => cc.Priority)
                .Where(cc => cc.Certification is not null)
                .Select(cc => new CareerCertificationDto(
                    cc.Certification!.Id, cc.Certification.Code, cc.Certification.Name,
                    cc.Certification.Vendor, cc.Certification.Level,
                    cc.Certification.EstimatedPrepHours, cc.Certification.ExamCostUsd,
                    cc.Certification.OfficialUrl, cc.Priority)).ToList(),
            career.CareerProjects.OrderBy(cp => cp.Order)
                .Where(cp => cp.Project is not null)
                .Select(cp => new CareerProjectDto(
                    cp.Project!.Id, cp.Project.Title, cp.Project.Slug, cp.Project.Summary,
                    cp.Project.TechStack, cp.Project.EstimatedHours)).ToList(),
            courseDtos,
            hours,
            StudyMath.Estimate(hours, weeklyHours, studyDays, clock.Today, trackMode));
    }

    public async Task<IReadOnlyList<LadderStageDto>> GetLadderAsync(string slug, CancellationToken ct = default)
    {
        var careerId = await db.CareerPaths.AsNoTracking()
            .Where(c => c.Slug == slug).Select(c => (Guid?)c.Id).FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Career path");

        var stages = await db.LadderStages.AsNoTracking()
            .Where(s => s.CareerPathId == careerId)
            .OrderBy(s => s.StageOrder)
            .ToListAsync(ct);
        if (stages.Count == 0) throw AppException.NotFound("Career ladder");
        return stages.Select(ToLadderDto).ToList();
    }

    public async Task<IReadOnlyList<SkillGapEntryDto>> GetSkillGapAsync(string slug, CancellationToken ct = default)
    {
        var career = await db.CareerPaths.AsNoTracking()
            .Include(c => c.CareerSkills).ThenInclude(cs => cs.Skill)
            .FirstOrDefaultAsync(c => c.Slug == slug, ct)
            ?? throw AppException.NotFound("Career path");
        return BuildGap(career, await CurrentUserLevelsAsync(ct));
    }

    public async Task<CareerSummaryDto> UpdateSalaryAsync(Guid id, SalaryUpdateRequest request, CancellationToken ct = default)
    {
        var career = await db.CareerPaths.Include(c => c.CareerSkills)
            .FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw AppException.NotFound("Career path");

        if (request.SalaryMinUsd <= 0 || request.SalaryMaxUsd < request.SalaryMinUsd)
            throw new AppException("Salary range is invalid.");

        db.SalaryRevisions.Add(new SalaryRevision
        {
            CareerPathId = career.Id,
            OldMinUsd = career.SalaryMinUsd,
            OldMaxUsd = career.SalaryMaxUsd,
            NewMinUsd = request.SalaryMinUsd,
            NewMaxUsd = request.SalaryMaxUsd,
            Source = request.Source,
            ChangedByUserId = currentUser.UserId
        });

        career.SalaryMinUsd = request.SalaryMinUsd;
        career.SalaryMaxUsd = request.SalaryMaxUsd;
        career.SeniorSalaryMinUsd = request.SeniorSalaryMinUsd;
        career.SeniorSalaryMaxUsd = request.SeniorSalaryMaxUsd;
        career.SalarySource = request.Source;
        career.SalaryAsOf = clock.Today;
        if (!string.IsNullOrWhiteSpace(request.TwoHundredKPotential))
            career.TwoHundredKPotential = request.TwoHundredKPotential;
        career.UpdatedAt = clock.Now;

        await db.SaveChangesAsync(ct);
        return ToSummary(career, await CurrentUserLevelsAsync(ct));
    }

    // ----- helpers -------------------------------------------------------

    private async Task<Dictionary<Guid, int>> CurrentUserLevelsAsync(CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
        {
            // Anonymous visitors see the persona baseline so career cards still
            // communicate "skills you already have" before signing in.
            return await db.Skills.AsNoTracking().ToDictionaryAsync(s => s.Id, s => s.BaselineLevel, ct);
        }
        return await db.UserSkills.AsNoTracking()
            .Where(us => us.UserId == userId)
            .ToDictionaryAsync(us => us.SkillId, us => us.CurrentLevel, ct);
    }

    private async Task<HashSet<Guid>> CompletedLessonIdsAsync(CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId) return [];
        var ids = await db.LessonProgress.AsNoTracking()
            .Where(p => p.UserId == userId && p.Status == ProgressStatus.Completed)
            .Select(p => p.LessonId).ToListAsync(ct);
        return ids.ToHashSet();
    }

    private async Task<(double WeeklyHours, int StudyDays, TrackMode Mode)> PaceAsync(CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId) return (DefaultWeeklyHours, 7, TrackMode.Balanced);
        var profile = await db.StudyProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);
        if (profile is null) return (DefaultWeeklyHours, 7, TrackMode.Balanced);
        var days = Math.Max(1, Text.Csv(profile.StudyDays).Count);
        var weekly = profile.WeeklyHours > 0 ? profile.WeeklyHours : DefaultWeeklyHours;
        return (weekly, days, profile.TrackMode);
    }

    private static List<SkillGapEntryDto> BuildGap(CareerPath career, IReadOnlyDictionary<Guid, int> levels) =>
        career.CareerSkills
            .Where(cs => cs.Skill is not null)
            .Select(cs =>
            {
                var current = levels.TryGetValue(cs.SkillId, out var lvl) ? lvl : 0;
                return new SkillGapEntryDto(
                    cs.SkillId, cs.Skill!.Name, cs.Skill.Slug, Text.Humanize(cs.Skill.Category),
                    Text.Humanize(cs.Importance), current, cs.TargetLevel,
                    Math.Max(0, cs.TargetLevel - current));
            })
            .OrderBy(s => s.Importance)
            .ThenByDescending(s => s.Gap)
            .ToList();

    private static LadderStageDto ToLadderDto(LadderStage s) => new(
        s.StageOrder, s.Title, s.RoleTitle, s.Description, s.SalaryMinUsd, s.SalaryMaxUsd,
        s.DurationMonths, Text.Lines(s.Milestones), s.IsCurrentPosition);

    private static CareerSummaryDto ToSummary(CareerPath c, IReadOnlyDictionary<Guid, int> levels)
    {
        var have = 0;
        var need = 0;
        foreach (var cs in c.CareerSkills)
        {
            var current = levels.TryGetValue(cs.SkillId, out var lvl) ? lvl : 0;
            if (current >= cs.TargetLevel) have++; else need++;
        }

        return new CareerSummaryDto(
            c.Id, c.Rank, c.Title, c.Slug, c.Summary,
            c.SalaryMinUsd, c.SalaryMaxUsd, c.SeniorSalaryMinUsd, c.SeniorSalaryMaxUsd,
            c.TwoHundredKPotential,
            Text.Humanize(c.DemandOutlook), c.DemandNotes,
            Text.Humanize(c.AiReplacementRisk), c.AiRiskNotes,
            Text.Humanize(c.Difficulty),
            c.EstimatedHours,
            StudyMath.Weeks(c.EstimatedHours, DefaultWeeklyHours),
            c.IsPrimaryRecommended,
            have, need,
            StudyMath.DateLabel(c.SalaryAsOf), c.SalarySource);
    }
}
