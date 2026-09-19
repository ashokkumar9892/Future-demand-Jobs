namespace FutureTech.Application.Contracts;

public record CareerSummaryDto(
    Guid Id,
    int Rank,
    string Title,
    string Slug,
    string Summary,
    int SalaryMinUsd,
    int SalaryMaxUsd,
    int SeniorSalaryMinUsd,
    int SeniorSalaryMaxUsd,
    string TwoHundredKPotential,
    string DemandOutlook,
    string DemandNotes,
    string AiReplacementRisk,
    string AiRiskNotes,
    string Difficulty,
    int EstimatedHours,
    int EstimatedWeeksAt12Hours,
    bool IsPrimaryRecommended,
    int SkillsYouHave,
    int SkillsToLearn,
    string SalaryAsOf,
    string SalarySource);

public record SkillGapEntryDto(
    Guid SkillId,
    string Name,
    string Slug,
    string Category,
    string Importance,
    int CurrentLevel,
    int TargetLevel,
    int Gap);

public record LadderStageDto(
    int StageOrder,
    string Title,
    string RoleTitle,
    string Description,
    int SalaryMinUsd,
    int SalaryMaxUsd,
    int DurationMonths,
    IReadOnlyList<string> Milestones,
    bool IsCurrentPosition);

public record CareerCertificationDto(
    Guid Id, string Code, string Name, string Vendor, string Level,
    int EstimatedPrepHours, int ExamCostUsd, string OfficialUrl, int Priority);

public record CareerProjectDto(Guid Id, string Title, string Slug, string Summary, string TechStack, int EstimatedHours);

public record CareerCourseDto(
    Guid Id, int PhaseNumber, string Title, string Slug, string Summary,
    int EstimatedHours, string Level, int LessonCount, int CompletedLessons);

public record CareerDetailDto(
    CareerSummaryDto Summary,
    IReadOnlyList<string> ResumeKeywords,
    IReadOnlyList<string> Responsibilities,
    IReadOnlyList<string> InterviewFocus,
    IReadOnlyList<SkillGapEntryDto> SkillsYouHave,
    IReadOnlyList<SkillGapEntryDto> SkillsToLearn,
    IReadOnlyList<LadderStageDto> Ladder,
    IReadOnlyList<CareerCertificationDto> Certifications,
    IReadOnlyList<CareerProjectDto> Projects,
    IReadOnlyList<CareerCourseDto> Courses,
    int TotalTrainingHours,
    TrainingEstimateDto Estimate);

/// <summary>Hours/weeks/ETA for a track. Always shown with the estimate disclaimer.</summary>
public record TrainingEstimateDto(
    int TotalHours,
    double WeeklyHours,
    int Weeks,
    double Months,
    string EstimatedCompletionDate,
    string EstimatedCompletionMonth,
    double DailyHoursRequired,
    string TrackMode,
    string Disclaimer);

public record SalaryUpdateRequest(
    int SalaryMinUsd, int SalaryMaxUsd,
    int SeniorSalaryMinUsd, int SeniorSalaryMaxUsd,
    string Source, string? TwoHundredKPotential);
