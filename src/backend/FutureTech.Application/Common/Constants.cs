namespace FutureTech.Application.Common;

public static class Disclaimers
{
    public const string Estimate =
        "These are learning-time estimates based on your stated study hours. " +
        "They are not guarantees of employment, salary, or hiring outcomes.";

    public const string Readiness =
        "Readiness reflects measured learning progress and assessment performance on this " +
        "platform. It is not a professional qualification and does not certify job competence.";

    public const string Evidence =
        "Every line is tagged with its evidence type. Training and personal projects are never " +
        "presented as professional experience.";

    public const string DeterministicEvaluator =
        "Rubric-based automated review (keyword coverage, structure and depth). " +
        "Not a human or model-graded assessment.";

    public const string StaticCodeCheck =
        "Static rubric check against required constructs. Code is not executed in this build.";
}

/// <summary>Rules for course completion certificates.</summary>
public static class Certificates
{
    /// <summary>
    /// Completion needed before a certificate can be issued. Not 100%: a course
    /// carries optional depth a Fast-Track learner is not expected to sit.
    /// </summary>
    public const int MinimumPercent = 80;

    public const string Statement =
        "This certificate records lesson completion on the FutureTech Career Academy platform. " +
        "It is not an accredited qualification and does not certify professional competence.";
}

public static class Xp
{
    public const int LessonCompleted = 50;
    public const int QuizPassed = 40;
    public const int PracticeAttempt = 30;
    public const int ArchitectureAttempt = 60;
    public const int CodingPassed = 70;
    public const int InterviewAttempt = 35;
    public const int MockInterviewCompleted = 150;
    public const int ProjectMilestone = 80;
    public const int ProjectCompleted = 400;
    public const int CertificationPassed = 500;

    /// <summary>Levels are 1000 XP wide; titles stay professional, not playful.</summary>
    public const int PerLevel = 1000;

    public static string LevelTitle(int level) => level switch
    {
        <= 1 => "Practitioner",
        2 => "Senior Practitioner",
        3 => "Cloud Builder",
        4 => "AI Builder",
        5 => "Integration Engineer",
        6 => "Solutions Designer",
        7 => "Solutions Architect",
        8 => "Principal Architect",
        _ => "Distinguished Architect"
    };
}
