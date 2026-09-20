namespace FutureTech.Application.Contracts;

// ---------- feedback ----------

public record FeedbackSubmitRequest(
    string Category,
    string Subject,
    string Message,
    int Rating = 0,
    string? Area = null,
    string? RefType = null,
    Guid? RefId = null);

/// <summary>
/// One feedback row. <c>AdminNote</c> is intentionally absent — it is internal
/// triage and this record is also returned to the learner who wrote the item.
/// </summary>
public record FeedbackDto(
    Guid Id,
    Guid UserId,
    string LearnerName,
    string LearnerEmail,
    string Category,
    string Subject,
    string Message,
    int Rating,
    string? Area,
    string? RefType,
    Guid? RefId,
    string Status,
    string? AdminResponse,
    string? ImplementationNote,
    string? HandledByName,
    DateTimeOffset SubmittedAt,
    DateTimeOffset? RespondedAt,
    DateTimeOffset? ImplementedAt);

/// <summary>Adds the internal note. Admin endpoints only.</summary>
public record AdminFeedbackDto(FeedbackDto Item, string? AdminNote);

/// <summary>Every field is optional: an admin can reply without moving the status, or the reverse.</summary>
public record FeedbackUpdateRequest(
    string? Status = null,
    string? AdminResponse = null,
    string? AdminNote = null,
    string? ImplementationNote = null);

public record FeedbackCategoryCountDto(string Category, int Count, double AverageRating);

public record FeedbackSummaryDto(
    int Total,
    int Open,
    int New,
    int UnderReview,
    int Planned,
    int InProgress,
    int Implemented,
    int Declined,
    double AverageRating,
    int RatedCount,
    IReadOnlyList<FeedbackCategoryCountDto> ByCategory);

// ---------- login activity ----------

public record LoginEventDto(
    Guid Id,
    Guid? UserId,
    string Email,
    string DisplayName,
    string Outcome,
    DateTimeOffset At,
    string IpAddress,
    // Display-ready: "Pune, Maharashtra, India", "Local network", or "Unknown".
    string Location,
    string? City,
    string? Region,
    string? Country,
    string? CountryCode,
    string? TimeZone,
    string? Isp,
    double? Latitude,
    double? Longitude,
    string Browser,
    string OperatingSystem,
    string DeviceKind,
    string GeoState);

public record LocationRollupDto(string Location, string? CountryCode, int LoginCount, int Learners, DateTimeOffset LastSeenAt);

// ---------- learners ----------

public record LearnerRowDto(
    Guid Id,
    string Email,
    string DisplayName,
    string Role,
    int YearsExperience,
    DateTimeOffset JoinedAt,
    bool OnboardingCompleted,
    string? TargetCareer,
    DateTimeOffset? LastLoginAt,
    string? LastLocation,
    string? LastDevice,
    string? LastIpAddress,
    int LoginCount,
    int FailedLoginCount,
    // The course with the most recent activity — what they are working on now.
    string? CurrentCourse,
    Guid? CurrentCourseId,
    double CurrentCoursePercent,
    int CoursesStarted,
    int CoursesCompleted,
    int LessonsCompleted,
    int LessonsInProgress,
    int MinutesStudied,
    int Xp,
    int FeedbackCount,
    DateTimeOffset? LastActivityAt);

public record LearnerCourseProgressDto(
    Guid CourseId,
    string Title,
    string Slug,
    int PhaseNumber,
    string Level,
    int TotalLessons,
    int CompletedLessons,
    int InProgressLessons,
    double PercentComplete,
    int MinutesSpent,
    string Status,
    DateTimeOffset? StartedAt,
    DateTimeOffset? LastActivityAt);

public record LearnerDetailDto(
    LearnerRowDto Learner,
    IReadOnlyList<LearnerCourseProgressDto> Courses,
    IReadOnlyList<LoginEventDto> Logins,
    IReadOnlyList<LocationRollupDto> Locations,
    IReadOnlyList<FeedbackDto> Feedback);

// ---------- course engagement ----------

public record CourseEngagementDto(
    Guid CourseId,
    string Title,
    string Slug,
    int PhaseNumber,
    int TotalLessons,
    int Learners,
    int ActiveLast7Days,
    int CompletedLearners,
    double AveragePercent,
    int MinutesStudied,
    DateTimeOffset? LastActivityAt);

public record EngagementOverviewDto(
    int TotalLearners,
    int NewLast30Days,
    int ActiveLast7Days,
    int ActiveLast30Days,
    int LoginsLast7Days,
    int FailedLoginsLast7Days,
    int OpenFeedback,
    int ImplementedFeedback,
    double AverageRating,
    IReadOnlyList<LocationRollupDto> TopLocations,
    IReadOnlyList<CourseEngagementDto> TopCourses);

/// <summary>Shared envelope for the admin's paged tables.</summary>
public record PagedDto<T>(int Total, int Page, int PageSize, IReadOnlyList<T> Items);

// ---------- time in the application ----------

public record UsageHeartbeatRequest(string? VisitorId, int Seconds);

/// <summary>One day's totals, split by whether the person had an account.</summary>
public record UsageDayDto(
    string Date,
    int LearnerMinutes,
    int VisitorMinutes,
    int Learners,
    int Visitors);

public record UsagePersonDto(
    Guid? UserId,
    string Name,
    int Minutes,
    int ActiveDays,
    DateTimeOffset LastSeenAt);

/// <summary>
/// Time people actually had the application open, as opposed to minutes
/// credited for completing something.
/// </summary>
public record UsageOverviewDto(
    int Days,
    int TotalMinutes,
    int LearnerMinutes,
    int VisitorMinutes,
    int ActiveLearners,
    int ActiveVisitors,
    double AverageMinutesPerLearner,
    double AverageMinutesPerVisitor,
    int MinutesToday,
    IReadOnlyList<UsageDayDto> Daily,
    IReadOnlyList<UsagePersonDto> TopLearners);
