using FutureTech.Domain.Common;

namespace FutureTech.Domain.Entities;

public class Skill : Entity
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public SkillCategory Category { get; set; }
    /// <summary>Baseline level for the target persona: a 20-year .NET/Azure engineer.</summary>
    public int BaselineLevel { get; set; }
}

public class CareerPath : Entity
{
    /// <summary>1 = highest-paying realistic role. Drives display order.</summary>
    public int Rank { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;

    public int SalaryMinUsd { get; set; }
    public int SalaryMaxUsd { get; set; }
    public int SeniorSalaryMinUsd { get; set; }
    public int SeniorSalaryMaxUsd { get; set; }
    public string TwoHundredKPotential { get; set; } = string.Empty;
    public DateOnly SalaryAsOf { get; set; }
    public string SalarySource { get; set; } = string.Empty;

    public DemandOutlook DemandOutlook { get; set; }
    public string DemandNotes { get; set; } = string.Empty;
    public AiReplacementRisk AiReplacementRisk { get; set; }
    public string AiRiskNotes { get; set; } = string.Empty;
    public DifficultyLevel Difficulty { get; set; }

    public int EstimatedHours { get; set; }
    public bool IsPrimaryRecommended { get; set; }

    /// <summary>Newline-separated. Rendered as chips on the career card.</summary>
    public string ResumeKeywords { get; set; } = string.Empty;
    public string Responsibilities { get; set; } = string.Empty;
    public string InterviewFocus { get; set; } = string.Empty;

    public ICollection<CareerSkill> CareerSkills { get; set; } = new List<CareerSkill>();
    public ICollection<LadderStage> LadderStages { get; set; } = new List<LadderStage>();
    public ICollection<ReadinessDimension> ReadinessDimensions { get; set; } = new List<ReadinessDimension>();
    public ICollection<CareerCertification> CareerCertifications { get; set; } = new List<CareerCertification>();
    public ICollection<CareerProject> CareerProjects { get; set; } = new List<CareerProject>();
    public ICollection<Course> Courses { get; set; } = new List<Course>();
}

public class CareerSkill : Entity
{
    public Guid CareerPathId { get; set; }
    public Guid SkillId { get; set; }
    public Skill? Skill { get; set; }
    public int TargetLevel { get; set; }
    public SkillImportance Importance { get; set; }
}

public class CareerCertification : Entity
{
    public Guid CareerPathId { get; set; }
    public Guid CertificationId { get; set; }
    public Certification? Certification { get; set; }
    public int Priority { get; set; }
}

public class CareerProject : Entity
{
    public Guid CareerPathId { get; set; }
    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }
    public int Order { get; set; }
}

/// <summary>One rung of the visual career ladder on My Roadmap.</summary>
public class LadderStage : Entity
{
    public Guid CareerPathId { get; set; }
    public int StageOrder { get; set; }
    public string Title { get; set; } = string.Empty;
    public string RoleTitle { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int SalaryMinUsd { get; set; }
    public int SalaryMaxUsd { get; set; }
    public int DurationMonths { get; set; }
    /// <summary>Newline-separated milestones that mark this rung as reached.</summary>
    public string Milestones { get; set; } = string.Empty;
    public bool IsCurrentPosition { get; set; }
}

/// <summary>A weighted axis of the job-readiness score (Architecture, Azure, RAG...).</summary>
public class ReadinessDimension : Entity
{
    public Guid CareerPathId { get; set; }
    public string Name { get; set; } = string.Empty;
    public double Weight { get; set; }
    /// <summary>CSV of skill slugs whose measured progress feeds this dimension.</summary>
    public string SkillSlugs { get; set; } = string.Empty;
}

/// <summary>Audit trail so salary figures can be refreshed via API/Admin over time.</summary>
public class SalaryRevision : Entity
{
    public Guid CareerPathId { get; set; }
    public int OldMinUsd { get; set; }
    public int OldMaxUsd { get; set; }
    public int NewMinUsd { get; set; }
    public int NewMaxUsd { get; set; }
    public string Source { get; set; } = string.Empty;
    public Guid? ChangedByUserId { get; set; }
}
