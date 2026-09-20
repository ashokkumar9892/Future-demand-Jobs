namespace FutureTech.Application.Contracts;

// ---------- Auth ----------

/// <summary>
/// Years of experience is optional and defaults to unset: it is asked for
/// during onboarding, not at the point of creating an account, where it was
/// only friction between someone and signing up.
/// </summary>
public record RegisterRequest(string Email, string Password, string DisplayName, int YearsExperience = 0);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string Token, DateTimeOffset ExpiresAt, UserProfileDto User);

public record UserProfileDto(
    Guid Id, string Email, string DisplayName, string Role, string ThemePreference,
    int YearsExperience, bool OnboardingCompleted, Guid? TargetCareerPathId,
    string? TargetCareerTitle);

// ---------- Study planning ----------

public record StudyProfileDto(
    double WeekdayHours, double SaturdayHours, double SundayHours,
    IReadOnlyList<string> StudyDays, string? TargetCompletionDate,
    Guid? TargetCareerPathId, string? TargetCareerTitle,
    int DesiredSalaryUsd, int CurrentSkillLevel, string TrackMode,
    double WeeklyHours, bool OnboardingCompleted);

public record StudyProfileUpdateRequest(
    double WeekdayHours, double SaturdayHours, double SundayHours,
    IReadOnlyList<string> StudyDays, string? TargetCompletionDate,
    Guid? TargetCareerPathId, int DesiredSalaryUsd, int CurrentSkillLevel,
    string TrackMode, bool CompleteOnboarding, int? YearsExperience = null);

public record StudyCalculationRequest(double WeeklyHours, string TrackMode, Guid? CareerPathId);

/// <summary>Everything the study-time calculator screen displays.</summary>
public record StudyCalculationDto(
    string CareerTitle,
    string TrackMode,
    int TotalCourseHours,
    int HoursCompleted,
    int HoursRemaining,
    double WeeklyHours,
    double DailyHoursRequired,
    int WeeksRemaining,
    int DaysRemaining,
    double MonthsRemaining,
    string EstimatedCompletionDate,
    string EstimatedCompletionMonth,
    IReadOnlyList<TrackBreakdownDto> Breakdown,
    IReadOnlyList<PaceScenarioDto> PaceScenarios,
    string Disclaimer);

public record TrackBreakdownDto(string Area, int Hours, int CompletedHours);

public record PaceScenarioDto(double WeeklyHours, int Weeks, double Months, string Label);

public record StudyPlanItemDto(
    Guid Id, int Order, string ActivityType, string Title, int Minutes,
    string RefType, Guid? RefId, string? DeepLink, string Status);

public record StudyPlanDayDto(
    Guid Id, string OnDate, string DayOfWeek, string Status, int TargetMinutes,
    int CompletedMinutes, IReadOnlyList<StudyPlanItemDto> Items);

public record GeneratePlanRequest(string? FromDate, int Weeks);

public record StartTodayResponse(
    StudyPlanItemDto? NextItem, string? DeepLink, StudyPlanDayDto? Today, string Message);

// ---------- Dashboard ----------

public record ProgressRingDto(string Label, int Percent, string? Detail);

public record SkillRadarPointDto(string Skill, int Current, int Target);

public record WeeklyHoursPointDto(string WeekLabel, double PlannedHours, double ActualHours);

public record DashboardTodayItemDto(string Title, string ActivityType, int Minutes, string? DeepLink, string Status);

public record DashboardDto(
    string Greeting,
    string DisplayName,
    string? TargetCareerTitle,
    string? TargetCareerSlug,
    string TargetSalaryRange,
    string EstimatedCompletion,
    int ProgressPercent,
    int StudyStreakDays,
    int HoursCompleted,
    int TotalHours,
    int CoursesCompleted,
    int TotalCourses,
    int ProjectsCompleted,
    int TotalProjects,
    int PracticeQuestionsAnswered,
    IReadOnlyList<ProgressRingDto> ReadinessRings,
    IReadOnlyList<SkillRadarPointDto> SkillRadar,
    IReadOnlyList<WeeklyHoursPointDto> WeeklyHours,
    IReadOnlyList<DashboardTodayItemDto> Today,
    NextUpDto NextUp,
    CurrentProjectDto? CurrentProject,
    UpcomingCertificationDto? UpcomingCertification,
    GamificationDto Gamification);

public record NextUpDto(
    string? NextLessonTitle, string? NextLessonSlug,
    string? NextPracticeTitle, Guid? NextPracticeId,
    string? NextProjectTitle, string? NextProjectSlug);

public record CurrentProjectDto(Guid Id, string Title, string Slug, int PercentComplete, int MilestonesDone, int MilestonesTotal);

public record UpcomingCertificationDto(Guid Id, string Code, string Name, string Status, string? TargetDate, int EstimatedPrepHours);

// ---------- Skills ----------

public record SkillMatrixRowDto(
    Guid SkillId, string Name, string Slug, string Category,
    int Current, int Target, int Gap, string Importance);

public record SkillMatrixDto(
    string? CareerTitle, IReadOnlyList<SkillMatrixRowDto> Rows,
    int AverageCurrent, int AverageTarget);

public record SkillLevelUpdateRequest(Guid SkillId, int CurrentLevel);

// ---------- Readiness ----------

public record ReadinessDimensionDto(string Name, int Score, double Weight);

public record CareerReadinessDto(
    Guid CareerPathId, string CareerTitle, string CareerSlug, int Rank,
    int Overall, string Verdict, string VerdictLabel,
    IReadOnlyList<ReadinessDimensionDto> Dimensions,
    string Disclaimer);

// ---------- Projects & certifications ----------

public record ProjectMilestoneDto(Guid Id, int Order, string Title, string Description, double EstimatedHours, bool Completed);

public record ProjectListItemDto(
    Guid Id, int Order, string Title, string Slug, string Summary, string TechStack,
    string Difficulty, int EstimatedHours, string Status, int PercentComplete);

public record ProjectDetailDto(
    ProjectListItemDto Project,
    string BriefMarkdown,
    string? ArchitectureMermaid,
    IReadOnlyList<string> AcceptanceCriteria,
    IReadOnlyList<string> ResumeBullets,
    IReadOnlyList<string> Skills,
    IReadOnlyList<ProjectMilestoneDto> Milestones,
    string? RepoUrl, string? DemoUrl, string Notes, bool IsBookmarked);

public record ProjectProgressRequest(string Status, string? RepoUrl, string? DemoUrl, string? Notes);

public record CertificationDto(
    Guid Id, string Code, string Name, string Vendor, string Level,
    int EstimatedPrepHours, IReadOnlyList<string> Topics, int ExamCostUsd,
    string OfficialUrl, string Status, string? TargetDate, string? CompletedDate,
    int? ScorePercent, int PrepHoursLogged, bool RecommendedForTarget);

public record UserCertificationUpdateRequest(string Status, string? TargetDate, string? CompletedDate, int? ScorePercent, int PrepHoursLogged);

// ---------- Resume ----------

public record ResumeItemDto(Guid Id, string Section, string Text, string EvidenceKind, string? SkillSlug, int Order);

public record ResumeDto(
    string Headline,
    string BeforeHeadline,
    string Summary,
    string GeneratedAt,
    IReadOnlyList<ResumeItemDto> Items,
    IReadOnlyList<string> SuggestedKeywords,
    int ReadinessPercent,
    string EvidencePolicy);

// ---------- Notes, bookmarks, search, gamification ----------

public record NoteDto(
    Guid Id, string Scope, Guid? RefId, string RefTitle, string Title, string Body,
    bool IsImportant, bool IsQuestion, string? CodeSnippet, string Links, string Tags,
    string CreatedAt, string? UpdatedAt);

public record NoteUpsertRequest(
    string Scope, Guid? RefId, string RefTitle, string Title, string Body,
    bool IsImportant, bool IsQuestion, string? CodeSnippet, string? Links, string? Tags);

public record BookmarkDto(Guid Id, string ItemType, Guid RefId, string Title, string Subtitle, string? DeepLink, string CreatedAt);

public record BookmarkRequest(string ItemType, Guid RefId, string Title, string Subtitle, string? DeepLink);

public record SearchResultDto(string Type, Guid Id, string Title, string Subtitle, string? DeepLink, string Matched);

public record SearchResponseDto(string Query, int Total, IReadOnlyList<SearchResultDto> Results);

public record BadgeDto(Guid Id, string Code, string Name, string Description, string Tier, string Criteria, bool Earned, string? EarnedAt);

public record GamificationDto(
    int TotalXp, int Level, string LevelTitle, int XpIntoLevel, int XpForNextLevel,
    int StudyStreakDays, int LongestStreakDays, int BadgesEarned, int BadgesTotal,
    IReadOnlyList<BadgeDto> Badges);

// ---------- Calendar ----------

public record CalendarDayDto(string OnDate, string Status, int TargetMinutes, int CompletedMinutes, int ItemCount, IReadOnlyList<string> Titles);

public record CalendarWeekDto(int WeekNumber, string Label, string StartDate, string EndDate, string Theme, IReadOnlyList<CalendarDayDto> Days);

public record CalendarMonthDto(int Year, int Month, string MonthName, IReadOnlyList<CalendarWeekDto> Weeks, int TotalPlannedMinutes, int TotalCompletedMinutes);

/// <summary>
/// The free-access thresholds, as the browser needs them.
/// <para>
/// Served anonymously: the gate cannot be applied until the visitor knows where
/// it is, and a visitor with no account is exactly who it applies to. Nothing
/// here is sensitive — it is the same information the wall states in words.
/// </para>
/// </summary>
public record AccessPolicyDto(
    bool AllowAnonymousBrowsing,
    int FreeMinutesBeforeSignup,
    int SignupNudgeAtPercent,
    int FreeMinutesBeforePayment,
    int FreeCoursesBeforePayment,
    bool PaymentPromptBlocks,
    string SignupPromptTitle,
    string SignupPromptBody,
    string PaymentPromptTitle,
    string PaymentPromptBody);

/// <summary>Admin edit. Every field is required so a partial save cannot silently reset one.</summary>
public record AccessPolicyRequest(
    bool AllowAnonymousBrowsing,
    int FreeMinutesBeforeSignup,
    int SignupNudgeAtPercent,
    int FreeMinutesBeforePayment,
    int FreeCoursesBeforePayment,
    bool PaymentPromptBlocks,
    string SignupPromptTitle,
    string SignupPromptBody,
    string PaymentPromptTitle,
    string PaymentPromptBody);

/// <summary>One market's band for one career, for the Admin salary editor.</summary>
public record AdminSalaryBandDto(
    Guid CareerPathId,
    string CareerTitle,
    string CareerSlug,
    string CountryCode,
    string CurrencyCode,
    int SalaryMin,
    int SalaryMax,
    int SeniorSalaryMin,
    int SeniorSalaryMax,
    string? AsOf,
    string Source,
    bool HasData);

public record SalaryBandRequest(
    int SalaryMin,
    int SalaryMax,
    int SeniorSalaryMin,
    int SeniorSalaryMax,
    string Source,
    string? AsOf);
