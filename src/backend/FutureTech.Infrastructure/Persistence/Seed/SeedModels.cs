namespace FutureTech.Infrastructure.Persistence.Seed;

// Shapes of the JSON content files under FutureTech.Api/SeedData.
// Content lives as data so it can be edited, versioned and extended by the
// Admin console without a rebuild.

public record SkillSeed(string Name, string Slug, string Category, int BaselineLevel);

public record CertificationSeed(
    string Code, string Name, string Vendor, string Level, int EstimatedPrepHours,
    List<string> Topics, int ExamCostUsd, string OfficialUrl);

public record MilestoneSeed(int Order, string Title, string Description, double EstimatedHours);

public record ProjectSeed(
    int Order, string Title, string Slug, string Summary, string BriefMarkdown, string TechStack,
    string Difficulty, int EstimatedHours, string? ArchitectureMermaid, List<string> AcceptanceCriteria,
    List<string> ResumeBullets, List<string> SkillSlugs, List<MilestoneSeed> Milestones);

public record CareerSkillSeed(string Slug, int TargetLevel, string Importance);

public record LadderStageSeed(
    int StageOrder, string Title, string RoleTitle, string Description,
    int SalaryMinUsd, int SalaryMaxUsd, int DurationMonths, List<string> Milestones, bool IsCurrentPosition);

public record ReadinessDimensionSeed(string Name, double Weight, List<string> SkillSlugs);

public record CareerSeed(
    int Rank, string Title, string Slug, string Summary,
    int SalaryMinUsd, int SalaryMaxUsd, int SeniorSalaryMinUsd, int SeniorSalaryMaxUsd,
    string TwoHundredKPotential, string SalaryAsOf, string SalarySource,
    string DemandOutlook, string DemandNotes, string AiReplacementRisk, string AiRiskNotes,
    string Difficulty, int EstimatedHours, bool IsPrimaryRecommended,
    List<string> ResumeKeywords, List<string> Responsibilities, List<string> InterviewFocus,
    List<CareerSkillSeed> Skills, List<LadderStageSeed> Ladder,
    List<ReadinessDimensionSeed> ReadinessDimensions,
    List<string> Certifications, List<string> Projects);

public record ResourceSeed(string Title, string Url, string Kind);

public record VideoSeed(string Title, string? Instructor, int DurationMinutes, string SkillLevel);

public record QuizOptionSeed(string Text, bool IsCorrect);

public record QuizQuestionSeed(string Prompt, string Explanation, bool AllowsMultiple, List<QuizOptionSeed> Options);

public record QuizSeed(string Title, int PassMarkPercent, List<QuizQuestionSeed> Questions);

public record LessonSeed(
    int Order, string Title, string Slug, string Type, int EstimatedMinutes, string MinimumTrack,
    string ContentMarkdown, string? CodeExample, string? CodeLanguage, string? DiagramMermaid,
    List<string> KeyTakeaways, List<ResourceSeed>? Resources, VideoSeed? Video, QuizSeed? Quiz);

public record ModuleSeed(int Order, string Title, string Summary, double EstimatedHours, List<LessonSeed> Lessons);

public record CourseSeed(
    string CareerSlug, int Order, int PhaseNumber, string Title, string Slug, string Summary,
    int EstimatedHours, string Level, string MinimumTrack, List<string> Outcomes,
    List<string> SkillSlugs, List<ModuleSeed> Modules);

public record RubricSeed(string Dimension, double Weight, List<string> Keywords, string Guidance);

public record PracticeSeed(
    string? CareerSlug, string Category, string Mode, string Prompt, string Scenario,
    string ModelAnswer, List<RubricSeed> Rubric, string Tags, int EstimatedMinutes);

public record InterviewSeed(
    string? CareerSlug, string Category, string Difficulty, string Question, string SuggestedAnswer,
    string Tips, int TimeLimitSeconds, List<string> FollowUps, List<RubricSeed> Rubric);

public record ChoiceGroupSeed(string Key, string Label, List<string> Options);

public record SuggestionSeed(string Key, string Answer, List<string> Acceptable, string Rationale);

public record ArchitectureChallengeSeed(
    string Title, string Slug, string Scenario, List<string> Requirements,
    List<ChoiceGroupSeed> ChoiceGroups, List<SuggestionSeed> Suggested, string Rationale,
    string? DiagramMermaid, string Difficulty, int EstimatedMinutes);

public record CodingTestSeed(string Name, List<string> MustContain, List<string>? MustNotContain, string Hint);

public record CodingExerciseSeed(
    string Category, string Title, string Slug, string Difficulty, string ProblemMarkdown,
    string Language, string StarterCode, List<CodingTestSeed> Tests, string SolutionCode,
    string Explanation, int EstimatedMinutes);

public record BadgeSeed(string Code, string Name, string Description, string Tier, string Criteria, int XpReward);
