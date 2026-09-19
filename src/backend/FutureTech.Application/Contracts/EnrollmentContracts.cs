namespace FutureTech.Application.Contracts;

// ---------- enrolment ----------

/// <summary>Every field is a preference the learner sets when enrolling, and can change later.</summary>
public record EnrollRequest(string? Goal = null, double WeeklyHoursTarget = 0, bool IsPriority = false);

public record EnrollmentDto(
    Guid Id,
    Guid CourseId,
    string CourseTitle,
    string CourseSlug,
    int PhaseNumber,
    string CareerTitle,
    string Status,
    DateTimeOffset EnrolledAt,
    DateTimeOffset? LastAccessedAt,
    DateTimeOffset? CompletedAt,
    string? Goal,
    double WeeklyHoursTarget,
    bool IsPriority,
    int TotalLessons,
    int CompletedLessons,
    int ProgressPercent,
    int MinutesStudied,
    int EstimatedHours,
    // True once ProgressPercent reaches the certificate threshold.
    bool CertificateEligible,
    int CertificateThresholdPercent,
    Guid? CertificateId,
    string? CertificateNumber);

// ---------- preferences ----------

public record LearnerPreferencesDto(
    string Theme,
    string? CertificateName,
    bool AutoplayVideos,
    bool ShowKeyTakeaways,
    int PreferredSessionMinutes,
    // The name that will actually be printed, once the fallback is applied.
    string EffectiveCertificateName,
    // The market salary figures and country-scoped courses are shown for.
    string CountryCode,
    string CountryName,
    string CurrencyCode);

public record LearnerPreferencesUpdateRequest(
    string? Theme = null,
    string? CertificateName = null,
    bool? AutoplayVideos = null,
    bool? ShowKeyTakeaways = null,
    int? PreferredSessionMinutes = null,
    string? CountryCode = null);

// ---------- certificates ----------

public record CertificateDto(
    Guid Id,
    Guid CourseId,
    string CertificateNumber,
    string LearnerName,
    string CourseTitle,
    string CareerTitle,
    string CourseSlug,
    int PercentComplete,
    int LessonsCompleted,
    int TotalLessons,
    int MinutesStudied,
    DateTimeOffset IssuedAt);

/// <summary>What the public verification endpoint returns. Deliberately minimal.</summary>
public record CertificateVerificationDto(
    bool Found,
    string? CertificateNumber,
    string? LearnerName,
    string? CourseTitle,
    int PercentComplete,
    DateTimeOffset? IssuedAt,
    string Statement);

// ---------- location ----------

public record CountryDto(
    string Code,
    string Name,
    string CurrencyCode,
    string CurrencySymbol,
    bool IsDefault);

/// <summary>
/// One career's pay in one country. <c>HasData</c> is false when nothing has
/// been published for that market — the UI says so rather than showing a
/// converted or invented figure.
/// </summary>
public record SalaryBandDto(
    string CountryCode,
    string CountryName,
    string CurrencyCode,
    string CurrencySymbol,
    int Min,
    int Max,
    int SeniorMin,
    int SeniorMax,
    string? Range,
    string? SeniorRange,
    string? AsOf,
    string? Source,
    bool HasData,
    string? Message);

// ---------- access & payment ----------

/// <summary>
/// Whether the signed-in learner can open a course's lessons, and if not, what
/// it would take. Returned alongside every course so the UI never has to guess.
/// </summary>
public record CourseAccessDto(
    string Tier,
    bool IsFree,
    bool HasAccess,
    // "Open", "Purchased", "PaymentRequired", "AwaitingConfirmation", "NotSoldHere", "SignInRequired".
    string State,
    string Message,
    int Price,
    string? PriceLabel,
    string? CurrencyCode,
    string CountryCode,
    Guid? PaymentRequestId,
    string? PaymentReference,
    string? PaymentStatus);

public record PaymentMethodDto(
    Guid Id,
    string Kind,
    string Label,
    string Instructions,
    string? QrPayload,
    string? QrImageUrl,
    string? PayeeEmail,
    string? Reference);

/// <summary>What the learner is shown when they choose to buy a course.</summary>
public record PaymentInstructionsDto(
    Guid PaymentRequestId,
    string Reference,
    Guid CourseId,
    string CourseTitle,
    int Amount,
    string CurrencyCode,
    string AmountLabel,
    string CountryCode,
    string Status,
    IReadOnlyList<PaymentMethodDto> Methods,
    string Notice);

public record PaymentRequestDto(
    Guid Id,
    Guid UserId,
    string LearnerName,
    string LearnerEmail,
    Guid CourseId,
    string CourseTitle,
    string Reference,
    int Amount,
    string CurrencyCode,
    string AmountLabel,
    string CountryCode,
    string Method,
    string Status,
    string? LearnerNote,
    string? AdminNote,
    string? ConfirmedByName,
    DateTimeOffset CreatedAt,
    DateTimeOffset? SubmittedAt,
    DateTimeOffset? DecidedAt);

public record StartPaymentRequest(Guid? MethodId = null);

/// <summary>The learner declaring they have paid, with whatever reference they have.</summary>
public record DeclarePaymentRequest(string? LearnerNote = null);

public record PaymentDecisionRequest(string Status, string? AdminNote = null);
