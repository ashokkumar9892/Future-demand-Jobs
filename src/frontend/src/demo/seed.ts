/**
 * Loads the API's seed files and shapes them into the DTOs the UI already
 * expects. This is the demo equivalent of DatabaseSeeder.SeedContentAsync.
 *
 * The JSON is imported from FutureTech.Api/SeedData rather than copied, so
 * demo content and API content cannot drift apart. Only the shaping lives here.
 *
 * Identifiers are derived from slugs rather than random, so a rebuild does not
 * orphan progress already stored in a visitor's browser.
 */
import architectureChallengesRaw from '@seed/architecture-challenges.json';
import badgesRaw from '@seed/badges.json';
import careersRaw from '@seed/careers.json';
import certificationsRaw from '@seed/certifications.json';
import codingExercisesRaw from '@seed/coding-exercises.json';
import coursesPart1 from '@seed/courses.01-architecture-cloud.json';
import coursesPart2 from '@seed/courses.02-ai-llm-rag.json';
import coursesPart3 from '@seed/courses.03-agents-security-enterprise.json';
import interviewQuestionsRaw from '@seed/interview-questions.json';
import practiceQuestionsRaw from '@seed/practice-questions.json';
import projectsRaw from '@seed/projects.json';
import skillsRaw from '@seed/skills.json';

// ---------- shapes of the seed files (mirrors SeedModels.cs) ----------

interface SkillSeed {
  name: string;
  slug: string;
  category: string;
  baselineLevel: number;
}

interface CareerSkillSeed {
  slug: string;
  targetLevel: number;
  importance: string;
}

interface LadderStageSeed {
  stageOrder: number;
  title: string;
  roleTitle: string;
  description: string;
  salaryMinUsd: number;
  salaryMaxUsd: number;
  durationMonths: number;
  milestones: string[];
  isCurrentPosition: boolean;
}

interface ReadinessDimensionSeed {
  name: string;
  weight: number;
  skillSlugs: string[];
}

interface CareerSeed {
  rank: number;
  title: string;
  slug: string;
  summary: string;
  salaryMinUsd: number;
  salaryMaxUsd: number;
  seniorSalaryMinUsd: number;
  seniorSalaryMaxUsd: number;
  twoHundredKPotential: string;
  salaryAsOf: string;
  salarySource: string;
  demandOutlook: string;
  demandNotes: string;
  aiReplacementRisk: string;
  aiRiskNotes: string;
  difficulty: string;
  estimatedHours: number;
  isPrimaryRecommended: boolean;
  resumeKeywords: string[];
  responsibilities: string[];
  interviewFocus: string[];
  skills: CareerSkillSeed[];
  ladder: LadderStageSeed[];
  readinessDimensions: ReadinessDimensionSeed[];
  certifications: string[];
  projects: string[];
}

interface ResourceSeed {
  title: string;
  url: string;
  kind: string;
}

interface VideoSeed {
  title: string;
  instructor: string | null;
  durationMinutes: number;
  skillLevel: string;
}

interface QuizSeed {
  title: string;
  passMarkPercent: number;
  questions: {
    prompt: string;
    explanation: string;
    allowsMultiple: boolean;
    options: { text: string; isCorrect: boolean }[];
  }[];
}

interface LessonSeed {
  order: number;
  title: string;
  slug: string;
  type: string;
  estimatedMinutes: number;
  minimumTrack: string;
  contentMarkdown: string;
  codeExample: string | null;
  codeLanguage: string | null;
  diagramMermaid: string | null;
  keyTakeaways: string[];
  resources?: ResourceSeed[] | null;
  video?: VideoSeed | null;
  quiz?: QuizSeed | null;
}

interface CourseSeed {
  careerSlug: string;
  order: number;
  phaseNumber: number;
  title: string;
  slug: string;
  summary: string;
  estimatedHours: number;
  level: string;
  minimumTrack: string;
  outcomes: string[];
  skillSlugs: string[];
  modules: {
    order: number;
    title: string;
    summary: string;
    estimatedHours: number;
    lessons: LessonSeed[];
  }[];
}

interface RubricSeed {
  dimension: string;
  weight: number;
  keywords: string[];
  guidance: string;
}

interface PracticeSeed {
  careerSlug: string | null;
  category: string;
  mode: string;
  prompt: string;
  scenario: string;
  modelAnswer: string;
  rubric: RubricSeed[];
  tags: string;
  estimatedMinutes: number;
}

interface InterviewSeed {
  careerSlug: string | null;
  category: string;
  difficulty: string;
  question: string;
  suggestedAnswer: string;
  tips: string;
  timeLimitSeconds: number;
  followUps: string[];
  rubric: RubricSeed[];
}

interface ArchitectureSeed {
  title: string;
  slug: string;
  scenario: string;
  requirements: string[];
  choiceGroups: { key: string; label: string; options: string[] }[];
  suggested: { key: string; answer: string; acceptable: string[]; rationale: string }[];
  rationale: string;
  diagramMermaid: string | null;
  difficulty: string;
  estimatedMinutes: number;
}

interface CodingSeed {
  category: string;
  title: string;
  slug: string;
  difficulty: string;
  problemMarkdown: string;
  language: string;
  starterCode: string;
  tests: { name: string; mustContain: string[]; mustNotContain: string[] | null; hint: string }[];
  solutionCode: string;
  explanation: string;
  estimatedMinutes: number;
}

interface ProjectSeed {
  order: number;
  title: string;
  slug: string;
  summary: string;
  briefMarkdown: string;
  techStack: string;
  difficulty: string;
  estimatedHours: number;
  architectureMermaid: string | null;
  acceptanceCriteria: string[];
  resumeBullets: string[];
  skillSlugs: string[];
  milestones: { order: number; title: string; description: string; estimatedHours: number }[];
}

interface CertificationSeed {
  code: string;
  name: string;
  vendor: string;
  level: string;
  estimatedPrepHours: number;
  topics: string[];
  examCostUsd: number;
  officialUrl: string;
}

interface BadgeSeed {
  code: string;
  name: string;
  description: string;
  tier: string;
  criteria: string;
  xpReward: number;
}

// ---------- humanised enum labels, matching Text.Humanize on the server -----

export const humanise = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2');

// ---------- assembled content ----------

export interface DemoLesson extends LessonSeed {
  id: string;
  courseSlug: string;
  courseTitle: string;
  courseId: string;
  moduleTitle: string;
  moduleOrder: number;
  videoId: string;
  quizId: string;
}

export const skills = (skillsRaw as SkillSeed[]).map((s) => ({
  ...s,
  id: `skill:${s.slug}`,
  categoryLabel: humanise(s.category),
}));

export const skillBySlug = new Map(skills.map((s) => [s.slug, s]));

export const certifications = (certificationsRaw as CertificationSeed[]).map((c) => ({
  ...c,
  id: `cert:${c.code}`,
}));

export const certByCode = new Map(certifications.map((c) => [c.code, c]));

export const projects = (projectsRaw as ProjectSeed[]).map((p) => ({
  ...p,
  id: `project:${p.slug}`,
  difficultyLabel: humanise(p.difficulty),
  milestones: p.milestones.map((m) => ({ ...m, id: `milestone:${p.slug}:${m.order}` })),
}));

export const projectBySlug = new Map(projects.map((p) => [p.slug, p]));

export const careers = (careersRaw as CareerSeed[])
  .map((c) => ({ ...c, id: `career:${c.slug}` }))
  .sort((a, b) => a.rank - b.rank);

export const careerBySlug = new Map(careers.map((c) => [c.slug, c]));
export const careerById = new Map(careers.map((c) => [c.id, c]));

export const courses = [
  ...(coursesPart1 as CourseSeed[]),
  ...(coursesPart2 as CourseSeed[]),
  ...(coursesPart3 as CourseSeed[]),
]
  .map((c) => ({ ...c, id: `course:${c.slug}` }))
  .sort((a, b) => a.order - b.order);

export const courseBySlug = new Map(courses.map((c) => [c.slug, c]));

/** Flattened lessons in curriculum order, carrying their course and module. */
export const lessons: DemoLesson[] = courses.flatMap((course) =>
  [...course.modules]
    .sort((a, b) => a.order - b.order)
    .flatMap((module) =>
      [...module.lessons]
        .sort((a, b) => a.order - b.order)
        .map((lesson) => ({
          ...lesson,
          id: `lesson:${lesson.slug}`,
          courseSlug: course.slug,
          courseTitle: course.title,
          courseId: course.id,
          moduleTitle: module.title,
          moduleOrder: module.order,
          videoId: `video:${lesson.slug}`,
          quizId: `quiz:${lesson.slug}`,
        })),
    ),
);

export const lessonBySlug = new Map(lessons.map((l) => [l.slug, l]));
export const lessonById = new Map(lessons.map((l) => [l.id, l]));

export const practiceQuestions = (practiceQuestionsRaw as PracticeSeed[]).map((q, index) => ({
  ...q,
  // Index-based because prompts are long and not URL-safe; order in the file is
  // stable, so stored attempts survive a rebuild.
  id: `practice-${index}`,
  modeLabel: q.mode,
}));

export const practiceById = new Map(practiceQuestions.map((q) => [q.id, q]));

export const interviewQuestions = (interviewQuestionsRaw as InterviewSeed[]).map((q, index) => ({
  ...q,
  id: `interview-${index}`,
  categoryLabel: humanise(q.category),
  difficultyLabel: humanise(q.difficulty),
}));

export const interviewById = new Map(interviewQuestions.map((q) => [q.id, q]));

export const architectureChallenges = (architectureChallengesRaw as ArchitectureSeed[]).map((a) => ({
  ...a,
  id: `arch:${a.slug}`,
  difficultyLabel: humanise(a.difficulty),
}));

export const architectureById = new Map(architectureChallenges.map((a) => [a.id, a]));

export const codingExercises = (codingExercisesRaw as CodingSeed[]).map((e) => ({
  ...e,
  id: `coding:${e.slug}`,
  difficultyLabel: humanise(e.difficulty),
}));

export const codingBySlug = new Map(codingExercises.map((e) => [e.slug, e]));
export const codingById = new Map(codingExercises.map((e) => [e.id, e]));

export const badges = (badgesRaw as BadgeSeed[]).map((b) => ({ ...b, id: `badge:${b.code}` }));

export const primaryCareer = careers.find((c) => c.isPrimaryRecommended) ?? careers[0];

/** Course ordering rank, used for "next lesson" and phase timelines. */
export const courseOrder = new Map(courses.map((c) => [c.slug, c.order]));

export const TRACK_RANK: Record<string, number> = { FastTrack: 0, Balanced: 1, Deep: 2 };
