using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FutureTech.Application.Abstractions;

/// <summary>
/// The persistence surface the Application layer is allowed to see. Keeps
/// use-case services free of any EF provider or Infrastructure reference.
/// </summary>
public interface IAppDbContext
{
    DbSet<AppUser> Users { get; }
    DbSet<StudyProfile> StudyProfiles { get; }
    DbSet<UserSkill> UserSkills { get; }

    DbSet<Skill> Skills { get; }
    DbSet<CareerPath> CareerPaths { get; }
    DbSet<CareerSkill> CareerSkills { get; }
    DbSet<CareerCertification> CareerCertifications { get; }
    DbSet<CareerProject> CareerProjects { get; }
    DbSet<LadderStage> LadderStages { get; }
    DbSet<ReadinessDimension> ReadinessDimensions { get; }
    DbSet<SalaryRevision> SalaryRevisions { get; }
    DbSet<Country> Countries { get; }
    DbSet<CareerSalaryBand> CareerSalaryBands { get; }

    DbSet<Course> Courses { get; }
    DbSet<Module> Modules { get; }
    DbSet<Lesson> Lessons { get; }
    DbSet<LessonResource> LessonResources { get; }
    DbSet<Video> Videos { get; }
    DbSet<Quiz> Quizzes { get; }
    DbSet<QuizQuestion> QuizQuestions { get; }
    DbSet<QuizOption> QuizOptions { get; }

    DbSet<PracticeQuestion> PracticeQuestions { get; }
    DbSet<PracticeAttempt> PracticeAttempts { get; }
    DbSet<ArchitectureChallenge> ArchitectureChallenges { get; }
    DbSet<ArchitectureAttempt> ArchitectureAttempts { get; }
    DbSet<CodingExercise> CodingExercises { get; }
    DbSet<CodingAttempt> CodingAttempts { get; }
    DbSet<InterviewQuestion> InterviewQuestions { get; }
    DbSet<InterviewAttempt> InterviewAttempts { get; }
    DbSet<MockInterviewSession> MockInterviewSessions { get; }
    DbSet<MockInterviewTurn> MockInterviewTurns { get; }

    DbSet<Project> Projects { get; }
    DbSet<ProjectMilestone> ProjectMilestones { get; }
    DbSet<UserProjectProgress> UserProjectProgress { get; }
    DbSet<UserProjectMilestone> UserProjectMilestones { get; }
    DbSet<Certification> Certifications { get; }
    DbSet<UserCertification> UserCertifications { get; }

    DbSet<LessonProgress> LessonProgress { get; }
    DbSet<StudySession> StudySessions { get; }
    DbSet<StudyPlanDay> StudyPlanDays { get; }
    DbSet<StudyPlanItem> StudyPlanItems { get; }
    DbSet<Note> Notes { get; }
    DbSet<Bookmark> Bookmarks { get; }
    DbSet<Badge> Badges { get; }
    DbSet<UserBadge> UserBadges { get; }
    DbSet<XpEvent> XpEvents { get; }
    DbSet<ReadinessSnapshot> ReadinessSnapshots { get; }
    DbSet<ResumeProfile> ResumeProfiles { get; }
    DbSet<ResumeItem> ResumeItems { get; }

    DbSet<CourseEnrollment> CourseEnrollments { get; }
    DbSet<CoursePrice> CoursePrices { get; }
    DbSet<PaymentMethodOption> PaymentMethodOptions { get; }
    DbSet<PaymentRequest> PaymentRequests { get; }
    DbSet<LearnerPreferences> LearnerPreferences { get; }
    DbSet<CourseCertificate> CourseCertificates { get; }

    DbSet<LoginEvent> LoginEvents { get; }
    DbSet<IpLocation> IpLocations { get; }
    DbSet<Feedback> Feedback { get; }
    DbSet<AccessPolicy> AccessPolicies { get; }
    DbSet<AppUsageDay> AppUsageDays { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
