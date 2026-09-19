using System.Security.Cryptography;
using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

/// <summary>
/// Decides whether a learner may open a course, and runs the manual payment
/// flow that unlocks the advanced ones.
/// </summary>
public interface IPaymentService
{
    /// <summary>Access state for several courses at once, for list screens.</summary>
    Task<Dictionary<Guid, CourseAccessDto>> AccessForAsync(
        IReadOnlyList<Guid> courseIds, string? country, CancellationToken ct = default);

    Task<CourseAccessDto> AccessForAsync(Guid courseId, string? country, CancellationToken ct = default);

    /// <summary>Throws when the course is advanced and unpaid. Used to gate lesson content.</summary>
    Task EnsureAccessAsync(Guid courseId, CancellationToken ct = default);

    Task<PaymentInstructionsDto> StartAsync(Guid courseId, StartPaymentRequest request, CancellationToken ct = default);
    Task<PaymentRequestDto> DeclarePaidAsync(Guid paymentRequestId, DeclarePaymentRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<PaymentRequestDto>> MineAsync(CancellationToken ct = default);

    Task<PagedDto<PaymentRequestDto>> ListAsync(
        string? status, string? search, int page, int pageSize, CancellationToken ct = default);
    Task<PaymentRequestDto> DecideAsync(Guid id, PaymentDecisionRequest request, CancellationToken ct = default);
}

public class PaymentService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IDateTimeProvider clock,
    ILocationService locations) : IPaymentService
{
    private const string Notice =
        "This platform does not process payments. You pay through your own bank or wallet using the " +
        "details below, quoting the reference. Access opens once an administrator confirms the money arrived.";

    // ----- access ---------------------------------------------------------

    public async Task<CourseAccessDto> AccessForAsync(Guid courseId, string? country, CancellationToken ct = default) =>
        (await AccessForAsync([courseId], country, ct)).GetValueOrDefault(courseId)
        ?? throw AppException.NotFound("Course");

    public async Task<Dictionary<Guid, CourseAccessDto>> AccessForAsync(
        IReadOnlyList<Guid> courseIds, string? country, CancellationToken ct = default)
    {
        if (courseIds.Count == 0) return [];

        var market = await locations.ResolveAsync(country, ct);
        var courses = await db.Courses.AsNoTracking()
            .Where(c => courseIds.Contains(c.Id))
            .Select(c => new { c.Id, c.AccessTier })
            .ToListAsync(ct);

        var prices = await db.CoursePrices.AsNoTracking()
            .Where(p => p.CountryCode == market.Code && p.IsActive && courseIds.Contains(p.CourseId))
            .ToListAsync(ct);

        var userId = currentUser.UserId;
        var payments = userId is null
            ? []
            : await db.PaymentRequests.AsNoTracking()
                .Where(p => p.UserId == userId && courseIds.Contains(p.CourseId))
                .ToListAsync(ct);

        var result = new Dictionary<Guid, CourseAccessDto>();

        foreach (var course in courses)
        {
            var price = prices.FirstOrDefault(p => p.CourseId == course.Id);
            // Latest first: a rejected attempt followed by a confirmed one must
            // read as paid, not as rejected.
            var payment = payments
                .Where(p => p.CourseId == course.Id)
                .OrderByDescending(p => p.Status == PaymentStatus.Paid)
                .ThenByDescending(p => p.CreatedAt)
                .FirstOrDefault();

            result[course.Id] = Describe(course.AccessTier, market, price, payment, userId is not null);
        }

        return result;
    }

    private static CourseAccessDto Describe(
        CourseAccessTier tier, Country market, CoursePrice? price, PaymentRequest? payment, bool signedIn)
    {
        var priceLabel = price is null ? null : $"{market.CurrencySymbol}{price.Amount:N0}";

        if (tier == CourseAccessTier.Free)
        {
            return new CourseAccessDto(
                tier.ToString(), true, true, "Open", "Included for every signed-in learner.",
                0, null, null, market.Code, null, null, null);
        }

        if (payment?.Status == PaymentStatus.Paid)
        {
            return new CourseAccessDto(
                tier.ToString(), false, true, "Purchased", "You have full access to this course.",
                payment.Amount, $"{market.CurrencySymbol}{payment.Amount:N0}", payment.CurrencyCode,
                market.Code, payment.Id, payment.Reference, payment.Status.ToString());
        }

        if (!signedIn)
        {
            return new CourseAccessDto(
                tier.ToString(), false, false, "SignInRequired", "Sign in to buy this course.",
                price?.Amount ?? 0, priceLabel, price?.CurrencyCode, market.Code, null, null, null);
        }

        if (payment is { Status: PaymentStatus.AwaitingConfirmation })
        {
            return new CourseAccessDto(
                tier.ToString(), false, false, "AwaitingConfirmation",
                "We are checking your payment. Access opens as soon as it is confirmed.",
                payment.Amount, $"{market.CurrencySymbol}{payment.Amount:N0}", payment.CurrencyCode,
                market.Code, payment.Id, payment.Reference, payment.Status.ToString());
        }

        if (price is null)
        {
            return new CourseAccessDto(
                tier.ToString(), false, false, "NotSoldHere",
                $"This course is not on sale in {market.Name} yet.",
                0, null, null, market.Code, null, null, payment?.Status.ToString());
        }

        return new CourseAccessDto(
            tier.ToString(), false, false, "PaymentRequired",
            payment is { Status: PaymentStatus.Rejected }
                ? "Your last payment could not be confirmed. You can start again."
                : "This is an advanced course. Buy it to unlock the lessons.",
            price.Amount, priceLabel, price.CurrencyCode, market.Code,
            payment?.Id, payment?.Reference, payment?.Status.ToString());
    }

    public async Task EnsureAccessAsync(Guid courseId, CancellationToken ct = default)
    {
        var access = await AccessForAsync(courseId, null, ct);
        if (access.HasAccess) return;
        throw AppException.Forbidden(access.Message);
    }

    // ----- learner payment flow -------------------------------------------

    public async Task<PaymentInstructionsDto> StartAsync(
        Guid courseId, StartPaymentRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var market = await locations.ResolveAsync(null, ct);

        var course = await db.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == courseId, ct)
                     ?? throw AppException.NotFound("Course");

        if (course.AccessTier == CourseAccessTier.Free)
            throw new AppException("This course is free — there is nothing to pay.");

        var price = await db.CoursePrices.AsNoTracking()
                        .FirstOrDefaultAsync(p => p.CourseId == courseId && p.CountryCode == market.Code && p.IsActive, ct)
                    ?? throw new AppException($"This course is not on sale in {market.Name} yet.");

        var methods = await MethodsAsync(market.Code, ct);
        if (methods.Count == 0)
            throw new AppException(
                $"No payment method has been set up for {market.Name} yet. " +
                "An administrator configures these in Admin.");

        var chosen = request.MethodId is { } id
            ? methods.FirstOrDefault(m => m.Id == id) ?? methods[0]
            : methods[0];

        var existing = await db.PaymentRequests
            .Where(p => p.UserId == userId && p.CourseId == courseId)
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (existing is { Status: PaymentStatus.Paid })
            throw AppException.Conflict("You have already paid for this course.");

        // An attempt that has not been decided yet is reused, so a learner who
        // reopens the page keeps the reference they may already have quoted.
        var payment = existing is { Status: PaymentStatus.Pending or PaymentStatus.AwaitingConfirmation }
            ? existing
            : null;

        if (payment is null)
        {
            payment = new PaymentRequest
            {
                UserId = userId,
                CourseId = courseId,
                Reference = await NextReferenceAsync(ct),
                CreatedAt = clock.Now
            };
            db.PaymentRequests.Add(payment);
        }

        payment.CountryCode = market.Code;
        payment.CurrencyCode = price.CurrencyCode;
        payment.Amount = price.Amount;
        payment.Method = chosen.Kind;
        payment.PaymentMethodOptionId = chosen.Id;
        payment.UpdatedAt = clock.Now;

        await db.SaveChangesAsync(ct);

        return new PaymentInstructionsDto(
            payment.Id, payment.Reference, course.Id, course.Title,
            payment.Amount, payment.CurrencyCode, $"{market.CurrencySymbol}{payment.Amount:N0}",
            market.Code, payment.Status.ToString(),
            methods.Select(ToDto).ToList(), Notice);
    }

    public async Task<PaymentRequestDto> DeclarePaidAsync(
        Guid paymentRequestId, DeclarePaymentRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();

        var payment = await db.PaymentRequests
                          .Include(p => p.Course)
                          .Include(p => p.User)
                          .FirstOrDefaultAsync(p => p.Id == paymentRequestId && p.UserId == userId, ct)
                      ?? throw AppException.NotFound("Payment");

        if (payment.Status == PaymentStatus.Paid)
            throw AppException.Conflict("This payment is already confirmed.");

        payment.Status = PaymentStatus.AwaitingConfirmation;
        payment.LearnerNote = Trim(request.LearnerNote, 1000);
        payment.SubmittedAt = clock.Now;
        payment.UpdatedAt = clock.Now;

        await db.SaveChangesAsync(ct);
        return ToDto(payment);
    }

    public async Task<IReadOnlyList<PaymentRequestDto>> MineAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var rows = await db.PaymentRequests.AsNoTracking()
            .Include(p => p.Course)
            .Include(p => p.User)
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);

        return rows.Select(ToDto).ToList();
    }

    // ----- admin ----------------------------------------------------------

    public async Task<PagedDto<PaymentRequestDto>> ListAsync(
        string? status, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        var query = db.PaymentRequests.AsNoTracking()
            .Include(p => p.Course)
            .Include(p => p.User)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            if (status.Equals("open", StringComparison.OrdinalIgnoreCase))
                query = query.Where(p => p.Status == PaymentStatus.Pending || p.Status == PaymentStatus.AwaitingConfirmation);
            else if (Enum.TryParse<PaymentStatus>(status, true, out var parsed))
                query = query.Where(p => p.Status == parsed);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(p =>
                EF.Functions.Like(p.Reference, term) ||
                (p.User != null && EF.Functions.Like(p.User.Email, term)) ||
                (p.User != null && EF.Functions.Like(p.User.DisplayName, term)) ||
                (p.Course != null && EF.Functions.Like(p.Course.Title, term)));
        }

        var total = await query.CountAsync(ct);
        var (safePage, safeSize) = Paging.Normalise(page, pageSize);

        var rows = await query
            // Waiting on a decision first — that is the admin's actual queue.
            .OrderBy(p => p.Status == PaymentStatus.AwaitingConfirmation ? 0 : 1)
            .ThenByDescending(p => p.CreatedAt)
            .Skip((safePage - 1) * safeSize)
            .Take(safeSize)
            .ToListAsync(ct);

        return new PagedDto<PaymentRequestDto>(total, safePage, safeSize, rows.Select(ToDto).ToList());
    }

    public async Task<PaymentRequestDto> DecideAsync(
        Guid id, PaymentDecisionRequest request, CancellationToken ct = default)
    {
        var adminId = currentUser.RequireUserId();

        if (!Enum.TryParse<PaymentStatus>(request.Status, true, out var status))
            throw new AppException($"'{request.Status}' is not a payment status.");

        var payment = await db.PaymentRequests
                          .Include(p => p.Course)
                          .Include(p => p.User)
                          .FirstOrDefaultAsync(p => p.Id == id, ct)
                      ?? throw AppException.NotFound("Payment");

        var admin = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == adminId, ct);

        payment.Status = status;
        payment.AdminNote = request.AdminNote is null ? payment.AdminNote : Trim(request.AdminNote, 1000);
        payment.ConfirmedByUserId = adminId;
        payment.ConfirmedByName = admin?.DisplayName;
        payment.DecidedAt = clock.Now;
        payment.UpdatedAt = clock.Now;

        await db.SaveChangesAsync(ct);

        // Confirming receipt is what actually enrols the learner.
        if (status == PaymentStatus.Paid)
            await EnrollPaidLearnerAsync(payment, ct);

        return ToDto(payment);
    }

    /// <summary>
    /// Enrols the payer. <see cref="IEnrollmentService.EnsureEnrolledAsync"/>
    /// works off the caller's identity, which here is the administrator, so the
    /// row is written directly against the learner instead.
    /// </summary>
    private async Task EnrollPaidLearnerAsync(PaymentRequest payment, CancellationToken ct)
    {
        var existing = await db.CourseEnrollments
            .FirstOrDefaultAsync(e => e.UserId == payment.UserId && e.CourseId == payment.CourseId, ct);

        if (existing is null)
        {
            db.CourseEnrollments.Add(new CourseEnrollment
            {
                UserId = payment.UserId,
                CourseId = payment.CourseId,
                EnrolledAt = clock.Now,
                Status = EnrollmentStatus.Active
            });
        }
        else if (existing.Status == EnrollmentStatus.Withdrawn)
        {
            existing.Status = EnrollmentStatus.Active;
            existing.UpdatedAt = clock.Now;
        }

        await db.SaveChangesAsync(ct);
    }

    // ----- shared ---------------------------------------------------------

    private async Task<List<PaymentMethodOption>> MethodsAsync(string countryCode, CancellationToken ct) =>
        await db.PaymentMethodOptions.AsNoTracking()
            .Where(m => m.IsEnabled && m.CountryCode == countryCode)
            .OrderBy(m => m.SortOrder).ThenBy(m => m.Label)
            .ToListAsync(ct);

    private async Task<string> NextReferenceAsync(CancellationToken ct)
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        for (var attempt = 0; attempt < 8; attempt++)
        {
            var suffix = string.Concat(Enumerable.Range(0, 6)
                .Select(_ => alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)]));
            var candidate = $"PAY-{clock.Now.Year}-{suffix}";

            if (!await db.PaymentRequests.AsNoTracking().AnyAsync(p => p.Reference == candidate, ct))
                return candidate;
        }

        throw new AppException("Could not allocate a payment reference. Please try again.");
    }

    private static string? Trim(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }

    private static PaymentMethodDto ToDto(PaymentMethodOption m) => new(
        m.Id, m.Kind.ToString(), m.Label, m.Instructions, m.QrPayload, m.QrImageUrl, m.PayeeEmail, m.Reference);

    private static PaymentRequestDto ToDto(PaymentRequest p) => new(
        p.Id, p.UserId,
        p.User?.DisplayName ?? "Deleted account",
        p.User?.Email ?? "—",
        p.CourseId,
        p.Course?.Title ?? string.Empty,
        p.Reference, p.Amount, p.CurrencyCode,
        $"{p.CurrencyCode} {p.Amount:N0}",
        p.CountryCode, p.Method.ToString(), p.Status.ToString(),
        p.LearnerNote, p.AdminNote, p.ConfirmedByName,
        p.CreatedAt, p.SubmittedAt, p.DecidedAt);
}
