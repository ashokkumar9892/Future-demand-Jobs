# FutureTech Career Academy

A career-transition platform for an experienced enterprise software engineer
(20+ years across C#, .NET, Angular, SQL Server, Azure and AWS) moving into the
highest-paying, most future-proof IT roles in the USA.

It is not an informational site. It plans, schedules, teaches, tests, tracks and
prepares — and it is deliberately honest about what it can and cannot claim.

---

## Run it

The API defaults to **SQLite**, so nothing needs installing beyond the .NET SDK
and Node. The database is created and seeded on first run.

```bash
# Terminal 1 — API on http://localhost:5080 (Swagger at /swagger)
cd src/backend/FutureTech.Api
dotnet run

# Terminal 2 — SPA on http://localhost:5173
cd src/frontend
npm install
npm run dev
```

Open <http://localhost:5173> and sign in:

| Account | Password | What you see |
|---|---|---|
| `demo@futuretech.local` | `Demo#2026` | A learner with ~14 weeks of seeded progress — every screen populated |
| `admin@futuretech.local` | `Admin#2026` | The same platform plus the Admin console |

A brand-new account goes through the setup wizard first.

### With PostgreSQL and Docker

```bash
docker compose up --build       # SPA on :8080, API on :5080, Postgres on :5432
```

The same EF model runs on both providers; `Database:Provider` selects between
`Sqlite` and `Postgres`.

---

## What is in here

| Area | Detail |
|---|---|
| Career paths | 13 roles ranked by realistic USA compensation, each with salary bands, demand outlook, AI-replacement risk, skill gap, certifications, projects, interview focus and resume keywords |
| Curriculum | 10 phases, 30 modules, 60 lessons for the AI Solutions Architect track — architecture, Azure, AWS, AI fundamentals, LLM development, RAG, agents, AI security, enterprise AI architecture, portfolio and interview |
| Practice | 56 scored written questions across Easy / Medium / Hard / Architect / Interview / Scenario |
| Labs | 10 architecture challenges, 15 coding exercises across 14 categories |
| Projects | 10 portfolio projects with milestones, acceptance criteria and reference architectures |
| Interview | 20 questions across 7 categories, plus a multi-turn mock interview with a five-dimension scorecard |
| Planning | Study-time calculator, automatic plan generation, month and week calendars, START TODAY'S TRAINING |
| Tracking | Lesson progress, quiz scores, practice scores, project milestones, study streak, XP, badges, readiness |

Content lives as JSON in `src/backend/FutureTech.Api/SeedData/` and is editable
through the Admin console without a rebuild.

---

## Architecture

Full detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — application
structure, 56-table schema, page structure, component structure, API design and
the development phases.

```
src/backend/          .NET 8, Clean Architecture
  FutureTech.Domain          entities and enums, zero dependencies
  FutureTech.Application     use-case services, DTOs, abstractions
  FutureTech.Infrastructure  EF Core, provider switch, JWT, seeding
  FutureTech.Api             controllers, Swagger, middleware

src/frontend/         React 19 + TypeScript + Vite + Tailwind
  app/ components/ features/ pages/ lib/ types/
```

Authentication is JWT bearer with `Learner` and `Admin` roles; passwords are
PBKDF2-SHA256 with a per-user salt.

---

## The honesty constraints

These are product requirements enforced in code, not marketing copy.

**Readiness is measured, not asserted.** The job-readiness score is computed
only from completed lessons, quiz results, scored practice attempts and finished
project milestones. Self-assessed skill levels are deliberately excluded, so the
score cannot be inflated by editing the skill matrix. It is labelled as learning
progress and never as a professional qualification.

**The resume cannot overclaim.** Every generated line carries a required
`EvidenceKind` — `ProfessionalExperience`, `PersonalProject`, `Training` or
`Certification`. The generator only ever emits the last three. The suggested
headline changes only when there is measured evidence behind it.

**No invented video URLs.** Every lesson has a video slot with authored
metadata, and `YouTubeUrl` is null in all seeded content. The lesson player shows
a placeholder explaining this. An administrator attaches a verified link in
Admin → Videos and it embeds automatically.

**Answer scoring says what it is.** `IAnswerEvaluator` ships as a deterministic
rubric scorer — keyword coverage, structure and depth. It never claims to be a
language model, and the method is surfaced in the UI next to every score.
Swapping in a model-backed implementation is a single DI registration.

**Estimates are estimates.** Every hour, week and completion date is rendered
with an explicit disclaimer that these are learning-time estimates based on
stated study hours, not guarantees of employment, salary or hiring outcomes.

**Salary data is dated and sourced.** Each career carries `SalaryAsOf` and
`SalarySource`. Updates go through a dedicated endpoint that writes an audited
`SalaryRevisions` row.

---

## Verification

The backend was exercised end to end against a running instance (41 checks:
auth, careers, roadmap, courses, lessons, quizzes, study calculation and plan
generation, practice, projects, architecture and coding labs, interview, mock
interview, readiness, skills, resume, certifications, search, gamification,
admin CRUD, salary revision, and role/authentication boundaries).

All 26 SPA routes were then driven in a headless browser and asserted on rendered
content, with zero console errors.

---

## Known limitations

Stated plainly, because a project claiming none reads as one that was never
tested.

- **Coding labs do not execute code.** Submissions are checked statically
  against the constructs each exercise requires. A sandboxed runner behind the
  same endpoint is the documented next step.
- **Answer scoring is a rubric check.** It rewards naming the right concepts. A
  strong answer using different vocabulary can score lower than it deserves,
  which is why the model answer is always shown alongside.
- **Lesson content exists for the primary track only.** The other twelve careers
  have full skill gaps, ladders, certifications, projects and interview focus,
  but not lesson-by-lesson curricula. The career detail page says so.
- **No migrations yet.** `EnsureCreated` is used for first-run friction; a schema
  change currently means dropping the local database. Switch to
  `db.Database.MigrateAsync()` before any real deployment.
- **The Mermaid bundle is large** (~4.7 MB raw). It is lazily imported and only
  loads on screens that render a diagram, but it dominates that chunk.
- **Salary figures are aggregated public estimates**, not a licensed data feed.
  They are dated, sourced, and updatable through the API for exactly that reason.

---

## Future work

Documented rather than built: a model-backed `IAnswerEvaluator`, sandboxed code
execution, Entra ID SSO, Azure Container Apps infrastructure-as-code, and
billing if this ever becomes a commercial SaaS product.
