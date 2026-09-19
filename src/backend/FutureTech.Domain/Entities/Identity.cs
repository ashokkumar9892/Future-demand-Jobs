using FutureTech.Domain.Common;

namespace FutureTech.Domain.Entities;

public class AppUser : Entity
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Learner;
    public string ThemePreference { get; set; } = "dark";
    public int YearsExperience { get; set; }
    public DateTimeOffset? LastLoginAt { get; set; }

    public StudyProfile? StudyProfile { get; set; }
    public ICollection<UserSkill> Skills { get; set; } = new List<UserSkill>();
}

/// <summary>Answers from the setup wizard. Drives every schedule calculation.</summary>
public class StudyProfile : Entity
{
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }

    public double WeekdayHours { get; set; } = 1.5;
    public double SaturdayHours { get; set; } = 3;
    public double SundayHours { get; set; } = 3;

    /// <summary>CSV of DayOfWeek names the learner agreed to study on.</summary>
    public string StudyDays { get; set; } = "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday";

    public DateOnly? TargetCompletionDate { get; set; }
    public Guid? TargetCareerPathId { get; set; }
    public CareerPath? TargetCareerPath { get; set; }

    public int DesiredSalaryUsd { get; set; } = 200_000;
    public int CurrentSkillLevel { get; set; } = 60;
    public TrackMode TrackMode { get; set; } = TrackMode.Balanced;
    public DateTimeOffset? OnboardingCompletedAt { get; set; }

    public double WeeklyHours =>
        Math.Round(WeekdayHours * 5 + SaturdayHours + SundayHours, 2);
}

public class UserSkill : Entity
{
    public Guid UserId { get; set; }
    public Guid SkillId { get; set; }
    public Skill? Skill { get; set; }
    public int CurrentLevel { get; set; }
    public DateTimeOffset SelfAssessedAt { get; set; } = DateTimeOffset.UtcNow;
}
