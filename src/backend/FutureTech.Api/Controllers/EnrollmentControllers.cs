using FutureTech.Application.Contracts;
using FutureTech.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FutureTech.Api.Controllers;

[ApiController]
[Route("api/enrollments")]
[Authorize]
public class EnrollmentsController(IEnrollmentService enrollments) : ControllerBase
{
    /// <summary>Every course this learner has enrolled in, with progress and certificate state.</summary>
    [HttpGet]
    public Task<IReadOnlyList<EnrollmentDto>> Mine(CancellationToken ct) => enrollments.MineAsync(ct);

    [HttpPost("{courseId:guid}")]
    public Task<EnrollmentDto> Enroll(Guid courseId, EnrollRequest request, CancellationToken ct) =>
        enrollments.EnrollAsync(courseId, request, ct);

    /// <summary>Changes the goal, weekly-hours target or priority flag set at enrolment.</summary>
    [HttpPut("{courseId:guid}")]
    public Task<EnrollmentDto> Update(Guid courseId, EnrollRequest request, CancellationToken ct) =>
        enrollments.UpdateAsync(courseId, request, ct);

    /// <summary>Withdraws without deleting lesson progress.</summary>
    [HttpDelete("{courseId:guid}")]
    public Task<EnrollmentDto> Withdraw(Guid courseId, CancellationToken ct) =>
        enrollments.WithdrawAsync(courseId, ct);
}

[ApiController]
[Route("api/preferences")]
[Authorize]
public class PreferencesController(IPreferencesService preferences) : ControllerBase
{
    [HttpGet]
    public Task<LearnerPreferencesDto> Get(CancellationToken ct) => preferences.GetAsync(ct);

    /// <summary>Only the fields present in the body are changed.</summary>
    [HttpPut]
    public Task<LearnerPreferencesDto> Update(LearnerPreferencesUpdateRequest request, CancellationToken ct) =>
        preferences.UpdateAsync(request, ct);
}

[ApiController]
[Route("api/certificates")]
public class CertificatesController(ICertificateService certificates) : ControllerBase
{
    [HttpGet]
    [Authorize]
    public Task<IReadOnlyList<CertificateDto>> Mine(CancellationToken ct) => certificates.ListMineAsync(ct);

    /// <summary>
    /// Issues the certificate for a course. Fails with the shortfall spelled out
    /// when the learner has not reached the completion threshold yet.
    /// </summary>
    [HttpPost("courses/{courseId:guid}")]
    [Authorize]
    public Task<CertificateDto> Issue(Guid courseId, CancellationToken ct) => certificates.IssueAsync(courseId, ct);

    /// <summary>
    /// Public check of a certificate number, so someone shown a certificate can
    /// confirm it without an account. Returns only what is on the certificate.
    /// </summary>
    [HttpGet("verify/{number}")]
    [AllowAnonymous]
    public Task<CertificateVerificationDto> Verify(string number, CancellationToken ct) =>
        certificates.VerifyAsync(number, ct);
}

/// <summary>
/// The markets the platform publishes figures for. Readable without signing in
/// so the career catalogue can be browsed in a chosen country first.
/// </summary>
[ApiController]
[Route("api/countries")]
public class CountriesController(ILocationService locations) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public Task<IReadOnlyList<CountryDto>> List(CancellationToken ct) => locations.ListAsync(ct);
}

/// <summary>
/// The manual payment flow for advanced courses.
/// <para>
/// No payment gateway is integrated and no card details are ever accepted. The
/// learner is shown the operator's own QR or contact address, pays through
/// their own bank or wallet, and an administrator confirms receipt.
/// </para>
/// </summary>
[ApiController]
[Route("api/payments")]
[Authorize]
public class PaymentsController(IPaymentService payments) : ControllerBase
{
    /// <summary>Starts (or reopens) a payment and returns how to pay.</summary>
    [HttpPost("courses/{courseId:guid}")]
    public Task<PaymentInstructionsDto> Start(Guid courseId, StartPaymentRequest request, CancellationToken ct) =>
        payments.StartAsync(courseId, request, ct);

    /// <summary>The learner declaring they have sent the money.</summary>
    [HttpPost("{id:guid}/declare")]
    public Task<PaymentRequestDto> Declare(Guid id, DeclarePaymentRequest request, CancellationToken ct) =>
        payments.DeclarePaidAsync(id, request, ct);

    [HttpGet("mine")]
    public Task<IReadOnlyList<PaymentRequestDto>> Mine(CancellationToken ct) => payments.MineAsync(ct);
}

/// <summary>Where an administrator reconciles payments against their own bank records.</summary>
[ApiController]
[Route("api/admin/payments")]
[Authorize(Policy = "Admin")]
public class AdminPaymentsController(IPaymentService payments) : ControllerBase
{
    /// <summary><paramref name="status"/> takes a status name, "open" (the default view) or "all".</summary>
    [HttpGet]
    public Task<PagedDto<PaymentRequestDto>> List(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default) =>
        payments.ListAsync(status, search, page, pageSize, ct);

    /// <summary>Confirming with status "Paid" is what enrols the learner and unlocks the course.</summary>
    [HttpPut("{id:guid}")]
    public Task<PaymentRequestDto> Decide(Guid id, PaymentDecisionRequest request, CancellationToken ct) =>
        payments.DecideAsync(id, request, ct);
}
