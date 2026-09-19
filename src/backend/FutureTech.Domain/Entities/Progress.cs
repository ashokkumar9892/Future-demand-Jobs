using FutureTech.Domain.Common;

namespace FutureTech.Domain.Entities;

public class LessonProgress : Entity
{
    public Guid UserId { get; set; }
    public Guid LessonId { get; set; }
    public Lesson? Lesson { get; set; }
    public ProgressStatus Status { get; set; }
    public bool VideoWatched { get; set; }
    public int MinutesSpent { get; set; }
    public int? QuizScorePercent { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}

public class StudySession : Entity
{
    public Guid UserId { get; set; }
    public DateOnly OnDate { get; set; }
    public int Minutes { get; set; }
    public StudyActivityType ActivityType { get; set; }
    public string RefType { get; set; } = string.Empty;
    public Guid? RefId { get; set; }
}

public class StudyPlanDay : Entity
{
    public Guid UserId { get; set; }
    public DateOnly OnDate { get; set; }
    public PlanStatus Status { get; set; }
    public int TargetMinutes { get; set; }
    public ICollection<StudyPlanItem> Items { get; set; } = new List<StudyPlanItem>();
}

public class StudyPlanItem : Entity
{
    public Guid StudyPlanDayId { get; set; }
    public StudyPlanDay? Day { get; set; }
    public int Order { get; set; }
    public StudyActivityType ActivityType { get; set; }
    public string Title { get; set; } = string.Empty;
    public int Minutes { get; set; }
    /// <summary>"lesson" | "practice" | "project" | "coding" | "interview" | "architecture".</summary>
    public string RefType { get; set; } = string.Empty;
    public Guid? RefId { get; set; }
    /// <summary>Route the START TODAY'S TRAINING button jumps to.</summary>
    public string? DeepLink { get; set; }
    public PlanStatus Status { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}

public class Note : Entity
{
    public Guid UserId { get; set; }
    public NoteScope Scope { get; set; }
    public Guid? RefId { get; set; }
    public string RefTitle { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public bool IsImportant { get; set; }
    public bool IsQuestion { get; set; }
    public string? CodeSnippet { get; set; }
    public string Links { get; set; } = string.Empty;
    public string Tags { get; set; } = string.Empty;
}

public class Bookmark : Entity
{
    public Guid UserId { get; set; }
    public BookmarkItemType ItemType { get; set; }
    public Guid RefId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;
    public string? DeepLink { get; set; }
}

public class Badge : Entity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public BadgeTier Tier { get; set; }
    public string Criteria { get; set; } = string.Empty;
    public int XpReward { get; set; }
}

public class UserBadge : Entity
{
    public Guid UserId { get; set; }
    public Guid BadgeId { get; set; }
    public Badge? Badge { get; set; }
    public DateTimeOffset EarnedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class XpEvent : Entity
{
    public Guid UserId { get; set; }
    public int Amount { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string RefType { get; set; } = string.Empty;
    public Guid? RefId { get; set; }
}

public class ReadinessSnapshot : Entity
{
    public Guid UserId { get; set; }
    public Guid CareerPathId { get; set; }
    public int Overall { get; set; }
    public string DimensionScoresJson { get; set; } = "[]";
    public DateTimeOffset TakenAt { get; set; } = DateTimeOffset.UtcNow;
}

public class ResumeProfile : Entity
{
    public Guid UserId { get; set; }
    public string Headline { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public DateTimeOffset GeneratedAt { get; set; } = DateTimeOffset.UtcNow;
    public ICollection<ResumeItem> Items { get; set; } = new List<ResumeItem>();
}

public class ResumeItem : Entity
{
    public Guid ResumeProfileId { get; set; }
    public string Section { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    /// <summary>Required. Keeps training and hobby projects out of the experience section.</summary>
    public EvidenceKind EvidenceKind { get; set; }
    public string? SkillSlug { get; set; }
    public string? SourceRefType { get; set; }
    public Guid? SourceRefId { get; set; }
    public int Order { get; set; }
}
