using FutureTech.Domain.Common;

namespace FutureTech.Domain.Entities;

/// <summary>
/// What one course costs in one country.
/// <para>
/// Priced per market for the same reason salaries are: a figure that is right
/// in one country is wrong in another, and no exchange rate fixes that. A
/// course with no price row in the learner's country is not on sale there.
/// </para>
/// </summary>
public class CoursePrice : Entity
{
    public Guid CourseId { get; set; }
    public Course? Course { get; set; }

    public string CountryCode { get; set; } = string.Empty;
    public string CurrencyCode { get; set; } = string.Empty;
    /// <summary>Whole currency units — rupees, pounds, dollars. Not minor units.</summary>
    public int Amount { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// A way to pay, configured by the operator for one country.
/// <para>
/// The platform integrates no payment gateway and never handles card details.
/// It shows the operator's own QR or contact address, the learner pays through
/// their own bank or wallet, and an administrator confirms receipt.
/// </para>
/// </summary>
public class PaymentMethodOption : Entity
{
    public string CountryCode { get; set; } = string.Empty;
    public PaymentMethodKind Kind { get; set; }

    /// <summary>Shown as the option's name, e.g. "UPI (scan to pay)".</summary>
    public string Label { get; set; } = string.Empty;
    /// <summary>Step-by-step text shown under the option. Markdown is not rendered here.</summary>
    public string Instructions { get; set; } = string.Empty;

    /// <summary>
    /// The text encoded into the QR shown to the learner — typically a UPI or
    /// EMV payment URI. Rendered client-side, so no image needs hosting.
    /// </summary>
    public string? QrPayload { get; set; }
    /// <summary>An already-made QR image to show instead of generating one.</summary>
    public string? QrImageUrl { get; set; }

    /// <summary>Where the learner writes for an invoice, when <see cref="Kind"/> is Email.</summary>
    public string? PayeeEmail { get; set; }
    /// <summary>Account number, UPI id or similar, shown as copyable text.</summary>
    public string? Reference { get; set; }

    public int SortOrder { get; set; }
    public bool IsEnabled { get; set; } = true;
}

/// <summary>
/// One learner's attempt to pay for one course, and the administrator's ruling
/// on it. Access to an advanced course is granted only once this reaches
/// <see cref="PaymentStatus.Paid"/>.
/// </summary>
public class PaymentRequest : Entity
{
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public Guid CourseId { get; set; }
    public Course? Course { get; set; }

    /// <summary>Quoted by the learner when they pay, so a transfer can be matched to a person.</summary>
    public string Reference { get; set; } = string.Empty;

    public string CountryCode { get; set; } = string.Empty;
    public string CurrencyCode { get; set; } = string.Empty;
    public int Amount { get; set; }
    public PaymentMethodKind Method { get; set; }
    public Guid? PaymentMethodOptionId { get; set; }

    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;

    /// <summary>The learner's own evidence — a wallet transaction id, or when they sent it.</summary>
    public string? LearnerNote { get; set; }
    /// <summary>Internal. Why it was confirmed or rejected.</summary>
    public string? AdminNote { get; set; }

    public Guid? ConfirmedByUserId { get; set; }
    public string? ConfirmedByName { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
}
