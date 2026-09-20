using FutureTech.Application.Abstractions;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<StudyProfile> StudyProfiles => Set<StudyProfile>();
    public DbSet<UserSkill> UserSkills => Set<UserSkill>();

    public DbSet<Skill> Skills => Set<Skill>();
    public DbSet<CareerPath> CareerPaths => Set<CareerPath>();
    public DbSet<CareerSkill> CareerSkills => Set<CareerSkill>();
    public DbSet<CareerCertification> CareerCertifications => Set<CareerCertification>();
    public DbSet<CareerProject> CareerProjects => Set<CareerProject>();
    public DbSet<LadderStage> LadderStages => Set<LadderStage>();
    public DbSet<ReadinessDimension> ReadinessDimensions => Set<ReadinessDimension>();
    public DbSet<SalaryRevision> SalaryRevisions => Set<SalaryRevision>();
    public DbSet<Country> Countries => Set<Country>();
    public DbSet<CareerSalaryBand> CareerSalaryBands => Set<CareerSalaryBand>();

    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Module> Modules => Set<Module>();
    public DbSet<Lesson> Lessons => Set<Lesson>();
    public DbSet<LessonResource> LessonResources => Set<LessonResource>();
    public DbSet<Video> Videos => Set<Video>();
    public DbSet<Quiz> Quizzes => Set<Quiz>();
    public DbSet<QuizQuestion> QuizQuestions => Set<QuizQuestion>();
    public DbSet<QuizOption> QuizOptions => Set<QuizOption>();

    public DbSet<PracticeQuestion> PracticeQuestions => Set<PracticeQuestion>();
    public DbSet<PracticeAttempt> PracticeAttempts => Set<PracticeAttempt>();
    public DbSet<ArchitectureChallenge> ArchitectureChallenges => Set<ArchitectureChallenge>();
    public DbSet<ArchitectureAttempt> ArchitectureAttempts => Set<ArchitectureAttempt>();
    public DbSet<CodingExercise> CodingExercises => Set<CodingExercise>();
    public DbSet<CodingAttempt> CodingAttempts => Set<CodingAttempt>();
    public DbSet<InterviewQuestion> InterviewQuestions => Set<InterviewQuestion>();
    public DbSet<InterviewAttempt> InterviewAttempts => Set<InterviewAttempt>();
    public DbSet<MockInterviewSession> MockInterviewSessions => Set<MockInterviewSession>();
    public DbSet<MockInterviewTurn> MockInterviewTurns => Set<MockInterviewTurn>();

    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectMilestone> ProjectMilestones => Set<ProjectMilestone>();
    public DbSet<UserProjectProgress> UserProjectProgress => Set<UserProjectProgress>();
    public DbSet<UserProjectMilestone> UserProjectMilestones => Set<UserProjectMilestone>();
    public DbSet<Certification> Certifications => Set<Certification>();
    public DbSet<UserCertification> UserCertifications => Set<UserCertification>();

    public DbSet<LessonProgress> LessonProgress => Set<LessonProgress>();
    public DbSet<StudySession> StudySessions => Set<StudySession>();
    public DbSet<StudyPlanDay> StudyPlanDays => Set<StudyPlanDay>();
    public DbSet<StudyPlanItem> StudyPlanItems => Set<StudyPlanItem>();
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<Bookmark> Bookmarks => Set<Bookmark>();
    public DbSet<Badge> Badges => Set<Badge>();
    public DbSet<UserBadge> UserBadges => Set<UserBadge>();
    public DbSet<XpEvent> XpEvents => Set<XpEvent>();
    public DbSet<ReadinessSnapshot> ReadinessSnapshots => Set<ReadinessSnapshot>();
    public DbSet<ResumeProfile> ResumeProfiles => Set<ResumeProfile>();
    public DbSet<ResumeItem> ResumeItems => Set<ResumeItem>();

    public DbSet<CourseEnrollment> CourseEnrollments => Set<CourseEnrollment>();
    public DbSet<CoursePrice> CoursePrices => Set<CoursePrice>();
    public DbSet<PaymentMethodOption> PaymentMethodOptions => Set<PaymentMethodOption>();
    public DbSet<PaymentRequest> PaymentRequests => Set<PaymentRequest>();
    public DbSet<LearnerPreferences> LearnerPreferences => Set<LearnerPreferences>();
    public DbSet<CourseCertificate> CourseCertificates => Set<CourseCertificate>();

    public DbSet<LoginEvent> LoginEvents => Set<LoginEvent>();
    public DbSet<IpLocation> IpLocations => Set<IpLocation>();
    public DbSet<Feedback> Feedback => Set<Feedback>();
    public DbSet<AccessPolicy> AccessPolicies => Set<AccessPolicy>();
    public DbSet<AppUsageDay> AppUsageDays => Set<AppUsageDay>();

    public override Task<int> SaveChangesAsync(CancellationToken ct = default) => base.SaveChangesAsync(ct);

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // SQLite has no native date or offset types. Storing them as fixed-width
        // ISO-8601 UTC strings keeps ordering and comparison correct there, while
        // PostgreSQL keeps its native date/timestamptz mapping.
        var isSqlite = Database.IsSqlite();

        // Enums persist as strings: the same database stays readable when the
        // content team edits rows by hand, and adding a member cannot silently
        // reshuffle existing data.
        foreach (var entity in b.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties())
            {
                var type = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
                if (type.IsEnum)
                    property.SetProviderClrType(typeof(string));

                if (type == typeof(DateOnly))
                    property.SetValueConverter(DateOnlyConverter.Instance);
                if (type == typeof(DateOnly?))
                    property.SetValueConverter(NullableDateOnlyConverter.Instance);

                if (!isSqlite) continue;
                if (type == typeof(DateTimeOffset))
                    property.SetValueConverter(DateTimeOffsetConverter.Instance);
                if (property.ClrType == typeof(DateTimeOffset?))
                    property.SetValueConverter(NullableDateTimeOffsetConverter.Instance);
            }
        }
    }
}

/// <summary>
/// Normalises to UTC before formatting, so the fixed-width round-trip string
/// sorts and compares chronologically in SQLite.
/// </summary>
internal sealed class DateTimeOffsetConverter : Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTimeOffset, string>
{
    public static readonly DateTimeOffsetConverter Instance = new();
    private DateTimeOffsetConverter() : base(
        d => d.ToUniversalTime().ToString("O"),
        s => DateTimeOffset.Parse(s, null, System.Globalization.DateTimeStyles.RoundtripKind))
    { }
}

internal sealed class NullableDateTimeOffsetConverter : Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTimeOffset?, string?>
{
    public static readonly NullableDateTimeOffsetConverter Instance = new();
    private NullableDateTimeOffsetConverter() : base(
        d => d == null ? null : d.Value.ToUniversalTime().ToString("O"),
        s => s == null ? null : DateTimeOffset.Parse(s, null, System.Globalization.DateTimeStyles.RoundtripKind))
    { }
}

/// <summary>
/// SQLite has no native date type and Npgsql's DateOnly support differs between
/// versions; storing an ISO string keeps both providers on one code path.
/// </summary>
internal sealed class DateOnlyConverter : Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateOnly, string>
{
    public static readonly DateOnlyConverter Instance = new();
    private DateOnlyConverter() : base(
        d => d.ToString("yyyy-MM-dd"),
        s => DateOnly.ParseExact(s, "yyyy-MM-dd"))
    { }
}

internal sealed class NullableDateOnlyConverter : Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateOnly?, string?>
{
    public static readonly NullableDateOnlyConverter Instance = new();
    private NullableDateOnlyConverter() : base(
        d => d == null ? null : d.Value.ToString("yyyy-MM-dd"),
        s => s == null ? null : DateOnly.ParseExact(s, "yyyy-MM-dd"))
    { }
}
