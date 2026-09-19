using FutureTech.Domain.Common;

namespace FutureTech.Domain.Entities;

/// <summary>
/// A learner's commitment to a course, and the preferences they set for it.
/// <para>
/// Progress alone would be enough to report on, but enrolment carries intent:
/// what the learner wants out of the course and how much time they mean to give
/// it. It is also the gate for a completion certificate.
/// </para>
/// </summary>
public class CourseEnrollment : Entity
{
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public Guid CourseId { get; set; }
    public Course? Course { get; set; }

    public EnrollmentStatus Status { get; set; } = EnrollmentStatus.Active;
    public DateTimeOffset EnrolledAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastAccessedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>Why the learner took this course. Their words, shown back to them.</summary>
    public string? Goal { get; set; }
    /// <summary>Hours a week they intend to give this course. Zero means unset.</summary>
    public double WeeklyHoursTarget { get; set; }
    /// <summary>Pins the course to the dashboard's focus list.</summary>
    public bool IsPriority { get; set; }
}

/// <summary>
/// Per-learner settings that are not study-schedule answers (those live on
/// <see cref="StudyProfile"/>). Kept server-side so they follow the account to
/// any browser rather than living in one machine's local storage.
/// </summary>
public class LearnerPreferences : Entity
{
    public Guid UserId { get; set; }

    /// <summary>"dark" or "light". Mirrors <see cref="AppUser.ThemePreference"/>, which stays authoritative at sign-in.</summary>
    public string Theme { get; set; } = "dark";

    /// <summary>
    /// The name printed on completion certificates. Null means use the display
    /// name — a learner whose account name is "ash" may want "Ashok Kumar" on a
    /// document they show an employer.
    /// </summary>
    public string? CertificateName { get; set; }

    /// <summary>Starts a lesson's video as soon as the lesson opens.</summary>
    public bool AutoplayVideos { get; set; }

    /// <summary>Opens lessons with the key-takeaways rail expanded.</summary>
    public bool ShowKeyTakeaways { get; set; } = true;

    /// <summary>Default length of a study sitting, in minutes. Pre-fills the lesson timer.</summary>
    public int PreferredSessionMinutes { get; set; } = 45;

    /// <summary>
    /// The market the learner wants figures for — salary bands and any
    /// country-scoped courses. Null until they choose; the platform then falls
    /// back to its default country.
    /// </summary>
    public string? CountryCode { get; set; }
}

/// <summary>
/// A completion certificate for one course, issued once the learner passes the
/// completion threshold.
/// <para>
/// The learner's name and the course title are copied onto the row at issue.
/// A certificate is a statement about a moment: renaming the account or editing
/// the course later must not silently rewrite a document already shown to an
/// employer.
/// </para>
/// </summary>
public class CourseCertificate : Entity
{
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public Guid CourseId { get; set; }
    public Course? Course { get; set; }

    /// <summary>Human-quotable reference, unique, used by the public verification endpoint.</summary>
    public string CertificateNumber { get; set; } = string.Empty;

    public string LearnerName { get; set; } = string.Empty;
    public string CourseTitle { get; set; } = string.Empty;
    public string CareerTitle { get; set; } = string.Empty;

    public int PercentComplete { get; set; }
    public int LessonsCompleted { get; set; }
    public int TotalLessons { get; set; }
    public int MinutesStudied { get; set; }
    public DateTimeOffset IssuedAt { get; set; } = DateTimeOffset.UtcNow;
}
