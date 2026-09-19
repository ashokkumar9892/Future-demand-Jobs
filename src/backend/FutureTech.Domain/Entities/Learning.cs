using FutureTech.Domain.Common;

namespace FutureTech.Domain.Entities;

public class Course : Entity
{
    public Guid CareerPathId { get; set; }
    public CareerPath? CareerPath { get; set; }
    public int Order { get; set; }
    /// <summary>Phase number inside the career track (Phase 1..10).</summary>
    public int PhaseNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public int EstimatedHours { get; set; }
    public DifficultyLevel Level { get; set; }
    /// <summary>Lowest track that includes this course: FastTrack means everyone gets it.</summary>
    public TrackMode MinimumTrack { get; set; } = TrackMode.Balanced;
    public string Outcomes { get; set; } = string.Empty;
    /// <summary>CSV of skill slugs this course advances. Feeds the readiness dimensions.</summary>
    public string SkillSlugs { get; set; } = string.Empty;

    /// <summary>
    /// CSV of country codes this course is offered in. Empty — the default —
    /// means every country, which is right for most of the curriculum: cloud
    /// and AI architecture does not change at a border. Set it only for content
    /// that genuinely is market-specific.
    /// </summary>
    public string Countries { get; set; } = string.Empty;

    /// <summary>
    /// Free courses open to any signed-in learner. Advanced courses need a
    /// confirmed payment before their lessons unlock. Everything seeded is
    /// Free; an operator marks a course Advanced and prices it in Admin.
    /// </summary>
    public CourseAccessTier AccessTier { get; set; } = CourseAccessTier.Free;

    public ICollection<Module> Modules { get; set; } = new List<Module>();
}

public class Module : Entity
{
    public Guid CourseId { get; set; }
    public Course? Course { get; set; }
    public int Order { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public double EstimatedHours { get; set; }

    public ICollection<Lesson> Lessons { get; set; } = new List<Lesson>();
}

public class Lesson : Entity
{
    public Guid ModuleId { get; set; }
    public Module? Module { get; set; }
    public int Order { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public LessonType Type { get; set; }
    public int EstimatedMinutes { get; set; }
    public string ContentMarkdown { get; set; } = string.Empty;
    public string? CodeExample { get; set; }
    public string CodeLanguage { get; set; } = "csharp";
    /// <summary>Mermaid source for the architecture diagram shown in the lesson player.</summary>
    public string? DiagramMermaid { get; set; }
    /// <summary>Newline-separated takeaways shown in the right rail.</summary>
    public string KeyTakeaways { get; set; } = string.Empty;
    public TrackMode MinimumTrack { get; set; } = TrackMode.Balanced;

    public ICollection<LessonResource> Resources { get; set; } = new List<LessonResource>();
    public ICollection<Video> Videos { get; set; } = new List<Video>();
    public Quiz? Quiz { get; set; }
}

public class LessonResource : Entity
{
    public Guid LessonId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public ResourceKind Kind { get; set; }
}

/// <summary>
/// Video metadata. <see cref="YouTubeUrl"/> is either a link that was verified
/// against YouTube's oEmbed endpoint, or null. The platform never invents one:
/// a lesson with no verified video shows a search link instead of a dead embed.
/// </summary>
public class Video : Entity
{
    public Guid LessonId { get; set; }
    public Lesson? Lesson { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? YouTubeUrl { get; set; }
    public string? Instructor { get; set; }
    public int DurationMinutes { get; set; }
    public DifficultyLevel SkillLevel { get; set; }
    public bool IsVerified { get; set; }
    public Guid? AddedByUserId { get; set; }
}

public class Quiz : Entity
{
    public Guid LessonId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int PassMarkPercent { get; set; } = 70;
    public ICollection<QuizQuestion> Questions { get; set; } = new List<QuizQuestion>();
}

public class QuizQuestion : Entity
{
    public Guid QuizId { get; set; }
    public int Order { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
    public bool AllowsMultiple { get; set; }
    public ICollection<QuizOption> Options { get; set; } = new List<QuizOption>();
}

public class QuizOption : Entity
{
    public Guid QuizQuestionId { get; set; }
    public int Order { get; set; }
    public string Text { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
}
