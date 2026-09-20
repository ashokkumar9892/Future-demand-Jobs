using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IResumeService
{
    Task<ResumeDto> GetAsync(CancellationToken ct = default);
    Task<ResumeDto> GenerateAsync(CancellationToken ct = default);
}

/// <summary>
/// Turns measured progress into resume lines. Every line carries an
/// <see cref="EvidenceKind"/>; the generator only ever emits Training,
/// PersonalProject or Certification. Professional experience is never invented —
/// the learner keeps sole authorship of that section.
/// </summary>
public class ResumeService(
    IAppDbContext db, ICurrentUser currentUser, IDateTimeProvider clock, IReadinessService readiness) : IResumeService
{
    public async Task<ResumeDto> GetAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var profile = await db.ResumeProfiles.AsNoTracking().Include(r => r.Items)
            .Where(r => r.UserId == userId).OrderByDescending(r => r.GeneratedAt).FirstOrDefaultAsync(ct);
        return profile is null ? await GenerateAsync(ct) : await ToDtoAsync(profile, ct);
    }

    public async Task<ResumeDto> GenerateAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
                   ?? throw AppException.NotFound("User");
        var studyProfile = await db.StudyProfiles.AsNoTracking().Include(p => p.TargetCareerPath)
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);
        var career = studyProfile?.TargetCareerPath;

        var report = career is null ? null : await readiness.GetAsync(career.Slug, ct);
        var readinessPercent = report?.Overall ?? 0;

        var items = new List<ResumeItem>();
        var order = 1;

        // --- Skills earned through completed training -------------------
        var completedCourses = await db.Courses.AsNoTracking()
            .Where(c => career == null || c.CareerPathId == career.Id)
            .Select(c => new
            {
                c.Title, c.SkillSlugs, c.EstimatedHours,
                LessonIds = c.Modules.SelectMany(m => m.Lessons).Select(l => l.Id).ToList()
            }).ToListAsync(ct);

        var completedLessonIds = (await db.LessonProgress.AsNoTracking()
            .Where(p => p.UserId == userId && p.Status == ProgressStatus.Completed)
            .Select(p => p.LessonId).ToListAsync(ct)).ToHashSet();

        var skillNames = await db.Skills.AsNoTracking().ToDictionaryAsync(s => s.Slug, s => s.Name, ct);

        foreach (var course in completedCourses)
        {
            if (course.LessonIds.Count == 0) continue;
            var share = (double)course.LessonIds.Count(completedLessonIds.Contains) / course.LessonIds.Count;
            if (share < 0.8) continue;

            var covered = Text.Csv(course.SkillSlugs)
                .Select(s => skillNames.TryGetValue(s, out var n) ? n : s).ToList();
            items.Add(new ResumeItem
            {
                Section = "Training",
                Text = $"{course.Title} — completed structured training ({course.EstimatedHours} hrs){(covered.Count > 0 ? $": {string.Join(", ", covered)}" : string.Empty)}",
                EvidenceKind = EvidenceKind.Training,
                Order = order++
            });
        }

        // --- Projects actually built ------------------------------------
        var builtProjects = await db.UserProjectProgress.AsNoTracking().Include(p => p.Project)
            .Where(p => p.UserId == userId && p.Status == ProgressStatus.Completed)
            .OrderBy(p => p.Project!.Order).ToListAsync(ct);

        foreach (var built in builtProjects.Where(b => b.Project is not null))
        {
            var bullets = Text.Lines(built.Project!.ResumeBullets);
            var text = bullets.Count > 0 ? bullets[0] : built.Project.Summary;
            items.Add(new ResumeItem
            {
                Section = "Projects",
                Text = $"{built.Project.Title} — {text} ({built.Project.TechStack})",
                EvidenceKind = EvidenceKind.PersonalProject,
                SourceRefType = "project",
                SourceRefId = built.ProjectId,
                Order = order++
            });
        }

        // --- Certifications actually passed -----------------------------
        var passed = await db.UserCertifications.AsNoTracking().Include(c => c.Certification)
            .Where(c => c.UserId == userId && c.Status == CertificationStatus.Passed).ToListAsync(ct);

        foreach (var cert in passed.Where(c => c.Certification is not null))
            items.Add(new ResumeItem
            {
                Section = "Certifications",
                Text = $"{cert.Certification!.Code} — {cert.Certification.Name} ({cert.Certification.Vendor})" +
                       (cert.CompletedDate is { } d ? $", {d:MMM yyyy}" : string.Empty),
                EvidenceKind = EvidenceKind.Certification,
                SourceRefType = "certification",
                SourceRefId = cert.CertificationId,
                Order = order++
            });

        // --- Skill keywords backed by measured progress -----------------
        if (career is not null && report is not null)
        {
            var strongDimensions = report.Dimensions.Where(d => d.Score >= 60).Select(d => d.Name).ToList();
            foreach (var name in strongDimensions)
                items.Add(new ResumeItem
                {
                    Section = "Skills",
                    Text = name,
                    EvidenceKind = EvidenceKind.Training,
                    Order = order++
                });
        }

        var headline = BuildHeadline(career?.Title, readinessPercent, items);
        var resume = new ResumeProfile
        {
            UserId = userId,
            Headline = headline,
            Summary = BuildSummary(user.YearsExperience, career?.Title, readinessPercent, items),
            GeneratedAt = clock.Now
        };
        foreach (var item in items) resume.Items.Add(item);

        db.ResumeProfiles.Add(resume);
        await db.SaveChangesAsync(ct);
        return await ToDtoAsync(resume, ct);
    }

    /// <summary>
    /// The title only changes once there is real evidence behind it. Below that
    /// bar the learner keeps their current, accurate title.
    /// </summary>
    private static string BuildHeadline(string? careerTitle, int readinessPercent, IReadOnlyCollection<ResumeItem> items)
    {
        var hasProjects = items.Any(i => i.EvidenceKind == EvidenceKind.PersonalProject);
        if (careerTitle is null) return ".NET / Azure Full Stack Developer";

        return (readinessPercent, hasProjects) switch
        {
            ( >= 75, true) => $".NET / Azure {careerTitle.Replace(" Architect", " Engineer")} — transitioning to {careerTitle}",
            ( >= 50, true) => ".NET / Azure / AI Solutions Engineer",
            ( >= 30, _) => ".NET / Azure Developer with applied AI engineering training",
            _ => ".NET / Azure Full Stack Developer"
        };
    }

    private static string BuildSummary(int years, string? careerTitle, int readinessPercent, IReadOnlyCollection<ResumeItem> items)
    {
        var projects = items.Count(i => i.EvidenceKind == EvidenceKind.PersonalProject);
        var certs = items.Count(i => i.EvidenceKind == EvidenceKind.Certification);
        var experience = years > 0 ? $"{years}+ years" : "Extensive";

        var sentence =
            $"{experience} of enterprise software engineering across .NET, Angular, SQL Server and cloud platforms. " +
            $"Currently building applied AI engineering depth toward {careerTitle ?? "a senior architecture role"} " +
            $"({readinessPercent}% through a structured programme";

        if (projects > 0) sentence += $", {projects} portfolio project{(projects == 1 ? string.Empty : "s")} delivered";
        if (certs > 0) sentence += $", {certs} certification{(certs == 1 ? string.Empty : "s")} passed";
        return sentence + ").";
    }

    private async Task<ResumeDto> ToDtoAsync(ResumeProfile profile, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var career = await db.StudyProfiles.AsNoTracking().Include(p => p.TargetCareerPath)
            .Where(p => p.UserId == userId).Select(p => p.TargetCareerPath).FirstOrDefaultAsync(ct);
        var report = career is null ? null : await readiness.GetAsync(career.Slug, ct);

        return new ResumeDto(
            profile.Headline,
            ".NET / Angular / SQL Server Full Stack Developer",
            profile.Summary,
            // Round-trip ISO, not a bare date: regenerating twice in one day
            // produced an identical string, so the only on-screen sign that
            // the button had done anything never changed.
            profile.GeneratedAt.ToString("O"),
            profile.Items.OrderBy(i => i.Section).ThenBy(i => i.Order)
                .Select(i => new ResumeItemDto(i.Id, i.Section, i.Text, i.EvidenceKind.ToString(), i.SkillSlug, i.Order))
                .ToList(),
            career is null ? [] : Text.Lines(career.ResumeKeywords),
            report?.Overall ?? 0,
            Disclaimers.Evidence);
    }
}
