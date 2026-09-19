using FutureTech.Domain.Common;

namespace FutureTech.Domain.Entities;

public class PracticeQuestion : Entity
{
    public Guid? CareerPathId { get; set; }
    public string Category { get; set; } = string.Empty;
    public PracticeMode Mode { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public string Scenario { get; set; } = string.Empty;
    public string ModelAnswer { get; set; } = string.Empty;
    /// <summary>
    /// JSON array: [{ "dimension": "Security", "weight": 0.2,
    /// "keywords": ["managed identity","key vault"], "guidance": "..." }]
    /// </summary>
    public string RubricJson { get; set; } = "[]";
    public string Tags { get; set; } = string.Empty;
    public int EstimatedMinutes { get; set; } = 15;
}

public class PracticeAttempt : Entity
{
    public Guid UserId { get; set; }
    public Guid PracticeQuestionId { get; set; }
    public PracticeQuestion? PracticeQuestion { get; set; }
    public string AnswerText { get; set; } = string.Empty;
    public int Score { get; set; }
    public string DimensionScoresJson { get; set; } = "[]";
    public string Strengths { get; set; } = string.Empty;
    public string Weaknesses { get; set; } = string.Empty;
    public int MinutesSpent { get; set; }
}

public class ArchitectureChallenge : Entity
{
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Scenario { get; set; } = string.Empty;
    /// <summary>JSON array of requirement strings shown as a checklist.</summary>
    public string RequirementsJson { get; set; } = "[]";
    /// <summary>
    /// JSON array: [{ "key": "frontend", "label": "Frontend",
    /// "options": ["Angular","React",...] }]
    /// </summary>
    public string ChoiceGroupsJson { get; set; } = "[]";
    /// <summary>
    /// JSON array: [{ "key": "frontend", "answer": "Angular",
    /// "acceptable": ["React"], "rationale": "..." }]
    /// </summary>
    public string SuggestedArchitectureJson { get; set; } = "[]";
    public string Rationale { get; set; } = string.Empty;
    public string? DiagramMermaid { get; set; }
    public DifficultyLevel Difficulty { get; set; }
    public int EstimatedMinutes { get; set; } = 30;
}

public class ArchitectureAttempt : Entity
{
    public Guid UserId { get; set; }
    public Guid ArchitectureChallengeId { get; set; }
    public string SelectionsJson { get; set; } = "{}";
    public int Score { get; set; }
    public string PerGroupScoresJson { get; set; } = "[]";
}

public class CodingExercise : Entity
{
    public string Category { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public DifficultyLevel Difficulty { get; set; }
    public string ProblemMarkdown { get; set; } = string.Empty;
    public string Language { get; set; } = "csharp";
    public string StarterCode { get; set; } = string.Empty;
    /// <summary>
    /// JSON array: [{ "name": "chunks overlap", "mustContain": ["overlap"],
    /// "mustNotContain": [], "hint": "..." }]
    /// Static checks; real execution is a documented future upgrade.
    /// </summary>
    public string TestsJson { get; set; } = "[]";
    public string SolutionCode { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
    public int EstimatedMinutes { get; set; } = 25;
}

public class CodingAttempt : Entity
{
    public Guid UserId { get; set; }
    public Guid CodingExerciseId { get; set; }
    public string SubmittedCode { get; set; } = string.Empty;
    public bool Passed { get; set; }
    public string TestResultsJson { get; set; } = "[]";
    public int Score { get; set; }
}

public class InterviewQuestion : Entity
{
    public Guid? CareerPathId { get; set; }
    public InterviewCategory Category { get; set; }
    public DifficultyLevel Difficulty { get; set; }
    public string Question { get; set; } = string.Empty;
    public string SuggestedAnswer { get; set; } = string.Empty;
    public string Tips { get; set; } = string.Empty;
    public int TimeLimitSeconds { get; set; } = 300;
    /// <summary>JSON array of follow-up prompts the mock interviewer can chain.</summary>
    public string FollowUpsJson { get; set; } = "[]";
    public string RubricJson { get; set; } = "[]";
}

public class InterviewAttempt : Entity
{
    public Guid UserId { get; set; }
    public Guid InterviewQuestionId { get; set; }
    public InterviewQuestion? InterviewQuestion { get; set; }
    public string AnswerText { get; set; } = string.Empty;
    public int Score { get; set; }
    public string Feedback { get; set; } = string.Empty;
    public int SecondsTaken { get; set; }
}

public class MockInterviewSession : Entity
{
    public Guid UserId { get; set; }
    public Guid CareerPathId { get; set; }
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }
    public int Communication { get; set; }
    public int TechnicalKnowledge { get; set; }
    public int Architecture { get; set; }
    public int ProblemSolving { get; set; }
    public int SecurityAwareness { get; set; }
    public int OverallScore { get; set; }
    public string Recommendations { get; set; } = string.Empty;
    public ICollection<MockInterviewTurn> Turns { get; set; } = new List<MockInterviewTurn>();
}

public class MockInterviewTurn : Entity
{
    public Guid MockInterviewSessionId { get; set; }
    public int Order { get; set; }
    public Guid? InterviewQuestionId { get; set; }
    public string Question { get; set; } = string.Empty;
    public bool IsFollowUp { get; set; }
    public string AnswerText { get; set; } = string.Empty;
    public int TurnScore { get; set; }
    public string Feedback { get; set; } = string.Empty;
}
