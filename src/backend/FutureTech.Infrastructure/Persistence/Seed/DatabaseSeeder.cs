using System.Text.Json;
using FutureTech.Application.Abstractions;
using FutureTech.Application.Services;
using FutureTech.Application.Common;
using FutureTech.Domain.Common;
using FutureTech.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FutureTech.Infrastructure.Persistence.Seed;

public interface IDatabaseSeeder
{
    Task SeedAsync(CancellationToken ct = default);
}

/// <summary>
/// Loads the JSON content pack into an empty database and creates a demo learner
/// with realistic progress, so the app is never a set of blank screens on first run.
/// Re-running is safe: content is only inserted when its table is empty.
/// </summary>
public class DatabaseSeeder(
    AppDbContext db,
    IPasswordHasher hasher,
    IStudyPlanGenerator planGenerator,
    SeedOptions options,
    ILogger<DatabaseSeeder> logger) : IDatabaseSeeder
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    public async Task SeedAsync(CancellationToken ct = default)
    {
        if (await db.CareerPaths.AnyAsync(ct))
        {
            logger.LogInformation("Content already present; skipping seed.");
        }
        else
        {
            logger.LogInformation("Seeding content pack from {Path}", options.SeedDataPath);
            await SeedContentAsync(ct);
        }

        if (options.CreateDemoUser && !await db.Users.AnyAsync(ct))
            await SeedDemoUsersAsync(ct);
    }

    // ----- content -------------------------------------------------------

    private async Task SeedContentAsync(CancellationToken ct)
    {
        var skills = Load<List<SkillSeed>>("skills.json") ?? [];
        var skillEntities = skills.Select(s => new Skill
        {
            Name = s.Name,
            Slug = s.Slug,
            Category = Text.ParseEnum(s.Category, SkillCategory.Framework),
            BaselineLevel = s.BaselineLevel
        }).ToList();
        db.Skills.AddRange(skillEntities);

        var certifications = Load<List<CertificationSeed>>("certifications.json") ?? [];
        var certEntities = certifications.Select(c => new Certification
        {
            Code = c.Code,
            Name = c.Name,
            Vendor = c.Vendor,
            Level = c.Level,
            EstimatedPrepHours = c.EstimatedPrepHours,
            TopicsJson = Text.ToJson(c.Topics),
            ExamCostUsd = c.ExamCostUsd,
            OfficialUrl = c.OfficialUrl
        }).ToList();
        db.Certifications.AddRange(certEntities);

        var projects = Load<List<ProjectSeed>>("projects.json") ?? [];
        var projectEntities = projects.Select(p =>
        {
            var project = new Project
            {
                Order = p.Order,
                Title = p.Title,
                Slug = p.Slug,
                Summary = p.Summary,
                BriefMarkdown = p.BriefMarkdown,
                TechStack = p.TechStack,
                Difficulty = Text.ParseEnum(p.Difficulty, DifficultyLevel.Advanced),
                EstimatedHours = p.EstimatedHours,
                ArchitectureMermaid = p.ArchitectureMermaid,
                AcceptanceCriteria = string.Join('\n', p.AcceptanceCriteria),
                ResumeBullets = string.Join('\n', p.ResumeBullets),
                SkillSlugs = string.Join(',', p.SkillSlugs)
            };
            foreach (var m in p.Milestones.OrderBy(m => m.Order))
                project.Milestones.Add(new ProjectMilestone
                {
                    Order = m.Order,
                    Title = m.Title,
                    Description = m.Description,
                    EstimatedHours = m.EstimatedHours
                });
            return project;
        }).ToList();
        db.Projects.AddRange(projectEntities);

        await db.SaveChangesAsync(ct);

        var skillsBySlug = skillEntities.ToDictionary(s => s.Slug, StringComparer.OrdinalIgnoreCase);
        var certsByCode = certEntities.ToDictionary(c => c.Code, StringComparer.OrdinalIgnoreCase);
        var projectsBySlug = projectEntities.ToDictionary(p => p.Slug, StringComparer.OrdinalIgnoreCase);

        // --- careers -----------------------------------------------------
        var careers = Load<List<CareerSeed>>("careers.json") ?? [];
        var careerEntities = new List<CareerPath>();

        foreach (var c in careers)
        {
            var career = new CareerPath
            {
                Rank = c.Rank,
                Title = c.Title,
                Slug = c.Slug,
                Summary = c.Summary,
                SalaryMinUsd = c.SalaryMinUsd,
                SalaryMaxUsd = c.SalaryMaxUsd,
                SeniorSalaryMinUsd = c.SeniorSalaryMinUsd,
                SeniorSalaryMaxUsd = c.SeniorSalaryMaxUsd,
                TwoHundredKPotential = c.TwoHundredKPotential,
                SalaryAsOf = DateOnly.Parse(c.SalaryAsOf),
                SalarySource = c.SalarySource,
                DemandOutlook = Text.ParseEnum(c.DemandOutlook, DemandOutlook.Strong),
                DemandNotes = c.DemandNotes,
                AiReplacementRisk = Text.ParseEnum(c.AiReplacementRisk, AiReplacementRisk.Low),
                AiRiskNotes = c.AiRiskNotes,
                Difficulty = Text.ParseEnum(c.Difficulty, DifficultyLevel.Advanced),
                EstimatedHours = c.EstimatedHours,
                IsPrimaryRecommended = c.IsPrimaryRecommended,
                ResumeKeywords = string.Join('\n', c.ResumeKeywords),
                Responsibilities = string.Join('\n', c.Responsibilities),
                InterviewFocus = string.Join('\n', c.InterviewFocus)
            };

            foreach (var s in c.Skills)
            {
                if (!skillsBySlug.TryGetValue(s.Slug, out var skill))
                {
                    logger.LogWarning("Career {Career} references unknown skill {Skill}", c.Slug, s.Slug);
                    continue;
                }
                career.CareerSkills.Add(new CareerSkill
                {
                    SkillId = skill.Id,
                    TargetLevel = s.TargetLevel,
                    Importance = Text.ParseEnum(s.Importance, SkillImportance.Important)
                });
            }

            foreach (var stage in c.Ladder.OrderBy(s => s.StageOrder))
                career.LadderStages.Add(new LadderStage
                {
                    StageOrder = stage.StageOrder,
                    Title = stage.Title,
                    RoleTitle = stage.RoleTitle,
                    Description = stage.Description,
                    SalaryMinUsd = stage.SalaryMinUsd,
                    SalaryMaxUsd = stage.SalaryMaxUsd,
                    DurationMonths = stage.DurationMonths,
                    Milestones = string.Join('\n', stage.Milestones),
                    IsCurrentPosition = stage.IsCurrentPosition
                });

            foreach (var d in c.ReadinessDimensions)
                career.ReadinessDimensions.Add(new ReadinessDimension
                {
                    Name = d.Name,
                    Weight = d.Weight,
                    SkillSlugs = string.Join(',', d.SkillSlugs)
                });

            var priority = 1;
            foreach (var code in c.Certifications)
                if (certsByCode.TryGetValue(code, out var cert))
                    career.CareerCertifications.Add(new CareerCertification { CertificationId = cert.Id, Priority = priority++ });

            var order = 1;
            foreach (var slug in c.Projects)
                if (projectsBySlug.TryGetValue(slug, out var project))
                    career.CareerProjects.Add(new CareerProject { ProjectId = project.Id, Order = order++ });

            careerEntities.Add(career);
        }

        db.CareerPaths.AddRange(careerEntities);
        await db.SaveChangesAsync(ct);

        var careersBySlug = careerEntities.ToDictionary(c => c.Slug, StringComparer.OrdinalIgnoreCase);

        // --- courses -----------------------------------------------------
        // Course content is split across courses.*.json files so each phase stays
        // an editable, reviewable size.
        var courses = LoadAll<CourseSeed>("courses*.json");
        foreach (var c in courses)
        {
            if (!careersBySlug.TryGetValue(c.CareerSlug, out var career))
            {
                logger.LogWarning("Course {Course} references unknown career {Career}", c.Slug, c.CareerSlug);
                continue;
            }

            var course = new Course
            {
                CareerPathId = career.Id,
                Order = c.Order,
                PhaseNumber = c.PhaseNumber,
                Title = c.Title,
                Slug = c.Slug,
                Summary = c.Summary,
                EstimatedHours = c.EstimatedHours,
                Level = Text.ParseEnum(c.Level, DifficultyLevel.Advanced),
                MinimumTrack = Text.ParseEnum(c.MinimumTrack, TrackMode.Balanced),
                Outcomes = string.Join('\n', c.Outcomes),
                SkillSlugs = string.Join(',', c.SkillSlugs)
            };

            foreach (var m in c.Modules.OrderBy(m => m.Order))
            {
                var module = new Module
                {
                    Order = m.Order,
                    Title = m.Title,
                    Summary = m.Summary,
                    EstimatedHours = m.EstimatedHours
                };

                foreach (var l in m.Lessons.OrderBy(l => l.Order))
                {
                    var lesson = new Lesson
                    {
                        Order = l.Order,
                        Title = l.Title,
                        Slug = l.Slug,
                        Type = Text.ParseEnum(l.Type, LessonType.Concept),
                        EstimatedMinutes = l.EstimatedMinutes,
                        MinimumTrack = Text.ParseEnum(l.MinimumTrack, TrackMode.Balanced),
                        ContentMarkdown = l.ContentMarkdown,
                        CodeExample = l.CodeExample,
                        CodeLanguage = l.CodeLanguage ?? "csharp",
                        DiagramMermaid = l.DiagramMermaid,
                        KeyTakeaways = string.Join('\n', l.KeyTakeaways)
                    };

                    foreach (var r in l.Resources ?? [])
                        lesson.Resources.Add(new LessonResource
                        {
                            Title = r.Title,
                            Url = r.Url,
                            Kind = Text.ParseEnum(r.Kind, ResourceKind.Documentation)
                        });

                    if (l.Video is { } v)
                        // YouTubeUrl is deliberately left null: real links are added
                        // through Admin, never fabricated by the content pack.
                        lesson.Videos.Add(new Video
                        {
                            Title = v.Title,
                            YouTubeUrl = null,
                            Instructor = v.Instructor,
                            DurationMinutes = v.DurationMinutes,
                            SkillLevel = Text.ParseEnum(v.SkillLevel, DifficultyLevel.Advanced),
                            IsVerified = false
                        });

                    if (l.Quiz is { } q)
                    {
                        var quiz = new Quiz { Title = q.Title, PassMarkPercent = q.PassMarkPercent };
                        var qOrder = 1;
                        foreach (var question in q.Questions)
                        {
                            var entity = new QuizQuestion
                            {
                                Order = qOrder++,
                                Prompt = question.Prompt,
                                Explanation = question.Explanation,
                                AllowsMultiple = question.AllowsMultiple
                            };
                            var oOrder = 1;
                            foreach (var option in question.Options)
                                entity.Options.Add(new QuizOption { Order = oOrder++, Text = option.Text, IsCorrect = option.IsCorrect });
                            quiz.Questions.Add(entity);
                        }
                        lesson.Quiz = quiz;
                    }

                    module.Lessons.Add(lesson);
                }

                course.Modules.Add(module);
            }

            db.Courses.Add(course);
        }
        await db.SaveChangesAsync(ct);

        // --- practice, interview, labs -----------------------------------
        foreach (var p in Load<List<PracticeSeed>>("practice-questions.json") ?? [])
            db.PracticeQuestions.Add(new PracticeQuestion
            {
                CareerPathId = p.CareerSlug is not null && careersBySlug.TryGetValue(p.CareerSlug, out var career) ? career.Id : null,
                Category = p.Category,
                Mode = Text.ParseEnum(p.Mode, PracticeMode.Medium),
                Prompt = p.Prompt,
                Scenario = p.Scenario,
                ModelAnswer = p.ModelAnswer,
                RubricJson = Text.ToJson(p.Rubric),
                Tags = p.Tags,
                EstimatedMinutes = p.EstimatedMinutes
            });

        foreach (var i in Load<List<InterviewSeed>>("interview-questions.json") ?? [])
            db.InterviewQuestions.Add(new InterviewQuestion
            {
                CareerPathId = i.CareerSlug is not null && careersBySlug.TryGetValue(i.CareerSlug, out var career) ? career.Id : null,
                Category = Text.ParseEnum(i.Category, InterviewCategory.Technical),
                Difficulty = Text.ParseEnum(i.Difficulty, DifficultyLevel.Advanced),
                Question = i.Question,
                SuggestedAnswer = i.SuggestedAnswer,
                Tips = i.Tips,
                TimeLimitSeconds = i.TimeLimitSeconds,
                FollowUpsJson = Text.ToJson(i.FollowUps),
                RubricJson = Text.ToJson(i.Rubric)
            });

        foreach (var a in Load<List<ArchitectureChallengeSeed>>("architecture-challenges.json") ?? [])
            db.ArchitectureChallenges.Add(new ArchitectureChallenge
            {
                Title = a.Title,
                Slug = a.Slug,
                Scenario = a.Scenario,
                RequirementsJson = Text.ToJson(a.Requirements),
                ChoiceGroupsJson = Text.ToJson(a.ChoiceGroups),
                SuggestedArchitectureJson = Text.ToJson(a.Suggested),
                Rationale = a.Rationale,
                DiagramMermaid = a.DiagramMermaid,
                Difficulty = Text.ParseEnum(a.Difficulty, DifficultyLevel.Advanced),
                EstimatedMinutes = a.EstimatedMinutes
            });

        foreach (var e in Load<List<CodingExerciseSeed>>("coding-exercises.json") ?? [])
            db.CodingExercises.Add(new CodingExercise
            {
                Category = e.Category,
                Title = e.Title,
                Slug = e.Slug,
                Difficulty = Text.ParseEnum(e.Difficulty, DifficultyLevel.Intermediate),
                ProblemMarkdown = e.ProblemMarkdown,
                Language = e.Language,
                StarterCode = e.StarterCode,
                TestsJson = Text.ToJson(e.Tests),
                SolutionCode = e.SolutionCode,
                Explanation = e.Explanation,
                EstimatedMinutes = e.EstimatedMinutes
            });

        foreach (var b in Load<List<BadgeSeed>>("badges.json") ?? [])
            db.Badges.Add(new Badge
            {
                Code = b.Code,
                Name = b.Name,
                Description = b.Description,
                Tier = Text.ParseEnum(b.Tier, BadgeTier.Bronze),
                Criteria = b.Criteria,
                XpReward = b.XpReward
            });

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Content pack seeded.");
    }

    // ----- demo learner --------------------------------------------------

    private async Task SeedDemoUsersAsync(CancellationToken ct)
    {
        var admin = new AppUser
        {
            Email = "admin@futuretech.local",
            PasswordHash = hasher.Hash("Admin#2026"),
            DisplayName = "Platform Admin",
            Role = UserRole.Admin,
            YearsExperience = 20
        };

        var learner = new AppUser
        {
            Email = "demo@futuretech.local",
            PasswordHash = hasher.Hash("Demo#2026"),
            DisplayName = "Ashok",
            Role = UserRole.Learner,
            YearsExperience = 20
        };

        db.Users.AddRange(admin, learner);
        await db.SaveChangesAsync(ct);

        var primary = await db.CareerPaths.OrderBy(c => c.Rank).FirstOrDefaultAsync(c => c.IsPrimaryRecommended, ct);
        var skills = await db.Skills.AsNoTracking().ToListAsync(ct);

        foreach (var user in new[] { admin, learner })
        {
            db.StudyProfiles.Add(new StudyProfile
            {
                UserId = user.Id,
                TargetCareerPathId = primary?.Id,
                WeekdayHours = 1.5,
                SaturdayHours = 3,
                SundayHours = 3,
                DesiredSalaryUsd = 200_000,
                CurrentSkillLevel = 70,
                TrackMode = TrackMode.Balanced,
                // Both demo accounts skip the wizard: the learner so the dashboard is
                // populated on first sign-in, the admin because content management is
                // not a study activity. A brand-new account still sees the wizard.
                OnboardingCompletedAt = DateTimeOffset.Now.AddDays(user.Id == learner.Id ? -98 : -1)
            });

            foreach (var skill in skills)
                db.UserSkills.Add(new UserSkill { UserId = user.Id, SkillId = skill.Id, CurrentLevel = skill.BaselineLevel });
        }

        await db.SaveChangesAsync(ct);
        await SeedDemoProgressAsync(learner.Id, ct);
    }

    /// <summary>
    /// Fabricates ~14 weeks of plausible activity for the demo learner: early
    /// phases completed, current phase in progress, later phases untouched.
    /// </summary>
    private async Task SeedDemoProgressAsync(Guid userId, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.Now);
        var random = new Random(20260919);

        var lessons = await db.Lessons.AsNoTracking()
            .OrderBy(l => l.Module!.Course!.Order).ThenBy(l => l.Module!.Order).ThenBy(l => l.Order)
            .Select(l => new { l.Id, l.EstimatedMinutes, HasQuiz = l.Quiz != null })
            .ToListAsync(ct);

        var completedCount = (int)Math.Round(lessons.Count * 0.32);
        var startDate = today.AddDays(-97);

        for (var i = 0; i < completedCount; i++)
        {
            var lesson = lessons[i];
            var when = startDate.AddDays((int)Math.Round(i * 97.0 / Math.Max(1, completedCount)));
            db.LessonProgress.Add(new LessonProgress
            {
                UserId = userId,
                LessonId = lesson.Id,
                Status = ProgressStatus.Completed,
                VideoWatched = true,
                MinutesSpent = lesson.EstimatedMinutes,
                QuizScorePercent = lesson.HasQuiz ? random.Next(70, 96) : null,
                CompletedAt = new DateTimeOffset(when.ToDateTime(new TimeOnly(20, 0)), TimeSpan.Zero)
            });
            db.XpEvents.Add(new XpEvent { UserId = userId, Amount = Xp.LessonCompleted, Reason = "Lesson completed", RefType = "lesson", RefId = lesson.Id });
        }

        if (completedCount < lessons.Count)
            db.LessonProgress.Add(new LessonProgress
            {
                UserId = userId,
                LessonId = lessons[completedCount].Id,
                Status = ProgressStatus.InProgress,
                MinutesSpent = 12
            });

        // Study sessions: a consistent recent streak plus sparser earlier weeks.
        for (var offset = 97; offset >= 0; offset--)
        {
            var date = today.AddDays(-offset);
            var isRecent = offset <= 13;
            var studies = isRecent || date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday || random.NextDouble() < 0.62;
            if (!studies) continue;

            var minutes = date.DayOfWeek switch
            {
                DayOfWeek.Saturday or DayOfWeek.Sunday => random.Next(100, 190),
                _ => random.Next(60, 110)
            };
            db.StudySessions.Add(new StudySession
            {
                UserId = userId,
                OnDate = date,
                Minutes = minutes,
                ActivityType = (StudyActivityType)random.Next(0, 9),
                RefType = "lesson"
            });
        }

        // Practice attempts across modes.
        var practice = await db.PracticeQuestions.AsNoTracking().Take(60).ToListAsync(ct);
        var attemptCount = Math.Min(practice.Count, 34);
        for (var i = 0; i < attemptCount; i++)
        {
            var question = practice[i];
            var score = random.Next(52, 92);
            db.PracticeAttempts.Add(new PracticeAttempt
            {
                UserId = userId,
                PracticeQuestionId = question.Id,
                AnswerText = "Demo answer recorded during onboarding of the platform.",
                Score = score,
                DimensionScoresJson = "[]",
                Strengths = "Covered the core components and data flow.",
                Weaknesses = "Cost modelling and failure modes need more depth.",
                MinutesSpent = question.EstimatedMinutes
            });
            db.XpEvents.Add(new XpEvent { UserId = userId, Amount = Xp.PracticeAttempt, Reason = "Practice attempt", RefType = "practice", RefId = question.Id });
        }

        // Interview practice and one completed mock.
        var interviews = await db.InterviewQuestions.AsNoTracking().Take(12).ToListAsync(ct);
        foreach (var q in interviews.Take(9))
            db.InterviewAttempts.Add(new InterviewAttempt
            {
                UserId = userId,
                InterviewQuestionId = q.Id,
                AnswerText = "Demo answer recorded during onboarding of the platform.",
                Score = random.Next(58, 86),
                Feedback = "Add concrete numbers and name the security controls explicitly.",
                SecondsTaken = random.Next(150, 290)
            });

        // Projects: three finished, one in flight.
        var projects = await db.Projects.AsNoTracking().Include(p => p.Milestones).OrderBy(p => p.Order).ToListAsync(ct);
        for (var i = 0; i < Math.Min(4, projects.Count); i++)
        {
            var project = projects[i];
            var complete = i < 3;
            var progress = new UserProjectProgress
            {
                UserId = userId,
                ProjectId = project.Id,
                Status = complete ? ProgressStatus.Completed : ProgressStatus.InProgress,
                PercentComplete = complete ? 100 : 40,
                RepoUrl = complete ? $"https://github.com/example/{project.Slug}" : null,
                Notes = complete ? "Deployed to Azure Container Apps and documented." : "Vector index wired up; citations pending.",
                StartedAt = DateTimeOffset.Now.AddDays(-70 + i * 12),
                CompletedAt = complete ? DateTimeOffset.Now.AddDays(-55 + i * 12) : null
            };
            db.UserProjectProgress.Add(progress);
            await db.SaveChangesAsync(ct);

            var milestones = project.Milestones.OrderBy(m => m.Order).ToList();
            var take = complete ? milestones.Count : Math.Max(1, milestones.Count * 2 / 5);
            foreach (var milestone in milestones.Take(take))
                db.UserProjectMilestones.Add(new UserProjectMilestone
                {
                    UserProjectProgressId = progress.Id,
                    ProjectMilestoneId = milestone.Id
                });

            if (complete)
                db.XpEvents.Add(new XpEvent { UserId = userId, Amount = Xp.ProjectCompleted, Reason = "Project completed", RefType = "project", RefId = project.Id });
        }

        // Certifications: one passed, two planned.
        var certs = await db.Certifications.AsNoTracking()
            .Where(c => c.Code == "AZ-900" || c.Code == "AI-102" || c.Code == "AZ-305").ToListAsync(ct);
        foreach (var cert in certs)
            db.UserCertifications.Add(new UserCertification
            {
                UserId = userId,
                CertificationId = cert.Id,
                Status = cert.Code == "AZ-900" ? CertificationStatus.Passed : CertificationStatus.Studying,
                TargetDate = cert.Code == "AZ-900" ? null : today.AddDays(cert.Code == "AI-102" ? 60 : 140),
                CompletedDate = cert.Code == "AZ-900" ? today.AddDays(-40) : null,
                ScorePercent = cert.Code == "AZ-900" ? 88 : null,
                PrepHoursLogged = cert.Code == "AZ-900" ? 22 : 6
            });

        // A few notes and bookmarks so the personal screens are not empty.
        var firstLessons = await db.Lessons.AsNoTracking().OrderBy(l => l.Order).Take(3)
            .Select(l => new { l.Id, l.Title, l.Slug }).ToListAsync(ct);
        foreach (var lesson in firstLessons)
        {
            db.Notes.Add(new Note
            {
                UserId = userId,
                Scope = NoteScope.Lesson,
                RefId = lesson.Id,
                RefTitle = lesson.Title,
                Title = $"Key points — {lesson.Title}",
                Body = "Revisit before the weekly assessment. Map each pattern back to a system I have actually shipped.",
                IsImportant = true,
                Tags = "review,architecture"
            });
            db.Bookmarks.Add(new Bookmark
            {
                UserId = userId,
                ItemType = BookmarkItemType.Lesson,
                RefId = lesson.Id,
                Title = lesson.Title,
                Subtitle = "Lesson",
                DeepLink = $"/learn/{lesson.Slug}"
            });
        }

        await db.SaveChangesAsync(ct);

        // Badges the demo activity genuinely qualifies for.
        var badges = await db.Badges.AsNoTracking().ToListAsync(ct);
        foreach (var code in new[] { "first-lesson", "ten-lessons", "streak-7", "practice-25", "project-finisher" })
        {
            var badge = badges.FirstOrDefault(b => b.Code == code);
            if (badge is null) continue;
            db.UserBadges.Add(new UserBadge { UserId = userId, BadgeId = badge.Id });
            db.XpEvents.Add(new XpEvent { UserId = userId, Amount = badge.XpReward, Reason = $"Badge: {badge.Name}", RefType = "badge", RefId = badge.Id });
        }

        await db.SaveChangesAsync(ct);

        // Build the demo learner a real calendar using the same generator the
        // application uses, so the dashboard and calendar are populated on the
        // very first sign-in rather than showing an empty plan.
        await planGenerator.GenerateAsync(userId, today, 12, ct);

        logger.LogInformation("Demo learner seeded with {Lessons} completed lessons.", completedCount);
    }

    private T? Load<T>(string fileName)
    {
        var path = Path.Combine(options.SeedDataPath, fileName);
        if (!File.Exists(path))
        {
            logger.LogWarning("Seed file {File} not found at {Path}", fileName, path);
            return default;
        }

        using var stream = File.OpenRead(path);
        return JsonSerializer.Deserialize<T>(stream, Json);
    }

    /// <summary>Concatenates every list file matching the pattern, in filename order.</summary>
    private List<T> LoadAll<T>(string pattern)
    {
        if (!Directory.Exists(options.SeedDataPath))
        {
            logger.LogWarning("Seed directory {Path} not found", options.SeedDataPath);
            return [];
        }

        var items = new List<T>();
        foreach (var file in Directory.GetFiles(options.SeedDataPath, pattern).OrderBy(f => f, StringComparer.Ordinal))
        {
            using var stream = File.OpenRead(file);
            var batch = JsonSerializer.Deserialize<List<T>>(stream, Json);
            if (batch is not null) items.AddRange(batch);
        }
        return items;
    }
}

public class SeedOptions
{
    public string SeedDataPath { get; set; } = "SeedData";
    public bool CreateDemoUser { get; set; } = true;
}
