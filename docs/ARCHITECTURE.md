# FutureTech Career Academy — Application Architecture

> A career-transition platform for experienced enterprise software engineers
> (20+ yrs, .NET / Angular / SQL Server / Azure / AWS) moving into the
> highest-paying, most future-proof IT roles in the USA.

---

## 1. Application Architecture

### 1.1 Solution shape

```
Future-demand-Jobs/
├─ docs/                      Architecture, schema, API and roadmap docs
├─ src/
│  ├─ backend/                .NET 8 — Clean Architecture (4 projects)
│  │  ├─ FutureTech.Domain          Entities + enums. No dependencies.
│  │  ├─ FutureTech.Application     Use-cases, DTOs, service contracts.
│  │  ├─ FutureTech.Infrastructure  EF Core, Npgsql/SQLite, JWT, seeding.
│  │  └─ FutureTech.Api             ASP.NET Core Web API + Swagger + SeedData.
│  └─ frontend/               React 18 + TypeScript + Vite + Tailwind
├─ docker-compose.yml         api + web + postgres
└─ README.md
```

### 1.2 Dependency rule (Clean Architecture)

```
        FutureTech.Api
              │ depends on
              ▼
     FutureTech.Infrastructure ──────┐
              │ depends on           │ implements
              ▼                      ▼
      FutureTech.Application ── Abstractions (IAppDbContext, IJwtTokenService,
              │ depends on              ICurrentUser, IPasswordHasher,
              ▼                         IAnswerEvaluator, IDateTimeProvider)
        FutureTech.Domain
```

- `Domain` has **zero** package references — pure entities and enums.
- `Application` holds every use-case as a service behind an interface
  (`ICareerService`, `IStudyPlannerService`, `IReadinessService`, …) plus the
  DTO contracts the API returns. It depends only on abstractions.
- `Infrastructure` owns EF Core, the database provider switch, password
  hashing, JWT issuing, and the JSON content seeder.
- `Api` is thin: controllers translate HTTP to Application services.

### 1.3 Cross-cutting decisions

| Concern | Decision | Why |
|---|---|---|
| Database | PostgreSQL (prod/Docker) **and** SQLite (local dev) behind one `DbContext` | Runs instantly on a dev box with no Postgres installed; identical EF model |
| Provider switch | `Database:Provider` = `Sqlite` or `Postgres` in appsettings | One code path, config-driven |
| Auth | JWT bearer, HMAC-SHA256, `Learner` / `Admin` roles | Stateless; easy to swap for Entra ID later |
| Passwords | PBKDF2 (Rfc2898, SHA256, 100k iterations, per-user salt) | No external dependency |
| Seeding | JSON files in `FutureTech.Api/SeedData/`, applied at startup when empty | Content is data, not code — editable without a rebuild, and Admin writes the same tables |
| Scoring | `IAnswerEvaluator` — deterministic rubric/keyword scorer today, swappable for a real LLM implementation later | Honest, offline-capable, documented upgrade path |
| Salary data | `CareerPath` salary columns + `SalaryRevisions` audit table + Admin API | Requirement: salary data updatable via API/admin |
| API docs | Swashbuckle / OpenAPI at `/swagger` | Requirement |
| Time | `IDateTimeProvider` injected | Deterministic study-plan generation and tests |

### 1.4 Honesty constraints enforced in code

- `ReadinessScore` is computed only from measured signals (lesson completion,
  quiz scores, practice scores, project milestones, certifications) and is
  labelled *learning progress*, never *professional qualification*.
- `ResumeItem.EvidenceKind` is a required enum:
  `ProfessionalExperience | PersonalProject | Training | Certification`.
  The generator never emits professional experience the learner did not enter.
- `Video.YouTubeUrl` is nullable and **empty in all seed data**. Videos are
  added through Admin; the lesson screen renders a placeholder otherwise.
- Every hour/week estimate is rendered with an explicit
  "learning estimates, not guarantees of employment" disclaimer.

---

## 2. Database Schema

Grouped by bounded context. Keys are `Guid` (`uuid` on Postgres, `TEXT` on
SQLite). Every table has `CreatedAt`; mutable ones have `UpdatedAt`.

### 2.1 Identity and profile

| Table | Key columns |
|---|---|
| `AppUsers` | Email (unique), PasswordHash, DisplayName, Role, ThemePreference, YearsExperience |
| `StudyProfiles` | UserId (unique), WeekdayHours, SaturdayHours, SundayHours, StudyDays, TargetDate, TargetCareerPathId, DesiredSalary, CurrentSkillLevel, TrackMode, OnboardingCompletedAt |
| `UserSkills` | UserId, SkillId, CurrentLevel (0-100), SelfAssessedAt |

### 2.2 Careers

| Table | Key columns |
|---|---|
| `Skills` | Name, Slug, Category (Language/Cloud/AI/Architecture/Security/Data/DevOps/Soft) |
| `CareerPaths` | Rank, Title, Slug, Summary, SalaryMin, SalaryMax, SeniorSalaryMin, SeniorSalaryMax, TwoHundredKPotential, DemandOutlook, AiReplacementRisk, Difficulty, EstimatedHours, IsPrimaryRecommended, ResumeKeywords, Responsibilities, InterviewFocus, SalaryAsOf, SalarySource |
| `CareerSkills` | CareerPathId, SkillId, TargetLevel, Importance (Core/Important/NiceToHave) |
| `CareerCertifications` | CareerPathId, CertificationId, Priority |
| `CareerProjects` | CareerPathId, ProjectId, Order |
| `LadderStages` | CareerPathId, StageOrder, Title, RoleTitle, Description, SalaryMin, SalaryMax, DurationMonths, Milestones |
| `ReadinessDimensions` | CareerPathId, Name, Weight, SkillSlugs |
| `SalaryRevisions` | CareerPathId, Old/New min+max, Source, ChangedByUserId, ChangedAt |

### 2.3 Learning content

| Table | Key columns |
|---|---|
| `Courses` | CareerPathId, Order, Title, Slug, Summary, PhaseNumber, EstimatedHours, Level, TrackModes |
| `Modules` | CourseId, Order, Title, Summary, EstimatedHours |
| `Lessons` | ModuleId, Order, Title, Slug, Type (Concept/Lab/Architecture/Coding/Review), EstimatedMinutes, ContentMarkdown, CodeExample, CodeLanguage, DiagramMermaid, KeyTakeaways, TrackMode |
| `LessonResources` | LessonId, Title, Url, Kind |
| `Videos` | LessonId, Title, YouTubeUrl (nullable), Instructor, DurationMinutes, SkillLevel, IsVerified |
| `Quizzes` | LessonId, Title, PassMarkPercent |
| `QuizQuestions` | QuizId, Order, Prompt, Explanation, Kind |
| `QuizOptions` | QuizQuestionId, Text, IsCorrect |

### 2.4 Practice, labs, interview

| Table | Key columns |
|---|---|
| `PracticeQuestions` | CareerPathId, Category, Mode (Easy/Medium/Hard/Architect/Interview/Scenario), Prompt, Scenario, ModelAnswer, Rubric (JSON), Tags |
| `PracticeAttempts` | UserId, PracticeQuestionId, AnswerText, Score, DimensionScores (JSON), Strengths, Weaknesses |
| `ArchitectureChallenges` | Title, Scenario, Requirements (JSON), ChoiceGroups (JSON), SuggestedArchitecture (JSON), Rationale, Difficulty |
| `ArchitectureAttempts` | UserId, ChallengeId, Selections (JSON), Score, PerGroupScores (JSON) |
| `CodingExercises` | Category, Title, Slug, Difficulty, ProblemMarkdown, Language, StarterCode, Tests (JSON), SolutionCode, Explanation |
| `CodingAttempts` | UserId, ExerciseId, SubmittedCode, Passed, TestResults (JSON), Score |
| `InterviewQuestions` | Category, Difficulty, Question, SuggestedAnswer, Tips, TimeLimitSeconds, FollowUps (JSON) |
| `InterviewAttempts` | UserId, InterviewQuestionId, AnswerText, Score, Feedback, SecondsTaken |
| `MockInterviewSessions` | UserId, CareerPathId, scores for Communication / TechnicalKnowledge / Architecture / ProblemSolving / SecurityAwareness, OverallScore, Recommendations |
| `MockInterviewTurns` | SessionId, Order, Question, IsFollowUp, AnswerText, TurnScore, Feedback |

### 2.5 Projects and certifications

| Table | Key columns |
|---|---|
| `Projects` | Order, Title, Slug, Summary, Brief, TechStack, Difficulty, EstimatedHours, ArchitectureMermaid, AcceptanceCriteria, ResumeBullets, SkillSlugs |
| `ProjectMilestones` | ProjectId, Order, Title, Description, EstimatedHours |
| `UserProjectProgress` | UserId, ProjectId, Status, PercentComplete, RepoUrl, DemoUrl, Notes |
| `UserProjectMilestones` | UserProjectProgressId, ProjectMilestoneId, CompletedAt |
| `Certifications` | Code, Name, Vendor, Level, EstimatedPrepHours, Topics (JSON), ExamCostUsd, OfficialUrl |
| `UserCertifications` | UserId, CertificationId, Status, TargetDate, CompletedDate, ScorePercent |

### 2.6 Progress, planning, personal

| Table | Key columns |
|---|---|
| `LessonProgress` | UserId, LessonId, Status, VideoWatched, MinutesSpent, QuizScorePercent, CompletedAt |
| `StudySessions` | UserId, OnDate, Minutes, ActivityType, RefType, RefId |
| `StudyPlanDays` | UserId, OnDate, Status (NotStarted/Scheduled/InProgress/Completed/Late), TargetMinutes |
| `StudyPlanItems` | StudyPlanDayId, Order, ActivityType, Title, Minutes, RefType, RefId, Status |
| `Notes` | UserId, Scope, RefId, Title, Body, IsImportant, IsQuestion, CodeSnippet, Links, Tags |
| `Bookmarks` | UserId, ItemType, RefId, Title, Subtitle |
| `Badges` / `UserBadges` | Code, Name, Description, Tier, Criteria / EarnedAt |
| `XpEvents` | UserId, Amount, Reason, RefType, RefId |
| `ReadinessSnapshots` | UserId, CareerPathId, Overall, DimensionScores (JSON), TakenAt |
| `ResumeProfiles` / `ResumeItems` | Headline, Summary / Section, Text, EvidenceKind, SkillSlug |

### 2.7 Indexing plan

- Unique: `AppUsers.Email`, `CareerPaths.Slug`, `Courses.Slug`, `Lessons.Slug`,
  `Projects.Slug`, `Skills.Slug`, `Certifications.Code`, `Badges.Code`.
- Composite unique: `(UserId, LessonId)` on `LessonProgress`,
  `(UserId, SkillId)` on `UserSkills`, `(UserId, OnDate)` on `StudyPlanDays`,
  `(UserId, ItemType, RefId)` on `Bookmarks`.
- Non-unique: every `UserId` FK, `Lessons.ModuleId`, `Modules.CourseId`,
  `Courses.CareerPathId`, `(UserId, OnDate)` on `StudySessions`.

---

## 3. Main Page Structure

| Route | Page | Phase |
|---|---|---|
| `/login`, `/register` | Auth | 1 |
| `/onboarding` | Setup wizard (study hours, days, target date, target job, salary, level, track mode, review) | 1 |
| `/` | Dashboard — greeting, target, today's plan, START TODAY'S TRAINING, progress rings, skills radar, weekly hours, streak, current project, upcoming certification | 1 |
| `/careers` | Career Paths — 13 ranked cards, filters | 1 |
| `/careers/:slug` | Career detail — salary, demand, AI risk, skill gap, certifications, projects, interview, resume keywords | 1 |
| `/roadmap` | My Roadmap — career ladder + compensation progression + phase timeline | 1 |
| `/courses` | Course catalog grouped by phase | 1 |
| `/courses/:slug` | Course outline: modules and lessons | 1 |
| `/learn/:lessonSlug` | Lesson player — 3 columns: navigation / video + content + diagram + code / notes + progress + practice | 1 |
| `/videos` | Video library (admin-populated) | 2 |
| `/practice`, `/practice/:id` | Six practice modes, answer and scored feedback | 1 |
| `/coding-labs`, `/coding-labs/:slug` | Monaco editor, run, tests, solution | 2 |
| `/architecture-lab`, `/architecture-lab/:id` | Challenge, component selection, comparison | 2 |
| `/projects`, `/projects/:slug` | Ten projects, milestones, repo links | 1 |
| `/certifications` | Certification tracker | 2 |
| `/interview-prep` | Seven categories, timer, evaluation | 2 |
| `/mock-interview` | Multi-turn session plus five-dimension scorecard | 3 |
| `/job-readiness` | Per-career readiness plus READY / ALMOST READY / NEEDS TRAINING | 2 |
| `/resume` | Evidence-tagged resume builder | 3 |
| `/calendar` | Month and week views, five statuses | 2 |
| `/bookmarks`, `/notes` | Personal collections | 2 |
| `/skills` | Skill matrix (editable Current, career-driven Target) | 1 |
| `/settings` | Profile, study time, theme, track mode | 1 |
| `/admin` | Admin console for careers, content, salaries, weights | 3 |

---

## 4. Component Structure

```
src/frontend/src/
├─ app/                    App.tsx, routes.tsx, providers (Query, Auth, Theme)
├─ components/
│  ├─ layout/              AppShell, Sidebar, Topbar, PageHeader, CommandPalette
│  ├─ ui/                  Button, Card, Badge, Tabs, Modal, Input, Select, Slider,
│  │                       Table, Skeleton, EmptyState, Toast, StatusPill
│  ├─ charts/              ProgressRing, SkillRadar, WeeklyHoursChart, ReadinessBars,
│  │                       CompProgression, StreakStrip, DonutStat
│  ├─ career/              CareerCard, SalaryBand, DemandPill, AiRiskPill, SkillGapList
│  ├─ learning/            CourseCard, ModuleAccordion, LessonNav, VideoFrame,
│  │                       MarkdownView, CodeBlock, MermaidDiagram, QuizRunner
│  ├─ practice/            ModeSelector, AnswerEditor, ScoreCard, RubricBreakdown
│  ├─ architecture/        ChoiceGroup, ArchitectureCompare
│  ├─ planner/             StudyTimeForm, PlanCalculator, DayPlan, CalendarGrid
│  └─ common/              EstimateDisclaimer, EvidenceTag
├─ features/<domain>/      api.ts (typed calls) + hooks.ts (React Query)
├─ pages/                  One file per route
├─ lib/                    axios client, token store, formatters, cn()
├─ types/                  TS contracts mirroring API DTOs
└─ styles/                 Tailwind entry + design tokens
```

**Design system.** Dark-first premium SaaS palette (slate surfaces, indigo to
violet primary, emerald/amber/rose status), Inter for UI and JetBrains Mono for
code, fixed 264px sidebar, 8pt spacing grid, 150ms ease-out transitions only.

---

## 5. API Design

Base `/api`. JWT bearer everywhere except `/auth/*` and public career reads.

### Auth
```
POST /auth/register   {email,password,displayName}  -> token
POST /auth/login      {email,password}              -> token
GET  /auth/me                                       -> profile + role
```

### Careers
```
GET /careers                      ?search=&sort=rank|salary
GET /careers/{slug}
GET /careers/{slug}/ladder
GET /careers/{slug}/skill-gap
```

### Roadmap and planning
```
GET  /roadmap
GET  /study/profile          PUT /study/profile
POST /study/calculate        {weeklyHours,trackMode,careerId} -> hours/weeks/ETA
GET  /study/plan             ?from=&to=
POST /study/plan/generate    {fromDate,weeks}
POST /study/plan/items/{id}/complete
GET  /study/today
POST /study/start-today      -> next actionable item + deep link
```

### Courses and lessons
```
GET  /courses                ?careerId=&track=
GET  /courses/{slug}
GET  /lessons/{slug}
POST /lessons/{id}/progress  {status,minutesSpent,videoWatched}
POST /lessons/{id}/quiz      {answers[]} -> score + per-question feedback
GET  /videos                 ?search=
```

### Practice, labs, interview
```
GET  /practice               ?mode=&category=&careerId=
POST /practice/{id}/attempt  {answerText,minutesSpent}
GET  /architecture-challenges  /{id}
POST /architecture-challenges/{id}/attempt {selections}
GET  /coding-exercises       /{slug}
POST /coding-exercises/{id}/attempt {code}
GET  /interview/questions    ?category=&difficulty=
POST /interview/questions/{id}/attempt {answerText,seconds}
POST /mock-interview/start   {careerId}
POST /mock-interview/{id}/answer {answerText}
POST /mock-interview/{id}/finish
```

### Projects, certifications, readiness, resume
```
GET  /projects  /projects/{slug}
POST /projects/{id}/progress
POST /projects/{id}/milestones/{milestoneId}/toggle
GET  /certifications         PUT /certifications/mine/{id}
GET  /readiness              GET /readiness/{careerSlug}
GET  /resume                 POST /resume/generate
```

### Personal and platform
```
GET/POST/PUT/DELETE /notes        ?scope=&refId=
GET/POST/DELETE     /bookmarks
GET /skills/matrix                PUT /skills/mine
GET /dashboard                    entire home payload in one call
GET /search        ?q=            courses, lessons, videos, notes, practice, projects
GET /gamification                 xp, level, badges, streak
```

### Admin (role = Admin)
```
GET/POST/PUT/DELETE /admin/{careers|courses|modules|lessons|videos|
                            practice-questions|interview-questions|projects|
                            certifications|skills|badges|
                            architecture-challenges|coding-exercises}
PUT /admin/careers/{id}/salary             -> writes a SalaryRevisions row
PUT /admin/careers/{id}/readiness-weights
```

---

## 6. Development Phases

| Phase | Scope |
|---|---|
| **1 — Core loop, fully usable** | Clean-Architecture backend, full EF model, JSON seeder with demo data, JWT auth, onboarding wizard, Dashboard, Career Paths, Career detail, Roadmap ladder, Courses, Lesson player, study calculator and plan generator, Practice, Projects, Skill matrix, progress tracking, START TODAY'S TRAINING |
| **2 — Assessment and tracking** | Coding Labs, Architecture Lab, Interview Prep, Job Readiness, Certifications, Calendar, Videos library, Notes, Bookmarks, global search, gamification |
| **3 — Advanced** | Mock Interview, Resume Builder with evidence tags, Admin console, salary revision API |
| **4 — Future work (documented, not built)** | Real LLM evaluator behind `IAnswerEvaluator`, sandboxed code execution, Entra ID SSO, Azure Container Apps IaC, billing |
