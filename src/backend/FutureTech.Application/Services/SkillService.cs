using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface ISkillService
{
    Task<SkillMatrixDto> GetMatrixAsync(Guid? careerPathId, CancellationToken ct = default);
    Task<SkillMatrixDto> UpdateLevelAsync(SkillLevelUpdateRequest request, CancellationToken ct = default);
}

public class SkillService(IAppDbContext db, ICurrentUser currentUser, IDateTimeProvider clock) : ISkillService
{
    public async Task<SkillMatrixDto> GetMatrixAsync(Guid? careerPathId, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var targetCareerId = careerPathId ?? await db.StudyProfiles.AsNoTracking()
            .Where(p => p.UserId == userId).Select(p => p.TargetCareerPathId).FirstOrDefaultAsync(ct);

        var career = targetCareerId is { } id
            ? await db.CareerPaths.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct)
            : null;

        var skills = await db.Skills.AsNoTracking().OrderBy(s => s.Category).ThenBy(s => s.Name).ToListAsync(ct);
        var levels = await db.UserSkills.AsNoTracking()
            .Where(us => us.UserId == userId).ToDictionaryAsync(us => us.SkillId, us => us.CurrentLevel, ct);

        var targets = career is null
            ? new Dictionary<Guid, (int Target, string Importance)>()
            : await db.CareerSkills.AsNoTracking()
                .Where(cs => cs.CareerPathId == career.Id)
                .ToDictionaryAsync(cs => cs.SkillId, cs => (cs.TargetLevel, Text.Humanize(cs.Importance)), ct);

        var rows = skills.Select(s =>
        {
            var current = levels.TryGetValue(s.Id, out var lvl) ? lvl : s.BaselineLevel;
            var (target, importance) = targets.TryGetValue(s.Id, out var t) ? t : (0, "Not Required");
            return new SkillMatrixRowDto(
                s.Id, s.Name, s.Slug, Text.Humanize(s.Category),
                current, target, Math.Max(0, target - current), importance);
        })
        // Target-bearing skills first: the matrix should lead with what the
        // chosen career actually demands.
        .OrderByDescending(r => r.Target > 0)
        .ThenByDescending(r => r.Gap)
        .ThenBy(r => r.Name)
        .ToList();

        var withTarget = rows.Where(r => r.Target > 0).ToList();

        return new SkillMatrixDto(
            career?.Title,
            rows,
            rows.Count == 0 ? 0 : (int)Math.Round(rows.Average(r => (double)r.Current)),
            withTarget.Count == 0 ? 0 : (int)Math.Round(withTarget.Average(r => (double)r.Target)));
    }

    public async Task<SkillMatrixDto> UpdateLevelAsync(SkillLevelUpdateRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        if (!await db.Skills.AsNoTracking().AnyAsync(s => s.Id == request.SkillId, ct))
            throw AppException.NotFound("Skill");

        var record = await db.UserSkills.FirstOrDefaultAsync(us => us.UserId == userId && us.SkillId == request.SkillId, ct);
        if (record is null)
        {
            record = new UserSkill { UserId = userId, SkillId = request.SkillId };
            db.UserSkills.Add(record);
        }

        record.CurrentLevel = Math.Clamp(request.CurrentLevel, 0, 100);
        record.SelfAssessedAt = clock.Now;
        record.UpdatedAt = clock.Now;

        await db.SaveChangesAsync(ct);
        return await GetMatrixAsync(null, ct);
    }
}
