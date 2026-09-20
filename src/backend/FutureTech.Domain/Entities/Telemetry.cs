using FutureTech.Domain.Common;

namespace FutureTech.Domain.Entities;

/// <summary>
/// How long someone actually had the application open and in front of them, on
/// one day.
/// <para>
/// Distinct from <see cref="StudySession"/>, which credits minutes for finishing
/// something — a lesson, a quiz, a practice attempt. That answers "how much did
/// they get through"; this answers "how long were they here", which includes
/// reading the catalogue, comparing careers and everything else that never
/// completes an activity.
/// </para>
/// <para>
/// One row per subject per day rather than per visit. A day is the grain every
/// report here actually uses, it bounds the table at roughly one row per active
/// person per day, and it means a heartbeat is an update rather than an insert.
/// </para>
/// </summary>
public class AppUsageDay : Entity
{
    /// <summary>Null for a visitor with no account.</summary>
    public Guid? UserId { get; set; }

    /// <summary>
    /// A random first-party identifier the browser keeps, used only when there
    /// is no account. It is not derived from anything about the person or their
    /// device — no fingerprinting — so clearing site data ends that visitor and
    /// starts a new one. Null once <see cref="UserId"/> is set.
    /// </summary>
    public string? VisitorId { get; set; }

    public DateOnly OnDate { get; set; }

    /// <summary>Seconds the tab was visible. Accumulated from heartbeats.</summary>
    public int Seconds { get; set; }

    public DateTimeOffset LastSeenAt { get; set; }
    public DateTimeOffset FirstSeenAt { get; set; }

    /// <summary>
    /// From the most recent heartbeat of the day. Resolved to a place through
    /// the shared <see cref="IpLocation"/> cache when the report is read, so
    /// reporting makes no outbound calls and a heartbeat stays cheap.
    /// </summary>
    public string? LastIpAddress { get; set; }

    public string? LastUserAgent { get; set; }
}
