using System.Globalization;
using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface ICertificationService
{
    Task<IReadOnlyList<CertificationDto>> ListAsync(CancellationToken ct = default);
    Task<CertificationDto> UpdateMineAsync(Guid certificationId, UserCertificationUpdateRequest request, CancellationToken ct = default);
}

public class CertificationService(
    IAppDbContext db, ICurrentUser currentUser, IDateTimeProvider clock, IGamificationService gamification) : ICertificationService
{
    public async Task<IReadOnlyList<CertificationDto>> ListAsync(CancellationToken ct = default)
    {
        var certifications = await db.Certifications.AsNoTracking()
            .OrderBy(c => c.Vendor).ThenBy(c => c.Code).ToListAsync(ct);

        var mine = new Dictionary<Guid, UserCertification>();
        var recommended = new HashSet<Guid>();

        if (currentUser.UserId is { } userId)
        {
            mine = await db.UserCertifications.AsNoTracking()
                .Where(c => c.UserId == userId).ToDictionaryAsync(c => c.CertificationId, c => c, ct);

            var targetCareerId = await db.StudyProfiles.AsNoTracking()
                .Where(p => p.UserId == userId).Select(p => p.TargetCareerPathId).FirstOrDefaultAsync(ct);
            if (targetCareerId is { } careerId)
                recommended = (await db.CareerCertifications.AsNoTracking()
                    .Where(cc => cc.CareerPathId == careerId)
                    .Select(cc => cc.CertificationId).ToListAsync(ct)).ToHashSet();
        }

        return certifications.Select(c =>
        {
            mine.TryGetValue(c.Id, out var user);
            return ToDto(c, user, recommended.Contains(c.Id));
        }).ToList();
    }

    public async Task<CertificationDto> UpdateMineAsync(
        Guid certificationId, UserCertificationUpdateRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var certification = await db.Certifications.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == certificationId, ct) ?? throw AppException.NotFound("Certification");

        var record = await db.UserCertifications
            .FirstOrDefaultAsync(c => c.UserId == userId && c.CertificationId == certificationId, ct);
        if (record is null)
        {
            record = new UserCertification { UserId = userId, CertificationId = certificationId };
            db.UserCertifications.Add(record);
        }

        var wasPassed = record.Status == CertificationStatus.Passed;
        record.Status = Text.ParseEnum(request.Status, record.Status);
        record.TargetDate = ParseDate(request.TargetDate) ?? record.TargetDate;
        record.CompletedDate = ParseDate(request.CompletedDate) ?? record.CompletedDate;
        record.ScorePercent = request.ScorePercent ?? record.ScorePercent;
        record.PrepHoursLogged = Math.Max(0, request.PrepHoursLogged);
        record.UpdatedAt = clock.Now;

        if (record.Status == CertificationStatus.Passed)
        {
            record.CompletedDate ??= clock.Today;
            if (!wasPassed)
                gamification.Record(userId, Xp.CertificationPassed, $"Certification passed: {certification.Code}",
                    "certification", certificationId, 0, StudyActivityType.Assessment);
        }

        await db.SaveChangesAsync(ct);
        await gamification.EvaluateBadgesAsync(userId, ct);
        await db.SaveChangesAsync(ct);

        return ToDto(certification, record, false);
    }

    private static DateOnly? ParseDate(string? value) =>
        DateOnly.TryParse(value, CultureInfo.InvariantCulture, out var date) ? date : null;

    private static CertificationDto ToDto(Certification c, UserCertification? user, bool recommended) => new(
        c.Id, c.Code, c.Name, c.Vendor, c.Level, c.EstimatedPrepHours,
        Text.FromJson<List<string>>(c.TopicsJson) ?? [], c.ExamCostUsd, c.OfficialUrl,
        (user?.Status ?? CertificationStatus.NotStarted).ToString(),
        user?.TargetDate?.ToString("yyyy-MM-dd"), user?.CompletedDate?.ToString("yyyy-MM-dd"),
        user?.ScorePercent, user?.PrepHoursLogged ?? 0, recommended);
}
