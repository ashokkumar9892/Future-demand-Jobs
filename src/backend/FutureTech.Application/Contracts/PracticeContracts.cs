namespace FutureTech.Application.Contracts;

public record PracticeListItemDto(
    Guid Id, string Category, string Mode, string Prompt, string Tags,
    int EstimatedMinutes, int? BestScore, int AttemptCount);

public record RubricDimensionDto(string Dimension, double Weight, string Guidance);

public record PracticeDetailDto(
    Guid Id, string Category, string Mode, string Prompt, string Scenario,
    string Tags, int EstimatedMinutes,
    IReadOnlyList<RubricDimensionDto> Rubric,
    int? BestScore, string? LastAnswer, bool IsBookmarked);

public record PracticeAttemptRequest(string AnswerText, int MinutesSpent);

public record DimensionScoreDto(string Dimension, int Score, double Weight, string Comment);

public record PracticeResultDto(
    int Score,
    IReadOnlyList<DimensionScoreDto> Dimensions,
    IReadOnlyList<string> Strengths,
    IReadOnlyList<string> Weaknesses,
    string ModelAnswer,
    string EvaluationMethod,
    int XpAwarded);

public record ArchitectureChoiceGroupDto(string Key, string Label, IReadOnlyList<string> Options);

public record ArchitectureChallengeListItemDto(
    Guid Id, string Title, string Slug, string Scenario, string Difficulty,
    int EstimatedMinutes, int? BestScore);

public record ArchitectureChallengeDetailDto(
    Guid Id, string Title, string Slug, string Scenario, string Difficulty,
    int EstimatedMinutes,
    IReadOnlyList<string> Requirements,
    IReadOnlyList<ArchitectureChoiceGroupDto> ChoiceGroups,
    string? DiagramMermaid,
    int? BestScore);

public record ArchitectureAttemptRequest(Dictionary<string, string> Selections);

public record ArchitectureGroupResultDto(
    string Key, string Label, string YourChoice, string SuggestedChoice,
    bool Matched, bool Acceptable, string Rationale);

public record ArchitectureResultDto(
    int Score, IReadOnlyList<ArchitectureGroupResultDto> Groups,
    string Rationale, string? DiagramMermaid, int XpAwarded);

public record CodingExerciseListItemDto(
    Guid Id, string Category, string Title, string Slug, string Difficulty,
    string Language, int EstimatedMinutes, bool Passed, int? BestScore);

public record CodingExerciseDetailDto(
    Guid Id, string Category, string Title, string Slug, string Difficulty,
    string ProblemMarkdown, string Language, string StarterCode,
    IReadOnlyList<string> TestNames, int EstimatedMinutes,
    string? LastSubmission, bool Passed, bool IsBookmarked);

public record CodingAttemptRequest(string Code);

public record CodingTestResultDto(string Name, bool Passed, string Hint);

public record CodingResultDto(
    bool Passed, int Score, IReadOnlyList<CodingTestResultDto> Tests,
    string? SolutionCode, string? Explanation, int XpAwarded, string EvaluationMethod);

public record InterviewQuestionListItemDto(
    Guid Id, string Category, string Difficulty, string Question,
    int TimeLimitSeconds, int? BestScore, int AttemptCount);

public record InterviewQuestionDetailDto(
    Guid Id, string Category, string Difficulty, string Question,
    string Tips, int TimeLimitSeconds, IReadOnlyList<string> FollowUps,
    int? BestScore, bool IsBookmarked);

public record InterviewAttemptRequest(string AnswerText, int SecondsTaken);

public record InterviewResultDto(
    int Score, IReadOnlyList<DimensionScoreDto> Dimensions,
    IReadOnlyList<string> Strengths, IReadOnlyList<string> Weaknesses,
    string SuggestedAnswer, string EvaluationMethod, int XpAwarded);

public record MockInterviewStartRequest(Guid? CareerPathId, int QuestionCount);

public record MockInterviewTurnDto(
    Guid Id, int Order, string Question, bool IsFollowUp,
    string? AnswerText, int? TurnScore, string? Feedback);

public record MockInterviewStateDto(
    Guid SessionId, string CareerTitle, int TurnsAnswered, int TotalPlanned,
    MockInterviewTurnDto? CurrentTurn, bool IsComplete,
    IReadOnlyList<MockInterviewTurnDto> History);

public record MockInterviewAnswerRequest(string AnswerText);

public record MockInterviewScorecardDto(
    Guid SessionId,
    int Communication, int TechnicalKnowledge, int Architecture,
    int ProblemSolving, int SecurityAwareness, int OverallScore,
    IReadOnlyList<string> Recommendations,
    IReadOnlyList<MockInterviewTurnDto> Turns,
    string EvaluationMethod);
