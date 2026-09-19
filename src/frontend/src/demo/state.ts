/**
 * The demo's persistence layer: everything DatabaseSeeder writes for the demo
 * learner, plus everything the user does afterwards, held in localStorage.
 *
 * Scoped per account so signing in as the admin does not inherit the learner's
 * progress, and versioned so a shape change resets cleanly rather than
 * throwing on stale data.
 */
import {
  addDays,
  isoDate,
  XP,
} from './rules';
import { badges, certifications, lessons, practiceQuestions, projects, skills, interviewQuestions, primaryCareer } from './seed';
// planner.ts imports DemoState as a type only, so this is not a runtime cycle.
import { generatePlan } from './planner';

const VERSION = 1;
const key = (email: string) => `futuretech.demo.v${VERSION}.${email}`;

export interface DemoAccount {
  email: string;
  password: string;
  displayName: string;
  role: 'Learner' | 'Admin';
  yearsExperience: number;
  seedProgress: boolean;
}

export const ACCOUNTS: DemoAccount[] = [
  {
    email: 'demo@futuretech.local',
    password: 'Demo#2026',
    displayName: 'Ashok',
    role: 'Learner',
    yearsExperience: 20,
    seedProgress: true,
  },
  {
    email: 'admin@futuretech.local',
    password: 'Admin#2026',
    displayName: 'Platform Admin',
    role: 'Admin',
    yearsExperience: 20,
    seedProgress: false,
  },
];

export interface LessonProgress {
  status: 'NotStarted' | 'InProgress' | 'Completed';
  videoWatched: boolean;
  minutesSpent: number;
  quizScorePercent: number | null;
  completedAt: string | null;
}

export interface PracticeAttempt {
  questionId: string;
  answerText: string;
  score: number;
  minutesSpent: number;
  at: string;
}

export interface DemoState {
  profile: {
    email: string;
    displayName: string;
    role: 'Learner' | 'Admin';
    yearsExperience: number;
    themePreference: string;
    onboardingCompleted: boolean;
  };
  study: {
    weekdayHours: number;
    saturdayHours: number;
    sundayHours: number;
    studyDays: string[];
    targetCompletionDate: string | null;
    targetCareerSlug: string | null;
    desiredSalaryUsd: number;
    currentSkillLevel: number;
    trackMode: string;
  };
  lessonProgress: Record<string, LessonProgress>;
  skillLevels: Record<string, number>;
  practiceAttempts: PracticeAttempt[];
  interviewAttempts: { questionId: string; answerText: string; score: number; at: string }[];
  architectureAttempts: { challengeId: string; score: number; selections: Record<string, string>; at: string }[];
  codingAttempts: { exerciseId: string; code: string; passed: boolean; score: number; at: string }[];
  projectProgress: Record<
    string,
    {
      status: 'NotStarted' | 'InProgress' | 'Completed';
      percentComplete: number;
      milestones: string[];
      repoUrl: string | null;
      demoUrl: string | null;
      notes: string;
      startedAt: string | null;
      completedAt: string | null;
    }
  >;
  certifications: Record<
    string,
    {
      status: string;
      targetDate: string | null;
      completedDate: string | null;
      scorePercent: number | null;
      prepHoursLogged: number;
    }
  >;
  notes: {
    id: string;
    scope: string;
    refId: string | null;
    refTitle: string;
    title: string;
    body: string;
    isImportant: boolean;
    isQuestion: boolean;
    codeSnippet: string | null;
    links: string;
    tags: string;
    createdAt: string;
    updatedAt: string | null;
  }[];
  bookmarks: {
    id: string;
    itemType: string;
    refId: string;
    title: string;
    subtitle: string;
    deepLink: string | null;
    createdAt: string;
  }[];
  studySessions: { date: string; minutes: number }[];
  xpEvents: { amount: number; reason: string }[];
  earnedBadges: string[];
  planDays: {
    id: string;
    onDate: string;
    status: string;
    targetMinutes: number;
    items: {
      id: string;
      order: number;
      activityType: string;
      title: string;
      minutes: number;
      refType: string;
      refId: string | null;
      deepLink: string | null;
      status: string;
    }[];
  }[];
  mockSessions: {
    id: string;
    careerTitle: string;
    completedAt: string | null;
    scores: Record<string, number>;
    recommendations: string[];
    turns: {
      id: string;
      order: number;
      questionId: string | null;
      question: string;
      isFollowUp: boolean;
      answerText: string;
      turnScore: number;
      feedback: string;
    }[];
  }[];
  /** Admin edits, applied over the seed content at read time. */
  contentOverrides: Record<string, Record<string, unknown>>;
  salaryRevisions: { careerSlug: string; min: number; max: number; source: string; at: string }[];
}

function emptyState(account: DemoAccount): DemoState {
  return {
    profile: {
      email: account.email,
      displayName: account.displayName,
      role: account.role,
      yearsExperience: account.yearsExperience,
      themePreference: 'dark',
      // Both demo accounts skip the wizard, matching DatabaseSeeder.
      onboardingCompleted: true,
    },
    study: {
      weekdayHours: 1.5,
      saturdayHours: 3,
      sundayHours: 3,
      studyDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      targetCompletionDate: null,
      targetCareerSlug: primaryCareer?.slug ?? null,
      desiredSalaryUsd: 200_000,
      currentSkillLevel: 70,
      trackMode: 'Balanced',
    },
    lessonProgress: {},
    skillLevels: Object.fromEntries(skills.map((s) => [s.slug, s.baselineLevel])),
    practiceAttempts: [],
    interviewAttempts: [],
    architectureAttempts: [],
    codingAttempts: [],
    projectProgress: {},
    certifications: {},
    notes: [],
    bookmarks: [],
    studySessions: [],
    xpEvents: [],
    earnedBadges: [],
    planDays: [],
    mockSessions: [],
    contentOverrides: {},
    salaryRevisions: [],
  };
}

/**
 * Mirrors DatabaseSeeder.SeedDemoProgressAsync: roughly fourteen weeks of
 * plausible activity so no screen is empty on a first visit.
 */
function seedProgress(state: DemoState): DemoState {
  const today = new Date();
  let seed = 20260919;
  // Deterministic pseudo-random, so every visitor sees the same demo figures.
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min));

  const completedCount = Math.round(lessons.length * 0.32);
  for (let i = 0; i < completedCount; i++) {
    const lesson = lessons[i];
    const when = addDays(today, -97 + Math.round((i * 97) / Math.max(1, completedCount)));
    state.lessonProgress[lesson.id] = {
      status: 'Completed',
      videoWatched: true,
      minutesSpent: lesson.estimatedMinutes,
      quizScorePercent: lesson.quiz ? between(70, 96) : null,
      completedAt: isoDate(when),
    };
    state.xpEvents.push({ amount: XP.LessonCompleted, reason: 'Lesson completed' });
  }
  if (completedCount < lessons.length) {
    state.lessonProgress[lessons[completedCount].id] = {
      status: 'InProgress',
      videoWatched: false,
      minutesSpent: 12,
      quizScorePercent: null,
      completedAt: null,
    };
  }

  for (let offset = 97; offset >= 0; offset--) {
    const date = addDays(today, -offset);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const studies = offset <= 13 || weekend || random() < 0.62;
    if (!studies) continue;
    state.studySessions.push({
      date: isoDate(date),
      minutes: weekend ? between(100, 190) : between(60, 110),
    });
  }

  const attemptCount = Math.min(practiceQuestions.length, 34);
  for (let i = 0; i < attemptCount; i++) {
    state.practiceAttempts.push({
      questionId: practiceQuestions[i].id,
      answerText: 'Demo answer recorded during onboarding of the platform.',
      score: between(52, 92),
      minutesSpent: practiceQuestions[i].estimatedMinutes,
      at: isoDate(addDays(today, -between(1, 80))),
    });
    state.xpEvents.push({ amount: XP.PracticeAttempt, reason: 'Practice attempt' });
  }

  for (const question of interviewQuestions.slice(0, 9)) {
    state.interviewAttempts.push({
      questionId: question.id,
      answerText: 'Demo answer recorded during onboarding of the platform.',
      score: between(58, 86),
      at: isoDate(addDays(today, -between(1, 60))),
    });
  }

  projects.slice(0, 4).forEach((project, index) => {
    const complete = index < 3;
    const milestones = complete
      ? project.milestones.map((m) => m.id)
      : project.milestones.slice(0, Math.max(1, Math.floor((project.milestones.length * 2) / 5))).map((m) => m.id);

    state.projectProgress[project.id] = {
      status: complete ? 'Completed' : 'InProgress',
      percentComplete: complete ? 100 : Math.round((milestones.length / project.milestones.length) * 100),
      milestones,
      repoUrl: complete ? `https://github.com/example/${project.slug}` : null,
      demoUrl: null,
      notes: complete
        ? 'Deployed to Azure Container Apps and documented.'
        : 'Vector index wired up; citations pending.',
      startedAt: isoDate(addDays(today, -70 + index * 12)),
      completedAt: complete ? isoDate(addDays(today, -55 + index * 12)) : null,
    };
    if (complete) state.xpEvents.push({ amount: XP.ProjectCompleted, reason: 'Project completed' });
  });

  for (const code of ['AZ-900', 'AI-102', 'AZ-305']) {
    const cert = certifications.find((c) => c.code === code);
    if (!cert) continue;
    const passed = code === 'AZ-900';
    state.certifications[cert.id] = {
      status: passed ? 'Passed' : 'Studying',
      targetDate: passed ? null : isoDate(addDays(today, code === 'AI-102' ? 60 : 140)),
      completedDate: passed ? isoDate(addDays(today, -40)) : null,
      scorePercent: passed ? 88 : null,
      prepHoursLogged: passed ? 22 : 6,
    };
  }

  lessons.slice(0, 3).forEach((lesson) => {
    state.notes.push({
      id: `note:${lesson.slug}`,
      scope: 'Lesson',
      refId: lesson.id,
      refTitle: lesson.title,
      title: `Key points — ${lesson.title}`,
      body: 'Revisit before the weekly assessment. Map each pattern back to a system I have actually shipped.',
      isImportant: true,
      isQuestion: false,
      codeSnippet: null,
      links: '',
      tags: 'review,architecture',
      createdAt: isoDate(addDays(today, -20)),
      updatedAt: null,
    });
    state.bookmarks.push({
      id: `bm:${lesson.slug}`,
      itemType: 'Lesson',
      refId: lesson.id,
      title: lesson.title,
      subtitle: 'Lesson',
      deepLink: `/learn/${lesson.slug}`,
      createdAt: isoDate(addDays(today, -20)),
    });
  });

  for (const code of ['first-lesson', 'ten-lessons', 'streak-7', 'practice-25', 'project-finisher']) {
    const badge = badges.find((b) => b.code === code);
    if (!badge) continue;
    state.earnedBadges.push(badge.id);
    state.xpEvents.push({ amount: badge.xpReward, reason: `Badge: ${badge.name}` });
  }

  // DatabaseSeeder builds the demo learner's plan too, so the dashboard has
  // something scheduled for today rather than an empty "generate a plan" panel.
  generatePlan(state, today, 12);

  return state;
}

const cache = new Map<string, DemoState>();

export function loadState(account: DemoAccount): DemoState {
  const cached = cache.get(account.email);
  if (cached) return cached;

  let state: DemoState | null = null;
  try {
    const raw = localStorage.getItem(key(account.email));
    if (raw) state = JSON.parse(raw) as DemoState;
  } catch {
    // Corrupt or unreadable storage: fall through to a fresh state rather than
    // leaving the visitor with a broken app.
    state = null;
  }

  if (!state) {
    state = emptyState(account);
    if (account.seedProgress) state = seedProgress(state);
  }

  cache.set(account.email, state);
  return state;
}

export function saveState(state: DemoState): void {
  cache.set(state.profile.email, state);
  try {
    localStorage.setItem(key(state.profile.email), JSON.stringify(state));
  } catch {
    // Private browsing or a full quota: the session still works in memory.
  }
}

export function resetState(email: string): void {
  cache.delete(email);
  try {
    localStorage.removeItem(key(email));
  } catch {
    /* nothing to clear */
  }
}
