namespace FutureTech.Domain.Common;

public enum UserRole { Learner = 0, Admin = 1 }

public enum SkillCategory
{
    Language = 0, Framework = 1, Cloud = 2, Ai = 3, Architecture = 4,
    Security = 5, Data = 6, DevOps = 7, Soft = 8
}

public enum SkillImportance { Core = 0, Important = 1, NiceToHave = 2 }

public enum DemandOutlook { Moderate = 0, Strong = 1, VeryStrong = 2, Explosive = 3 }

/// <summary>How exposed the role is to being automated away. Lower is safer.</summary>
public enum AiReplacementRisk { VeryLow = 0, Low = 1, Moderate = 2, High = 3 }

public enum DifficultyLevel { Foundational = 0, Intermediate = 1, Advanced = 2, Expert = 3 }

/// <summary>Depth the learner opts into. Drives which lessons are scheduled.</summary>
public enum TrackMode { FastTrack = 0, Balanced = 1, Deep = 2 }

public enum LessonType { Concept = 0, Lab = 1, Architecture = 2, Coding = 3, Review = 4, Assessment = 5 }

public enum ResourceKind { Documentation = 0, Article = 1, Specification = 2, Repository = 3, Book = 4 }

public enum ProgressStatus { NotStarted = 0, InProgress = 1, Completed = 2 }

public enum PlanStatus { NotStarted = 0, Scheduled = 1, InProgress = 2, Completed = 3, Late = 4 }

public enum StudyActivityType
{
    Video = 0, Reading = 1, Practice = 2, Coding = 3, Quiz = 4,
    Architecture = 5, Project = 6, Interview = 7, Review = 8, Assessment = 9
}

public enum PracticeMode { Easy = 0, Medium = 1, Hard = 2, Architect = 3, Interview = 4, Scenario = 5 }

public enum InterviewCategory
{
    Technical = 0, Architecture = 1, Behavioral = 2, Ai = 3,
    Cloud = 4, SystemDesign = 5, Coding = 6
}

public enum CertificationStatus { NotStarted = 0, Planned = 1, Studying = 2, Scheduled = 3, Passed = 4, Failed = 5 }

public enum BookmarkItemType
{
    Lesson = 0, Video = 1, PracticeQuestion = 2, Project = 3,
    ArchitecturePattern = 4, InterviewQuestion = 5, Course = 6, CodingExercise = 7
}

public enum NoteScope { Lesson = 0, Course = 1, Project = 2, PracticeQuestion = 3, InterviewQuestion = 4, General = 5 }

/// <summary>
/// Provenance of a resume line. Required so the builder can never present
/// training or a personal project as professional experience.
/// </summary>
public enum EvidenceKind { ProfessionalExperience = 0, PersonalProject = 1, Training = 2, Certification = 3 }

public enum BadgeTier { Bronze = 0, Silver = 1, Gold = 2, Platinum = 3 }

public enum ReadinessVerdict { NeedsTraining = 0, AlmostReady = 1, Ready = 2 }

/// <summary>Why a sign-in attempt was recorded. Failures are kept so repeated
/// attempts against an account are visible to an admin.</summary>
public enum LoginOutcome { Success = 0, WrongPassword = 1, UnknownAccount = 2 }

/// <summary>How far a login's IP address got through geo resolution.</summary>
public enum GeoLookupState
{
    /// <summary>Queued for lookup; the row shows the IP until it resolves.</summary>
    Pending = 0,
    Resolved = 1,
    /// <summary>Loopback or RFC1918 — there is nothing to resolve.</summary>
    Private = 2,
    /// <summary>Lookup is disabled, or the provider could not place the address.</summary>
    Unavailable = 3
}

public enum FeedbackCategory
{
    General = 0, Course = 1, Lesson = 2, Video = 3, Practice = 4,
    Project = 5, Bug = 6, FeatureRequest = 7, Content = 8
}

/// <summary>
/// Triage state an admin moves feedback through. <see cref="Implemented"/> is
/// terminal and records what was actually changed.
/// </summary>
public enum FeedbackStatus
{
    New = 0, UnderReview = 1, Planned = 2, InProgress = 3, Implemented = 4, Declined = 5
}
