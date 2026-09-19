using FutureTech.Domain.Common;

namespace FutureTech.Domain.Entities;

public class Project : Entity
{
    public int Order { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string BriefMarkdown { get; set; } = string.Empty;
    public string TechStack { get; set; } = string.Empty;
    public DifficultyLevel Difficulty { get; set; }
    public int EstimatedHours { get; set; }
    public string? ArchitectureMermaid { get; set; }
    /// <summary>Newline-separated acceptance criteria the learner ticks off.</summary>
    public string AcceptanceCriteria { get; set; } = string.Empty;
    /// <summary>
    /// Newline-separated bullets the resume builder may use — always tagged
    /// PersonalProject, never professional experience.
    /// </summary>
    public string ResumeBullets { get; set; } = string.Empty;
    public string SkillSlugs { get; set; } = string.Empty;

    public ICollection<ProjectMilestone> Milestones { get; set; } = new List<ProjectMilestone>();
}

public class ProjectMilestone : Entity
{
    public Guid ProjectId { get; set; }
    public int Order { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public double EstimatedHours { get; set; }
}

public class UserProjectProgress : Entity
{
    public Guid UserId { get; set; }
    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }
    public ProgressStatus Status { get; set; }
    public int PercentComplete { get; set; }
    public string? RepoUrl { get; set; }
    public string? DemoUrl { get; set; }
    public string Notes { get; set; } = string.Empty;
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public ICollection<UserProjectMilestone> CompletedMilestones { get; set; } = new List<UserProjectMilestone>();
}

public class UserProjectMilestone : Entity
{
    public Guid UserProjectProgressId { get; set; }
    public Guid ProjectMilestoneId { get; set; }
    public DateTimeOffset CompletedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Certification : Entity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Vendor { get; set; } = string.Empty;
    public string Level { get; set; } = string.Empty;
    public int EstimatedPrepHours { get; set; }
    /// <summary>JSON array of exam topic strings.</summary>
    public string TopicsJson { get; set; } = "[]";
    public int ExamCostUsd { get; set; }
    public string OfficialUrl { get; set; } = string.Empty;
}

public class UserCertification : Entity
{
    public Guid UserId { get; set; }
    public Guid CertificationId { get; set; }
    public Certification? Certification { get; set; }
    public CertificationStatus Status { get; set; }
    public DateOnly? TargetDate { get; set; }
    public DateOnly? CompletedDate { get; set; }
    public int? ScorePercent { get; set; }
    public int PrepHoursLogged { get; set; }
}
