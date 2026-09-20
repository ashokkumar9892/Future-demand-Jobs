using FutureTech.Application.Abstractions;
using FutureTech.Application.Common;
using FutureTech.Application.Contracts;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Services;

public interface IAccessPolicyService
{
    Task<AccessPolicyDto> GetAsync(CancellationToken ct = default);
    Task<AccessPolicyDto> UpdateAsync(AccessPolicyRequest request, CancellationToken ct = default);
}

/// <summary>
/// Reads and writes the single access-policy row that decides when a visitor is
/// asked to create an account, and when a learner is asked to pay.
/// </summary>
public class AccessPolicyService(IAppDbContext db, IDateTimeProvider clock) : IAccessPolicyService
{
    /// <summary>
    /// A day of continuous use. High enough not to constrain a real operator,
    /// low enough that a typo cannot set an allowance no one will ever exhaust
    /// and then be reported as "the gate never appears".
    /// </summary>
    private const int MaxMinutes = 24 * 60;

    private const int MaxCourses = 500;

    public async Task<AccessPolicyDto> GetAsync(CancellationToken ct = default) =>
        ToDto(await CurrentAsync(ct));

    public async Task<AccessPolicyDto> UpdateAsync(AccessPolicyRequest request, CancellationToken ct = default)
    {
        var policy = await CurrentAsync(ct, tracked: true);

        policy.AllowAnonymousBrowsing = request.AllowAnonymousBrowsing;
        policy.FreeMinutesBeforeSignup = Clamp(request.FreeMinutesBeforeSignup, 1, MaxMinutes, nameof(request.FreeMinutesBeforeSignup));
        policy.SignupNudgeAtPercent = Clamp(request.SignupNudgeAtPercent, 0, 100, nameof(request.SignupNudgeAtPercent));
        policy.FreeMinutesBeforePayment = Clamp(request.FreeMinutesBeforePayment, 0, MaxMinutes, nameof(request.FreeMinutesBeforePayment));
        policy.FreeCoursesBeforePayment = Clamp(request.FreeCoursesBeforePayment, 0, MaxCourses, nameof(request.FreeCoursesBeforePayment));
        policy.PaymentPromptBlocks = request.PaymentPromptBlocks;

        policy.SignupPromptTitle = Text(request.SignupPromptTitle, "Your free preview has ended", 120);
        policy.SignupPromptBody = Text(request.SignupPromptBody, "Create a free account to keep reading.", 600);
        policy.PaymentPromptTitle = Text(request.PaymentPromptTitle, "Continue with full access", 120);
        policy.PaymentPromptBody = Text(request.PaymentPromptBody, "Enrol to keep going.", 600);

        policy.UpdatedAt = clock.Now;

        // Both triggers off would leave a payment prompt that can never fire.
        // That is a legitimate way to turn payment prompting off entirely, so
        // it is allowed — but it is a decision, not an accident, and the two
        // zeroes say so plainly in Admin.

        await db.SaveChangesAsync(ct);
        return ToDto(policy);
    }

    /// <summary>
    /// The row, created on demand. The seeder makes it on startup; this covers
    /// a database that predates the seeder change and has not restarted yet.
    /// </summary>
    private async Task<AccessPolicy> CurrentAsync(CancellationToken ct, bool tracked = false)
    {
        var query = tracked ? db.AccessPolicies : db.AccessPolicies.AsNoTracking();
        var policy = await query.OrderBy(p => p.CreatedAt).FirstOrDefaultAsync(ct);
        if (policy is not null) return policy;

        policy = new AccessPolicy();
        db.AccessPolicies.Add(policy);
        await db.SaveChangesAsync(ct);
        return policy;
    }

    private static int Clamp(int value, int min, int max, string field) =>
        value < min || value > max
            ? throw new AppException($"{field} must be between {min} and {max}.")
            : value;

    private static string Text(string? value, string fallback, int max)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return fallback;
        return trimmed.Length > max ? trimmed[..max] : trimmed;
    }

    private static AccessPolicyDto ToDto(AccessPolicy p) => new(
        p.AllowAnonymousBrowsing,
        p.FreeMinutesBeforeSignup,
        p.SignupNudgeAtPercent,
        p.FreeMinutesBeforePayment,
        p.FreeCoursesBeforePayment,
        p.PaymentPromptBlocks,
        p.SignupPromptTitle,
        p.SignupPromptBody,
        p.PaymentPromptTitle,
        p.PaymentPromptBody);
}
