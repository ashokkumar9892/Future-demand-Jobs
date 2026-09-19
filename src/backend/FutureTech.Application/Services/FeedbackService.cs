using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IFeedbackService
{
    Task<FeedbackDto> SubmitAsync(FeedbackSubmitRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<FeedbackDto>> MineAsync(CancellationToken ct = default);

    Task<PagedDto<AdminFeedbackDto>> ListAsync(
        string? status, string? category, string? search, int page, int pageSize, CancellationToken ct = default);
    Task<FeedbackSummaryDto> SummaryAsync(CancellationToken ct = default);
    Task<AdminFeedbackDto> UpdateAsync(Guid id, FeedbackUpdateRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public class FeedbackService(IAppDbContext db, ICurrentUser currentUser, IDateTimeProvider clock) : IFeedbackService
{
    private const int MaxSubject = 200;
    private const int MaxMessage = 4000;

    public async Task<FeedbackDto> SubmitAsync(FeedbackSubmitRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();

        var subject = (request.Subject ?? string.Empty).Trim();
        var message = (request.Message ?? string.Empty).Trim();
        if (subject.Length == 0) throw new AppException("A subject is required.");
        if (message.Length < 10) throw new AppException("Tell us a little more — at least 10 characters.");
        if (subject.Length > MaxSubject) throw new AppException($"Keep the subject under {MaxSubject} characters.");
        if (message.Length > MaxMessage) throw new AppException($"Keep the message under {MaxMessage} characters.");
        if (request.Rating is < 0 or > 5) throw new AppException("A rating must be between 1 and 5.");

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
                   ?? throw AppException.NotFound("User");

        var feedback = new Feedback
        {
            UserId = userId,
            Category = Text.ParseEnum(request.Category, FeedbackCategory.General),
            Subject = subject,
            Message = message,
            Rating = request.Rating,
            Area = Trim(request.Area, 200),
            RefType = Trim(request.RefType, 32),
            RefId = request.RefId,
            Status = FeedbackStatus.New,
            CreatedAt = clock.Now
        };

        db.Feedback.Add(feedback);
        await db.SaveChangesAsync(ct);
        return Map(feedback, user.DisplayName, user.Email);
    }

    public async Task<IReadOnlyList<FeedbackDto>> MineAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var rows = await db.Feedback.AsNoTracking()
            .Include(f => f.User)
            .Where(f => f.UserId == userId)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync(ct);

        return rows.Select(f => Map(f, f.User?.DisplayName, f.User?.Email)).ToList();
    }

    public async Task<PagedDto<AdminFeedbackDto>> ListAsync(
        string? status, string? category, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        var query = db.Feedback.AsNoTracking().Include(f => f.User).AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            // "open" is the default working view: everything not yet closed out.
            if (status.Equals("open", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(f => f.Status != FeedbackStatus.Implemented && f.Status != FeedbackStatus.Declined);
            }
            else if (Enum.TryParse<FeedbackStatus>(status, true, out var parsed))
            {
                query = query.Where(f => f.Status == parsed);
            }
        }

        if (!string.IsNullOrWhiteSpace(category) &&
            !category.Equals("all", StringComparison.OrdinalIgnoreCase) &&
            Enum.TryParse<FeedbackCategory>(category, true, out var cat))
        {
            query = query.Where(f => f.Category == cat);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(f =>
                EF.Functions.Like(f.Subject, term) ||
                EF.Functions.Like(f.Message, term) ||
                (f.User != null && EF.Functions.Like(f.User.Email, term)) ||
                (f.User != null && EF.Functions.Like(f.User.DisplayName, term)));
        }

        var total = await query.CountAsync(ct);
        var (safePage, safeSize) = Paging.Normalise(page, pageSize);

        var rows = await query
            // Untriaged items first, then newest — the queue an admin works down.
            .OrderBy(f => f.Status == FeedbackStatus.New ? 0 : 1)
            .ThenByDescending(f => f.CreatedAt)
            .Skip((safePage - 1) * safeSize)
            .Take(safeSize)
            .ToListAsync(ct);

        return new PagedDto<AdminFeedbackDto>(
            total, safePage, safeSize,
            rows.Select(f => new AdminFeedbackDto(Map(f, f.User?.DisplayName, f.User?.Email), f.AdminNote)).ToList());
    }

    public async Task<FeedbackSummaryDto> SummaryAsync(CancellationToken ct = default)
    {
        var rows = await db.Feedback.AsNoTracking()
            .Select(f => new { f.Status, f.Category, f.Rating })
            .ToListAsync(ct);

        var rated = rows.Where(r => r.Rating > 0).ToList();

        var byCategory = rows
            .GroupBy(r => r.Category)
            .Select(g => new FeedbackCategoryCountDto(
                Text.Humanize(g.Key),
                g.Count(),
                g.Any(x => x.Rating > 0) ? Math.Round(g.Where(x => x.Rating > 0).Average(x => x.Rating), 2) : 0))
            .OrderByDescending(c => c.Count)
            .ToList();

        int Count(FeedbackStatus status) => rows.Count(r => r.Status == status);

        return new FeedbackSummaryDto(
            rows.Count,
            rows.Count(r => r.Status != FeedbackStatus.Implemented && r.Status != FeedbackStatus.Declined),
            Count(FeedbackStatus.New),
            Count(FeedbackStatus.UnderReview),
            Count(FeedbackStatus.Planned),
            Count(FeedbackStatus.InProgress),
            Count(FeedbackStatus.Implemented),
            Count(FeedbackStatus.Declined),
            rated.Count == 0 ? 0 : Math.Round(rated.Average(r => r.Rating), 2),
            rated.Count,
            byCategory);
    }

    public async Task<AdminFeedbackDto> UpdateAsync(Guid id, FeedbackUpdateRequest request, CancellationToken ct = default)
    {
        var adminId = currentUser.RequireUserId();
        var feedback = await db.Feedback.Include(f => f.User).FirstOrDefaultAsync(f => f.Id == id, ct)
                       ?? throw AppException.NotFound("Feedback");

        var admin = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == adminId, ct);

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            if (!Enum.TryParse<FeedbackStatus>(request.Status, true, out var status))
                throw new AppException($"'{request.Status}' is not a feedback status.");

            if (status != feedback.Status)
            {
                feedback.Status = status;
                // Stamped when the work lands, cleared if it is moved back out
                // of Implemented, so the date always matches the current state.
                feedback.ImplementedAt = status == FeedbackStatus.Implemented ? clock.Now : null;
            }
        }

        if (request.AdminResponse is not null)
        {
            var response = request.AdminResponse.Trim();
            feedback.AdminResponse = response.Length == 0 ? null : response;
            feedback.RespondedAt = feedback.AdminResponse is null ? null : clock.Now;
        }

        if (request.AdminNote is not null)
            feedback.AdminNote = Trim(request.AdminNote, MaxMessage);

        if (request.ImplementationNote is not null)
            feedback.ImplementationNote = Trim(request.ImplementationNote, MaxMessage);

        feedback.HandledByUserId = adminId;
        feedback.HandledByName = admin?.DisplayName;
        feedback.UpdatedAt = clock.Now;

        await db.SaveChangesAsync(ct);
        return new AdminFeedbackDto(
            Map(feedback, feedback.User?.DisplayName, feedback.User?.Email), feedback.AdminNote);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var feedback = await db.Feedback.FirstOrDefaultAsync(f => f.Id == id, ct)
                       ?? throw AppException.NotFound("Feedback");
        db.Feedback.Remove(feedback);
        await db.SaveChangesAsync(ct);
    }

    private static string? Trim(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }

    internal static FeedbackDto Map(Feedback f, string? name, string? email) => new(
        f.Id, f.UserId, name ?? "Deleted account", email ?? "—",
        f.Category.ToString(), f.Subject, f.Message, f.Rating, f.Area, f.RefType, f.RefId,
        f.Status.ToString(), f.AdminResponse, f.ImplementationNote, f.HandledByName,
        f.CreatedAt, f.RespondedAt, f.ImplementedAt);
}

/// <summary>Shared clamp so every admin table pages the same way.</summary>
public static class Paging
{
    public static (int Page, int PageSize) Normalise(int page, int pageSize) =>
        (Math.Max(1, page), Math.Clamp(pageSize <= 0 ? 25 : pageSize, 1, 200));
}
