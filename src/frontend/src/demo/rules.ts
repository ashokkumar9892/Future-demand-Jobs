/**
 * The calculations the demo has to reproduce because there is no API to ask.
 *
 * Each block mirrors a specific server file and says so. If you change the rule
 * on the server, change it here too — this is the one place in the project
 * where the same logic exists twice, and it is deliberately small and isolated
 * for that reason.
 *
 *   StudyMath          -> FutureTech.Application/Common/StudyMath.cs
 *   scoreDimension     -> FutureTech.Application/Services/ReadinessService.cs
 *   evaluateAnswer     -> FutureTech.Infrastructure/Evaluation/RubricAnswerEvaluator.cs
 *   XP / level titles  -> FutureTech.Application/Common/Constants.cs
 */

// ---------- StudyMath ----------

export const TRACK_FACTOR: Record<string, number> = {
  FastTrack: 0.58,
  Balanced: 1.0,
  Deep: 1.4,
};

export const hoursForTrack = (balancedHours: number, mode: string) =>
  Math.round(balancedHours * (TRACK_FACTOR[mode] ?? 1));

export const weeksFor = (hoursRemaining: number, weeklyHours: number) =>
  weeklyHours <= 0 ? 0 : Math.max(1, Math.ceil(hoursRemaining / weeklyHours));

export const monthsFor = (weeks: number) => Math.round((weeks / 4.345) * 10) / 10;

export const dailyHours = (weeklyHours: number, studyDaysPerWeek: number) =>
  studyDaysPerWeek <= 0 ? 0 : Math.round((weeklyHours / studyDaysPerWeek) * 100) / 100;

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const isoDate = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const dateLabel = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const monthLabel = (date: Date) =>
  date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

export const DISCLAIMER_ESTIMATE =
  'These are learning-time estimates based on your stated study hours. They are not guarantees ' +
  'of employment, salary, or hiring outcomes.';

export const DISCLAIMER_READINESS =
  'Readiness reflects measured learning progress and assessment performance on this platform. ' +
  'It is not a professional qualification and does not certify job competence.';

export const DISCLAIMER_EVIDENCE =
  'Every line is tagged with its evidence type. Training and personal projects are never ' +
  'presented as professional experience.';

export const DISCLAIMER_EVALUATOR =
  'Rubric-based automated review (keyword coverage, structure and depth). Not a human or ' +
  'model-graded assessment.';

export const DISCLAIMER_STATIC_CODE =
  'Static rubric check against required constructs. Code is not executed in this build.';

export function trainingEstimate(
  totalHours: number,
  weeklyHours: number,
  studyDaysPerWeek: number,
  from: Date,
  mode: string,
) {
  const weeks = weeksFor(totalHours, weeklyHours);
  const end = addDays(from, weeks * 7);
  return {
    totalHours,
    weeklyHours: Math.round(weeklyHours * 100) / 100,
    weeks,
    months: monthsFor(weeks),
    estimatedCompletionDate: dateLabel(end),
    estimatedCompletionMonth: monthLabel(end),
    dailyHoursRequired: dailyHours(weeklyHours, studyDaysPerWeek),
    trackMode: mode,
    disclaimer: DISCLAIMER_ESTIMATE,
  };
}

export const paceScenarios = (totalHours: number) =>
  [5, 10, 12, 15, 20, 25].map((h) => {
    const weeks = weeksFor(totalHours, h);
    return { weeklyHours: h, weeks, months: monthsFor(weeks), label: `${h} hrs/week` };
  });

// ---------- ReadinessService ----------

const LESSON_WEIGHT = 0.45;
const ASSESSMENT_WEIGHT = 0.35;
const PROJECT_WEIGHT = 0.2;

export interface ReadinessSignals {
  lessons: { slugs: Set<string>; completed: boolean; quizScore: number | null }[];
  practice: { tags: Set<string>; score: number }[];
  projects: { slugs: Set<string>; percentComplete: number }[];
}

const overlaps = (a: Set<string>, b: Set<string>) => {
  for (const value of a) if (b.has(value)) return true;
  return false;
};

/**
 * Only measured activity counts. Self-assessed skill levels are deliberately
 * excluded so the score cannot be inflated from the skill matrix.
 */
export function scoreDimension(skillSlugs: Set<string>, signals: ReadinessSignals): number {
  if (skillSlugs.size === 0) return 0;

  const lessons = signals.lessons.filter((l) => overlaps(l.slugs, skillSlugs));
  const lessonScore =
    lessons.length === 0 ? 0 : (lessons.filter((l) => l.completed).length * 100) / lessons.length;

  const quizScores = lessons
    .filter((l) => l.quizScore !== null)
    .map((l) => l.quizScore as number);
  const practiceScores = signals.practice.filter((p) => overlaps(p.tags, skillSlugs)).map((p) => p.score);
  const assessments = [...quizScores, ...practiceScores];
  const assessmentScore =
    assessments.length === 0 ? 0 : assessments.reduce((a, b) => a + b, 0) / assessments.length;

  const projects = signals.projects.filter((p) => overlaps(p.slugs, skillSlugs));
  const projectScore =
    projects.length === 0
      ? 0
      : projects.reduce((a, b) => a + b.percentComplete, 0) / projects.length;

  // Re-weight around the components that actually have data, so a dimension
  // with no projects yet is not permanently capped.
  let weighted = 0;
  let weight = 0;
  if (lessons.length > 0) {
    weighted += lessonScore * LESSON_WEIGHT;
    weight += LESSON_WEIGHT;
  }
  if (assessments.length > 0) {
    weighted += assessmentScore * ASSESSMENT_WEIGHT;
    weight += ASSESSMENT_WEIGHT;
  }
  if (projects.length > 0) {
    weighted += projectScore * PROJECT_WEIGHT;
    weight += PROJECT_WEIGHT;
  }

  return weight <= 0 ? 0 : Math.round(weighted / weight);
}

export const verdictFor = (overall: number) =>
  overall >= 80 ? 'Ready' : overall >= 60 ? 'AlmostReady' : 'NeedsTraining';

export const verdictLabel = (verdict: string) => humaniseUpper(verdict);

const humaniseUpper = (value: string) =>
  value.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();

// ---------- RubricAnswerEvaluator ----------

export interface RubricSpec {
  dimension: string;
  weight: number;
  keywords?: string[];
  guidance?: string;
}

const FALLBACK_RUBRIC: RubricSpec[] = [
  { dimension: 'Architecture', weight: 0.25, keywords: ['component', 'layer', 'service', 'flow', 'integration'], guidance: 'Describe the components and how data moves between them.' },
  { dimension: 'Security', weight: 0.2, keywords: ['authentication', 'authorization', 'identity', 'secret', 'encryption', 'pii'], guidance: "Name the concrete controls, not just the word 'secure'." },
  { dimension: 'Scalability', weight: 0.15, keywords: ['scale', 'load', 'throughput', 'queue', 'cache', 'partition'], guidance: 'State the expected load and how the design absorbs it.' },
  { dimension: 'Cost', weight: 0.15, keywords: ['cost', 'pricing', 'token', 'budget', 'tier'], guidance: 'Estimate the cost drivers and how you keep them down.' },
  { dimension: 'Reliability', weight: 0.15, keywords: ['availability', 'retry', 'failover', 'monitor', 'sla', 'backup'], guidance: 'Cover failure modes, retries and observability.' },
  { dimension: 'AI Design', weight: 0.1, keywords: ['model', 'prompt', 'embedding', 'rag', 'grounding', 'evaluation'], guidance: 'Explain model choice, grounding and how you evaluate quality.' },
];

const depthFactor = (words: number) =>
  words < 25 ? 0.45 : words < 60 ? 0.75 : words < 120 ? 0.95 : 1.0;

const presentationScore = (words: number, structured: boolean) => {
  const length = words < 25 ? 0 : words < 60 ? 0.35 : words < 120 ? 0.65 : words < 400 ? 1.0 : 0.85;
  return Math.min(1, length + (structured ? 0.15 : 0));
};

const hasStructure = (text: string) =>
  text.includes('\n') ||
  text.includes('1.') ||
  text.includes('- ') ||
  /first/i.test(text) ||
  /trade-off/i.test(text);

export interface AnswerEvaluation {
  score: number;
  dimensions: { dimension: string; score: number; weight: number; comment: string }[];
  strengths: string[];
  weaknesses: string[];
  method: string;
}

export function evaluateAnswer(answer: string, rubric: RubricSpec[] | undefined): AnswerEvaluation {
  const text = (answer ?? '').trim();
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean).length;

  const specs = rubric && rubric.length > 0 ? rubric : FALLBACK_RUBRIC;
  const presentation = presentationScore(words, hasStructure(text));

  const dimensions: AnswerEvaluation['dimensions'] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  for (const spec of specs) {
    const keywords =
      spec.keywords && spec.keywords.length > 0 ? spec.keywords : [spec.dimension.toLowerCase()];
    const hits = keywords.filter((k) => lower.includes(k.toLowerCase()));

    // Full marks for covering half the listed concepts: a rubric lists what a
    // good answer could mention, and most good answers say it differently.
    const expected = Math.max(1, Math.ceil(keywords.length * 0.5));
    const coverage = Math.min(1, hits.length / expected);

    const score = Math.round(
      Math.max(0, Math.min(100, (coverage * 0.75 + presentation * 0.25) * 100 * depthFactor(words))),
    );

    const missing = keywords.filter((k) => !hits.includes(k)).slice(0, 4);
    const comment =
      score >= 75
        ? `Covered: ${hits.slice(0, 4).join(', ')}.`
        : missing.length > 0
          ? `Not addressed: ${missing.join(', ')}.`
          : 'Mentioned the area but without enough specifics.';

    dimensions.push({ dimension: spec.dimension, score, weight: spec.weight, comment });
    if (score >= 75) strengths.push(`${spec.dimension}: ${comment}`);
    else weaknesses.push(`${spec.dimension}: ${comment} ${spec.guidance ?? ''}`.trim());
  }

  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  let overall =
    totalWeight <= 0
      ? Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)
      : Math.round(dimensions.reduce((sum, d) => sum + d.score * d.weight, 0) / totalWeight);

  if (words < 25) {
    weaknesses.unshift(
      'The answer is too short to demonstrate architectural reasoning. Aim for 150–400 words covering context, options, decision and trade-offs.',
    );
    overall = Math.min(overall, 45);
  } else if (hasStructure(text)) {
    strengths.push(
      'Structure: the answer is organised into distinct points, which reads well in an interview.',
    );
    overall = Math.min(100, overall + 3);
  }

  if (strengths.length === 0) {
    strengths.push('You produced a complete attempt — compare it with the model answer and resubmit.');
  }

  return {
    score: Math.max(0, Math.min(100, overall)),
    dimensions,
    strengths: strengths.slice(0, 6),
    weaknesses: weaknesses.slice(0, 6),
    method: DISCLAIMER_EVALUATOR,
  };
}

// ---------- XP and levels ----------

export const XP = {
  LessonCompleted: 50,
  QuizPassed: 40,
  PracticeAttempt: 30,
  ArchitectureAttempt: 60,
  CodingPassed: 70,
  InterviewAttempt: 35,
  MockInterviewCompleted: 150,
  ProjectMilestone: 80,
  ProjectCompleted: 400,
  CertificationPassed: 500,
  PerLevel: 1000,
};

export function levelTitle(level: number): string {
  if (level <= 1) return 'Practitioner';
  return (
    [
      'Senior Practitioner',
      'Cloud Builder',
      'AI Builder',
      'Integration Engineer',
      'Solutions Designer',
      'Solutions Architect',
      'Principal Architect',
    ][level - 2] ?? 'Distinguished Architect'
  );
}

/** Mirrors GamificationService.Streak: today or yesterday keeps a streak alive. */
export function streakFrom(dates: Set<string>, today: Date): number {
  let cursor = dates.has(isoDate(today)) ? new Date(today) : addDays(today, -1);
  if (!dates.has(isoDate(cursor))) return 0;
  let streak = 0;
  while (dates.has(isoDate(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(dates: Set<string>): number {
  const ordered = [...dates].sort();
  if (ordered.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < ordered.length; i++) {
    const previous = addDays(new Date(`${ordered[i - 1]}T00:00:00`), 1);
    run = isoDate(previous) === ordered[i] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}
