using FutureTech.Domain.Common;

namespace FutureTech.Domain.Entities;

/// <summary>
/// One row per sign-in attempt, successful or not.
/// <para>
/// Location is denormalised onto the event rather than read through the IP
/// cache at display time: an address can be reassigned, and the history has to
/// keep saying where the learner was when they signed in.
/// </para>
/// </summary>
public class LoginEvent : Entity
{
    /// <summary>Null when the submitted email matched no account.</summary>
    public Guid? UserId { get; set; }
    public AppUser? User { get; set; }

    /// <summary>The address as typed, so attempts against a non-existent account are traceable.</summary>
    public string Email { get; set; } = string.Empty;
    public LoginOutcome Outcome { get; set; }

    public string IpAddress { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
    public string Browser { get; set; } = "Unknown";
    public string OperatingSystem { get; set; } = "Unknown";
    /// <summary>"Desktop" | "Mobile" | "Tablet" | "Bot" | "Unknown".</summary>
    public string DeviceKind { get; set; } = "Unknown";

    public GeoLookupState GeoState { get; set; } = GeoLookupState.Pending;
    public string? City { get; set; }
    public string? Region { get; set; }
    public string? Country { get; set; }
    public string? CountryCode { get; set; }
    public string? TimeZone { get; set; }
    public string? Isp { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}

/// <summary>
/// Cached geo-IP answer, one row per address. Lookups are rate-limited by the
/// provider and an address rarely moves, so every login after the first from a
/// given IP is served from here without leaving the process.
/// </summary>
public class IpLocation : Entity
{
    public string IpAddress { get; set; } = string.Empty;
    public GeoLookupState State { get; set; } = GeoLookupState.Pending;

    public string? City { get; set; }
    public string? Region { get; set; }
    public string? Country { get; set; }
    public string? CountryCode { get; set; }
    public string? TimeZone { get; set; }
    public string? Isp { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    /// <summary>Which provider answered, recorded so a stale cache can be traced.</summary>
    public string Source { get; set; } = string.Empty;
    public DateTimeOffset ResolvedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// Learner feedback and the admin's handling of it. The admin fields live on
/// the same row so the learner can see what was decided without a second table.
/// </summary>
public class Feedback : Entity
{
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }

    public FeedbackCategory Category { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    /// <summary>1–5. Zero means the learner did not rate.</summary>
    public int Rating { get; set; }

    /// <summary>Free-text context, e.g. the course or page the feedback is about.</summary>
    public string? Area { get; set; }
    /// <summary>"course" | "lesson" | "video" | "project" | "practice", when the learner came from one.</summary>
    public string? RefType { get; set; }
    public Guid? RefId { get; set; }

    public FeedbackStatus Status { get; set; } = FeedbackStatus.New;

    /// <summary>Shown to the learner.</summary>
    public string? AdminResponse { get; set; }
    /// <summary>Internal triage note. Never returned on a learner-facing endpoint.</summary>
    public string? AdminNote { get; set; }
    /// <summary>What was actually changed when the status reached Implemented.</summary>
    public string? ImplementationNote { get; set; }

    public Guid? HandledByUserId { get; set; }
    public string? HandledByName { get; set; }
    public DateTimeOffset? RespondedAt { get; set; }
    public DateTimeOffset? ImplementedAt { get; set; }
}
