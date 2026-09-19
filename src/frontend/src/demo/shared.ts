/**
 * Helpers shared by the demo route handlers: session resolution, the DTO
 * projections that appear in more than one response, and the small mutations
 * (XP, study minutes, plan tick-off) that several endpoints perform.
 */
import { addDays, isoDate, scoreDimension, verdictFor, verdictLabel, XP, DISCLAIMER_READINESS, type ReadinessSignals } from './rules';
import {
  careerBySlug,
  careers,
  courses,
  humanise,
  lessons,
  practiceById,
  practiceQuestions,
  projects,
  skillBySlug,
} from './seed';
import { ACCOUNTS, loadState, saveState, type DemoAccount, type DemoState } from './state';

export class DemoHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const TOKEN_PREFIX = 'demo-token:';
export const today = () => new Date();

export function accountFor(token: string | null): DemoAccount {
  const email = token?.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : null;
  const account = email ? ACCOUNTS.find((a) => a.email === email) : null;
  if (!account) throw new DemoHttpError(401, 'Not authenticated.');
  return account;
}

export const sessionFor = (token: string | null) => {
  const account = accountFor(token);
  return { account, state: loadState(account) };
};

export const csv = (value: string) =>
  value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

export const targetCareer = (state: DemoState) =>
  state.study.targetCareerSlug ? careerBySlug.get(state.study.targetCareerSlug) : undefined;

export const studyDaysCount = (state: DemoState) => Math.max(1, state.study.studyDays.length);

export function weeklyHours(state: DemoState): number {
  const weekdays = state.study.studyDays.filter((d) => d !== 'Saturday' && d !== 'Sunday').length;
  return (
    state.study.weekdayHours * weekdays +
    (state.study.studyDays.includes('Saturday') ? state.study.saturdayHours : 0) +
    (state.study.studyDays.includes('Sunday') ? state.study.sundayHours : 0)
  );
}

export const skillLevel = (state: DemoState, slug: string) =>
  state.skillLevels[slug] ?? skillBySlug.get(slug)?.baselineLevel ?? 0;

export function careerSummary(state: DemoState, career: (typeof careers)[number]) {
  let have = 0;
  let need = 0;
  for (const cs of career.skills) {
    if (skillLevel(state, cs.slug) >= cs.targetLevel) have++;
    else need++;
  }

  const override = state.contentOverrides[career.id] ?? {};

  return {
    id: career.id,
    rank: career.rank,
    title: career.title,
    slug: career.slug,
    summary: career.summary,
    salaryMinUsd: (override.salaryMinUsd as number) ?? career.salaryMinUsd,
    salaryMaxUsd: (override.salaryMaxUsd as number) ?? career.salaryMaxUsd,
    seniorSalaryMinUsd: (override.seniorSalaryMinUsd as number) ?? career.seniorSalaryMinUsd,
    seniorSalaryMaxUsd: (override.seniorSalaryMaxUsd as number) ?? career.seniorSalaryMaxUsd,
    twoHundredKPotential: career.twoHundredKPotential,
    demandOutlook: humanise(career.demandOutlook),
    demandNotes: career.demandNotes,
    aiReplacementRisk: humanise(career.aiReplacementRisk),
    aiRiskNotes: career.aiRiskNotes,
    difficulty: humanise(career.difficulty),
    estimatedHours: career.estimatedHours,
    estimatedWeeksAt12Hours: Math.max(1, Math.ceil(career.estimatedHours / 12)),
    isPrimaryRecommended: career.isPrimaryRecommended,
    skillsYouHave: have,
    skillsToLearn: need,
    salaryAsOf: career.salaryAsOf,
    salarySource: (override.salarySource as string) ?? career.salarySource,
  };
}

export const ladderDto = (career: (typeof careers)[number]) =>
  [...career.ladder].sort((a, b) => a.stageOrder - b.stageOrder);

export function skillGap(state: DemoState, career: (typeof careers)[number]) {
  return career.skills
    .map((cs) => {
      const skill = skillBySlug.get(cs.slug);
      const current = skillLevel(state, cs.slug);
      return {
        skillId: skill?.id ?? cs.slug,
        name: skill?.name ?? cs.slug,
        slug: cs.slug,
        category: skill ? humanise(skill.category) : '',
        importance: humanise(cs.importance),
        currentLevel: current,
        targetLevel: cs.targetLevel,
        gap: Math.max(0, cs.targetLevel - current),
      };
    })
    .sort((a, b) => a.importance.localeCompare(b.importance) || b.gap - a.gap);
}

export function lessonListItem(state: DemoState, lesson: (typeof lessons)[number]) {
  const progress = state.lessonProgress[lesson.id];
  return {
    id: lesson.id,
    order: lesson.order,
    title: lesson.title,
    slug: lesson.slug,
    type: humanise(lesson.type),
    estimatedMinutes: lesson.estimatedMinutes,
    status: progress?.status ?? 'NotStarted',
    videoWatched: progress?.videoWatched ?? false,
    quizScorePercent: progress?.quizScorePercent ?? undefined,
    hasVideo: !!lesson.video,
    hasQuiz: !!lesson.quiz,
    minimumTrack: lesson.minimumTrack,
  };
}

export function courseListItem(state: DemoState, course: (typeof courses)[number]) {
  const courseLessons = lessons.filter((l) => l.courseSlug === course.slug);
  const completed = courseLessons.filter(
    (l) => state.lessonProgress[l.id]?.status === 'Completed',
  ).length;

  return {
    id: course.id,
    phaseNumber: course.phaseNumber,
    order: course.order,
    title: course.title,
    slug: course.slug,
    summary: course.summary,
    estimatedHours: course.estimatedHours,
    level: humanise(course.level),
    minimumTrack: course.minimumTrack,
    careerTitle: careerBySlug.get(course.careerSlug)?.title ?? '',
    moduleCount: course.modules.length,
    lessonCount: courseLessons.length,
    completedLessons: completed,
    progressPercent:
      courseLessons.length === 0 ? 0 : Math.round((completed / courseLessons.length) * 100),
  };
}

export function practiceListItem(state: DemoState, question: (typeof practiceQuestions)[number]) {
  const attempts = state.practiceAttempts.filter((a) => a.questionId === question.id);
  return {
    id: question.id,
    category: question.category,
    mode: question.mode,
    prompt: question.prompt,
    tags: question.tags,
    estimatedMinutes: question.estimatedMinutes,
    bestScore: attempts.length ? Math.max(...attempts.map((a) => a.score)) : undefined,
    attemptCount: attempts.length,
  };
}

export function projectListItem(state: DemoState, project: (typeof projects)[number]) {
  const progress = state.projectProgress[project.id];
  return {
    id: project.id,
    order: project.order,
    title: project.title,
    slug: project.slug,
    summary: project.summary,
    techStack: project.techStack,
    difficulty: humanise(project.difficulty),
    estimatedHours: project.estimatedHours,
    status: progress?.status ?? 'NotStarted',
    percentComplete: progress?.percentComplete ?? 0,
  };
}

export const isBookmarked = (state: DemoState, itemType: string, refId: string) =>
  state.bookmarks.some((b) => b.itemType === itemType && b.refId === refId);

export function profileDto(state: DemoState) {
  const career = targetCareer(state);
  return {
    id: `user:${state.profile.email}`,
    email: state.profile.email,
    displayName: state.profile.displayName,
    role: state.profile.role,
    themePreference: state.profile.themePreference,
    yearsExperience: state.profile.yearsExperience,
    onboardingCompleted: state.profile.onboardingCompleted,
    targetCareerPathId: career?.id,
    targetCareerTitle: career?.title,
  };
}

export function studyProfileDto(state: DemoState) {
  const career = targetCareer(state);
  return {
    weekdayHours: state.study.weekdayHours,
    saturdayHours: state.study.saturdayHours,
    sundayHours: state.study.sundayHours,
    studyDays: state.study.studyDays,
    targetCompletionDate: state.study.targetCompletionDate ?? undefined,
    targetCareerPathId: career?.id,
    targetCareerTitle: career?.title,
    desiredSalaryUsd: state.study.desiredSalaryUsd,
    currentSkillLevel: state.study.currentSkillLevel,
    trackMode: state.study.trackMode,
    weeklyHours: Math.round(weeklyHours(state) * 100) / 100,
    onboardingCompleted: state.profile.onboardingCompleted,
  };
}

/** Records XP and study minutes for an activity, mirroring GamificationService. */
export function award(state: DemoState, amount: number, reason: string, minutes = 0) {
  if (amount > 0) state.xpEvents.push({ amount, reason });
  if (minutes > 0) {
    const date = isoDate(today());
    const existing = state.studySessions.find((s) => s.date === date);
    if (existing) existing.minutes += Math.round(minutes);
    else state.studySessions.push({ date, minutes: Math.round(minutes) });
  }
}

/** Ticks off the matching plan item so the calendar stays in step. */
export function completePlanItems(state: DemoState, refType: string, refId: string) {
  for (const day of state.planDays) {
    for (const item of day.items) {
      if (item.refType === refType && item.refId === refId && item.status !== 'Completed') {
        item.status = 'Completed';
      }
    }
    if (day.items.length > 0 && day.items.every((i) => i.status === 'Completed')) {
      day.status = 'Completed';
    }
  }
}

// ---------- readiness ----------

export function readinessSignals(state: DemoState): ReadinessSignals {
  const courseSkills = new Map(
    courses.map((c) => [c.slug, new Set(c.skillSlugs.map((s) => s.toLowerCase()))]),
  );

  const bestByQuestion = new Map<string, number>();
  for (const attempt of state.practiceAttempts) {
    bestByQuestion.set(
      attempt.questionId,
      Math.max(bestByQuestion.get(attempt.questionId) ?? 0, attempt.score),
    );
  }

  return {
    lessons: lessons.map((lesson) => {
      const progress = state.lessonProgress[lesson.id];
      return {
        slugs: courseSkills.get(lesson.courseSlug) ?? new Set<string>(),
        completed: progress?.status === 'Completed',
        quizScore: progress?.quizScorePercent ?? null,
      };
    }),
    practice: [...bestByQuestion.entries()].map(([questionId, score]) => ({
      tags: new Set(csv(practiceById.get(questionId)?.tags ?? '').map((t) => t.toLowerCase())),
      score,
    })),
    projects: projects.map((project) => ({
      slugs: new Set(project.skillSlugs.map((s) => s.toLowerCase())),
      percentComplete: state.projectProgress[project.id]?.percentComplete ?? 0,
    })),
  };
}

export function careerReadiness(
  state: DemoState,
  career: (typeof careers)[number],
  signals: ReadinessSignals = readinessSignals(state),
) {
  const dimensions = [...career.readinessDimensions]
    .sort((a, b) => b.weight - a.weight)
    .map((d) => ({
      name: d.name,
      score: scoreDimension(new Set(d.skillSlugs.map((s) => s.toLowerCase())), signals),
      weight: d.weight,
    }));

  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  const overall =
    totalWeight <= 0
      ? 0
      : Math.round(dimensions.reduce((sum, d) => sum + d.score * d.weight, 0) / totalWeight);

  const verdict = verdictFor(overall);
  return {
    careerPathId: career.id,
    careerTitle: career.title,
    careerSlug: career.slug,
    rank: career.rank,
    overall,
    verdict,
    verdictLabel: verdictLabel(verdict),
    dimensions,
    disclaimer: DISCLAIMER_READINESS,
  };
}

export { addDays, isoDate, XP, saveState, loadState };
export type { DemoState, DemoAccount };
