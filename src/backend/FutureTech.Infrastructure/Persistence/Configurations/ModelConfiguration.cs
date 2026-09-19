using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FutureTech.Infrastructure.Persistence.Configurations;

public class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> b)
    {
        b.HasIndex(u => u.Email).IsUnique();
        b.Property(u => u.Email).HasMaxLength(256).IsRequired();
        b.Property(u => u.DisplayName).HasMaxLength(128).IsRequired();
        b.HasOne(u => u.StudyProfile).WithOne(p => p.User!)
            .HasForeignKey<StudyProfile>(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class StudyProfileConfiguration : IEntityTypeConfiguration<StudyProfile>
{
    public void Configure(EntityTypeBuilder<StudyProfile> b)
    {
        b.HasIndex(p => p.UserId).IsUnique();
        b.Ignore(p => p.WeeklyHours);
        b.HasOne(p => p.TargetCareerPath).WithMany()
            .HasForeignKey(p => p.TargetCareerPathId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class UserSkillConfiguration : IEntityTypeConfiguration<UserSkill>
{
    public void Configure(EntityTypeBuilder<UserSkill> b)
    {
        b.HasIndex(s => new { s.UserId, s.SkillId }).IsUnique();
        b.HasOne(s => s.Skill).WithMany().HasForeignKey(s => s.SkillId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class SkillConfiguration : IEntityTypeConfiguration<Skill>
{
    public void Configure(EntityTypeBuilder<Skill> b)
    {
        b.HasIndex(s => s.Slug).IsUnique();
        b.Property(s => s.Name).HasMaxLength(128).IsRequired();
        b.Property(s => s.Slug).HasMaxLength(128).IsRequired();
    }
}

public class CareerPathConfiguration : IEntityTypeConfiguration<CareerPath>
{
    public void Configure(EntityTypeBuilder<CareerPath> b)
    {
        b.HasIndex(c => c.Slug).IsUnique();
        b.HasIndex(c => c.Rank);
        b.Property(c => c.Title).HasMaxLength(200).IsRequired();
        b.HasMany(c => c.CareerSkills).WithOne().HasForeignKey(cs => cs.CareerPathId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(c => c.LadderStages).WithOne().HasForeignKey(s => s.CareerPathId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(c => c.ReadinessDimensions).WithOne().HasForeignKey(d => d.CareerPathId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(c => c.CareerCertifications).WithOne().HasForeignKey(cc => cc.CareerPathId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(c => c.CareerProjects).WithOne().HasForeignKey(cp => cp.CareerPathId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(c => c.Courses).WithOne(x => x.CareerPath!).HasForeignKey(x => x.CareerPathId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class CareerSkillConfiguration : IEntityTypeConfiguration<CareerSkill>
{
    public void Configure(EntityTypeBuilder<CareerSkill> b)
    {
        b.HasIndex(cs => new { cs.CareerPathId, cs.SkillId }).IsUnique();
        b.HasOne(cs => cs.Skill).WithMany().HasForeignKey(cs => cs.SkillId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class CareerCertificationConfiguration : IEntityTypeConfiguration<CareerCertification>
{
    public void Configure(EntityTypeBuilder<CareerCertification> b)
    {
        b.HasIndex(cc => new { cc.CareerPathId, cc.CertificationId }).IsUnique();
        b.HasOne(cc => cc.Certification).WithMany().HasForeignKey(cc => cc.CertificationId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class CareerProjectConfiguration : IEntityTypeConfiguration<CareerProject>
{
    public void Configure(EntityTypeBuilder<CareerProject> b)
    {
        b.HasIndex(cp => new { cp.CareerPathId, cp.ProjectId }).IsUnique();
        b.HasOne(cp => cp.Project).WithMany().HasForeignKey(cp => cp.ProjectId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class CourseConfiguration : IEntityTypeConfiguration<Course>
{
    public void Configure(EntityTypeBuilder<Course> b)
    {
        b.HasIndex(c => c.Slug).IsUnique();
        b.HasIndex(c => c.CareerPathId);
        b.Property(c => c.Title).HasMaxLength(200).IsRequired();
        b.HasMany(c => c.Modules).WithOne(m => m.Course!).HasForeignKey(m => m.CourseId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class ModuleConfiguration : IEntityTypeConfiguration<Module>
{
    public void Configure(EntityTypeBuilder<Module> b)
    {
        b.HasIndex(m => m.CourseId);
        b.HasMany(m => m.Lessons).WithOne(l => l.Module!).HasForeignKey(l => l.ModuleId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class LessonConfiguration : IEntityTypeConfiguration<Lesson>
{
    public void Configure(EntityTypeBuilder<Lesson> b)
    {
        b.HasIndex(l => l.Slug).IsUnique();
        b.HasIndex(l => l.ModuleId);
        b.Property(l => l.Title).HasMaxLength(250).IsRequired();
        b.HasMany(l => l.Resources).WithOne().HasForeignKey(r => r.LessonId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(l => l.Videos).WithOne(v => v.Lesson!).HasForeignKey(v => v.LessonId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(l => l.Quiz).WithOne().HasForeignKey<Quiz>(q => q.LessonId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class QuizConfiguration : IEntityTypeConfiguration<Quiz>
{
    public void Configure(EntityTypeBuilder<Quiz> b)
    {
        b.HasIndex(q => q.LessonId).IsUnique();
        b.HasMany(q => q.Questions).WithOne().HasForeignKey(q => q.QuizId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class QuizQuestionConfiguration : IEntityTypeConfiguration<QuizQuestion>
{
    public void Configure(EntityTypeBuilder<QuizQuestion> b) =>
        b.HasMany(q => q.Options).WithOne().HasForeignKey(o => o.QuizQuestionId).OnDelete(DeleteBehavior.Cascade);
}

public class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> b)
    {
        b.HasIndex(p => p.Slug).IsUnique();
        b.HasMany(p => p.Milestones).WithOne().HasForeignKey(m => m.ProjectId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class UserProjectProgressConfiguration : IEntityTypeConfiguration<UserProjectProgress>
{
    public void Configure(EntityTypeBuilder<UserProjectProgress> b)
    {
        b.HasIndex(p => new { p.UserId, p.ProjectId }).IsUnique();
        b.HasOne(p => p.Project).WithMany().HasForeignKey(p => p.ProjectId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(p => p.CompletedMilestones).WithOne()
            .HasForeignKey(m => m.UserProjectProgressId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class CertificationConfiguration : IEntityTypeConfiguration<Certification>
{
    public void Configure(EntityTypeBuilder<Certification> b)
    {
        b.HasIndex(c => c.Code).IsUnique();
        b.Property(c => c.Code).HasMaxLength(64).IsRequired();
    }
}

public class UserCertificationConfiguration : IEntityTypeConfiguration<UserCertification>
{
    public void Configure(EntityTypeBuilder<UserCertification> b)
    {
        b.HasIndex(c => new { c.UserId, c.CertificationId }).IsUnique();
        b.HasOne(c => c.Certification).WithMany().HasForeignKey(c => c.CertificationId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class LessonProgressConfiguration : IEntityTypeConfiguration<LessonProgress>
{
    public void Configure(EntityTypeBuilder<LessonProgress> b)
    {
        b.HasIndex(p => new { p.UserId, p.LessonId }).IsUnique();
        b.HasOne(p => p.Lesson).WithMany().HasForeignKey(p => p.LessonId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class StudySessionConfiguration : IEntityTypeConfiguration<StudySession>
{
    public void Configure(EntityTypeBuilder<StudySession> b) => b.HasIndex(s => new { s.UserId, s.OnDate });
}

public class StudyPlanDayConfiguration : IEntityTypeConfiguration<StudyPlanDay>
{
    public void Configure(EntityTypeBuilder<StudyPlanDay> b)
    {
        b.HasIndex(d => new { d.UserId, d.OnDate }).IsUnique();
        b.HasMany(d => d.Items).WithOne(i => i.Day!).HasForeignKey(i => i.StudyPlanDayId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class NoteConfiguration : IEntityTypeConfiguration<Note>
{
    public void Configure(EntityTypeBuilder<Note> b) => b.HasIndex(n => new { n.UserId, n.Scope });
}

public class BookmarkConfiguration : IEntityTypeConfiguration<Bookmark>
{
    public void Configure(EntityTypeBuilder<Bookmark> b) =>
        b.HasIndex(x => new { x.UserId, x.ItemType, x.RefId }).IsUnique();
}

public class BadgeConfiguration : IEntityTypeConfiguration<Badge>
{
    public void Configure(EntityTypeBuilder<Badge> b) => b.HasIndex(x => x.Code).IsUnique();
}

public class UserBadgeConfiguration : IEntityTypeConfiguration<UserBadge>
{
    public void Configure(EntityTypeBuilder<UserBadge> b)
    {
        b.HasIndex(x => new { x.UserId, x.BadgeId }).IsUnique();
        b.HasOne(x => x.Badge).WithMany().HasForeignKey(x => x.BadgeId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class XpEventConfiguration : IEntityTypeConfiguration<XpEvent>
{
    public void Configure(EntityTypeBuilder<XpEvent> b) => b.HasIndex(x => x.UserId);
}

public class PracticeAttemptConfiguration : IEntityTypeConfiguration<PracticeAttempt>
{
    public void Configure(EntityTypeBuilder<PracticeAttempt> b)
    {
        b.HasIndex(a => new { a.UserId, a.PracticeQuestionId });
        b.HasOne(a => a.PracticeQuestion).WithMany()
            .HasForeignKey(a => a.PracticeQuestionId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class InterviewAttemptConfiguration : IEntityTypeConfiguration<InterviewAttempt>
{
    public void Configure(EntityTypeBuilder<InterviewAttempt> b)
    {
        b.HasIndex(a => new { a.UserId, a.InterviewQuestionId });
        b.HasOne(a => a.InterviewQuestion).WithMany()
            .HasForeignKey(a => a.InterviewQuestionId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class MockInterviewSessionConfiguration : IEntityTypeConfiguration<MockInterviewSession>
{
    public void Configure(EntityTypeBuilder<MockInterviewSession> b)
    {
        b.HasIndex(s => s.UserId);
        b.HasMany(s => s.Turns).WithOne()
            .HasForeignKey(t => t.MockInterviewSessionId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class CodingExerciseConfiguration : IEntityTypeConfiguration<CodingExercise>
{
    public void Configure(EntityTypeBuilder<CodingExercise> b) => b.HasIndex(e => e.Slug).IsUnique();
}

public class ArchitectureChallengeConfiguration : IEntityTypeConfiguration<ArchitectureChallenge>
{
    public void Configure(EntityTypeBuilder<ArchitectureChallenge> b) => b.HasIndex(c => c.Slug).IsUnique();
}

public class ResumeProfileConfiguration : IEntityTypeConfiguration<ResumeProfile>
{
    public void Configure(EntityTypeBuilder<ResumeProfile> b)
    {
        b.HasIndex(r => r.UserId);
        b.HasMany(r => r.Items).WithOne()
            .HasForeignKey(i => i.ResumeProfileId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class LoginEventConfiguration : IEntityTypeConfiguration<LoginEvent>
{
    public void Configure(EntityTypeBuilder<LoginEvent> b)
    {
        b.HasIndex(e => e.CreatedAt);
        b.HasIndex(e => new { e.UserId, e.CreatedAt });
        // The background geo backfill finds its work through this index.
        b.HasIndex(e => new { e.IpAddress, e.GeoState });
        b.Property(e => e.Email).HasMaxLength(256).IsRequired();
        b.Property(e => e.IpAddress).HasMaxLength(64).IsRequired();
        b.Property(e => e.UserAgent).HasMaxLength(512);
        b.Property(e => e.Browser).HasMaxLength(64);
        b.Property(e => e.OperatingSystem).HasMaxLength(64);
        b.Property(e => e.DeviceKind).HasMaxLength(32);
        b.Property(e => e.City).HasMaxLength(128);
        b.Property(e => e.Region).HasMaxLength(128);
        b.Property(e => e.Country).HasMaxLength(128);
        b.Property(e => e.CountryCode).HasMaxLength(8);
        b.Property(e => e.TimeZone).HasMaxLength(64);
        b.Property(e => e.Isp).HasMaxLength(200);
        // A deleted account takes its login history with it.
        b.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class IpLocationConfiguration : IEntityTypeConfiguration<IpLocation>
{
    public void Configure(EntityTypeBuilder<IpLocation> b)
    {
        b.HasIndex(x => x.IpAddress).IsUnique();
        b.Property(x => x.IpAddress).HasMaxLength(64).IsRequired();
        b.Property(x => x.City).HasMaxLength(128);
        b.Property(x => x.Region).HasMaxLength(128);
        b.Property(x => x.Country).HasMaxLength(128);
        b.Property(x => x.CountryCode).HasMaxLength(8);
        b.Property(x => x.TimeZone).HasMaxLength(64);
        b.Property(x => x.Isp).HasMaxLength(200);
        b.Property(x => x.Source).HasMaxLength(64);
    }
}

public class FeedbackConfiguration : IEntityTypeConfiguration<Feedback>
{
    public void Configure(EntityTypeBuilder<Feedback> b)
    {
        b.HasIndex(f => f.Status);
        b.HasIndex(f => new { f.UserId, f.CreatedAt });
        b.Property(f => f.Subject).HasMaxLength(200).IsRequired();
        b.Property(f => f.Message).HasMaxLength(4000).IsRequired();
        b.Property(f => f.Area).HasMaxLength(200);
        b.Property(f => f.RefType).HasMaxLength(32);
        b.Property(f => f.HandledByName).HasMaxLength(128);
        b.HasOne(f => f.User).WithMany().HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
