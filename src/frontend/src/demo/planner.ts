/**
 * Study planning for demo mode.
 *
 * Mirrors FutureTech.Application/Services/StudyPlanGenerator.cs — the same
 * weekly rhythm, the same content queues, the same deep links — so a visitor's
 * calendar looks like the one the API would build.
 */
import { addDays, isoDate, TRACK_FACTOR } from './rules';
import {
  architectureChallenges,
  codingExercises,
  courses,
  interviewQuestions,
  lessons,
  practiceQuestions,
  projects,
  TRACK_RANK,
} from './seed';
import type { DemoState } from './state';

type Activity =
  | 'Video'
  | 'Reading'
  | 'Practice'
  | 'Coding'
  | 'Quiz'
  | 'Architecture'
  | 'Project'
  | 'Interview'
  | 'Review'
  | 'Assessment';

const DAY_TEMPLATE: Record<number, [Activity, number][]> = {
  1: [['Video', 1], ['Reading', 1], ['Practice', 1]], // Monday
  2: [['Video', 1], ['Coding', 1.5], ['Quiz', 0.5]],
  3: [['Reading', 1], ['Architecture', 1]],
  4: [['Video', 1], ['Coding', 2]],
  5: [['Review', 1], ['Quiz', 1], ['Interview', 1]],
  6: [['Project', 1]], // Saturday
  0: [['Project', 2], ['Assessment', 1]], // Sunday
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Ref {
  id: string;
  title: string;
  slug: string;
}

const truncate = (value: string, max: number) =>
  value.length <= max ? value : `${value.slice(0, max - 1)}…`;

/** Cycles curriculum content into concrete, deep-linked plan items. */
class Queues {
  private cursors: Record<string, number> = {};
  private lastLesson: Ref | null = null;

  private readonly lessonQueue: Ref[];
  private readonly practiceQueue: Ref[];
  private readonly codingQueue: Ref[];
  private readonly archQueue: Ref[];
  private readonly interviewQueue: Ref[];
  private readonly projectQueue: Ref[];

  constructor(queues: {
    lessons: Ref[];
    practice: Ref[];
    coding: Ref[];
    architecture: Ref[];
    interview: Ref[];
    projects: Ref[];
  }) {
    this.lessonQueue = queues.lessons;
    this.practiceQueue = queues.practice;
    this.codingQueue = queues.coding;
    this.archQueue = queues.architecture;
    this.interviewQueue = queues.interview;
    this.projectQueue = queues.projects;
  }

  private take(name: string, source: Ref[]): Ref | null {
    if (source.length === 0) return null;
    const cursor = this.cursors[name] ?? 0;
    this.cursors[name] = cursor + 1;
    return source[cursor % source.length];
  }

  next(type: Activity, minutes: number, order: number) {
    let item: Ref | null;
    let refType: string;
    let deepLink: string;
    let prefix: string;

    switch (type) {
      case 'Video':
      case 'Reading':
      case 'Review':
        item = this.take('lesson', this.lessonQueue);
        if (!item) return null;
        this.lastLesson = item;
        refType = 'lesson';
        deepLink = `/learn/${item.slug}`;
        prefix = type === 'Video' ? 'Watch' : type === 'Review' ? 'Review' : 'Read';
        break;
      case 'Quiz': {
        item = this.lastLesson ?? this.lessonQueue[0] ?? null;
        if (!item) return null;
        refType = 'quiz';
        deepLink = `/learn/${item.slug}?tab=quiz`;
        prefix = 'Quiz';
        break;
      }
      case 'Practice':
        item = this.take('practice', this.practiceQueue);
        if (!item) return null;
        refType = 'practice';
        deepLink = `/practice/${item.id}`;
        prefix = 'Practice';
        break;
      case 'Coding':
        item = this.take('coding', this.codingQueue);
        if (!item) return null;
        refType = 'coding';
        deepLink = `/coding-labs/${item.slug}`;
        prefix = 'Lab';
        break;
      case 'Architecture':
        item = this.take('architecture', this.archQueue);
        if (!item) return null;
        refType = 'architecture';
        deepLink = `/architecture-lab/${item.id}`;
        prefix = 'Architecture';
        break;
      case 'Interview':
        item = this.take('interview', this.interviewQueue);
        if (!item) return null;
        refType = 'interview';
        deepLink = `/interview-prep?question=${item.id}`;
        prefix = 'Interview';
        break;
      case 'Project':
        item = this.take('project', this.projectQueue);
        if (!item) return null;
        refType = 'project';
        deepLink = `/projects/${item.slug}`;
        prefix = 'Build';
        break;
      case 'Assessment':
        return {
          id: `item:${order}:${Math.random().toString(36).slice(2, 8)}`,
          order,
          activityType: type,
          title: 'Weekly assessment: readiness check',
          minutes,
          refType: 'assessment',
          refId: null,
          deepLink: '/job-readiness',
          status: 'Scheduled',
        };
      default:
        return null;
    }

    return {
      id: `item:${refType}:${item.id}:${order}:${Math.random().toString(36).slice(2, 8)}`,
      order,
      activityType: type,
      title: truncate(`${prefix}: ${item.title}`, 120),
      minutes,
      refType,
      refId: item.id,
      deepLink,
      status: 'Scheduled',
    };
  }
}

function buildQueues(state: DemoState): Queues {
  const careerSlug = state.study.targetCareerSlug;
  const trackRank = TRACK_RANK[state.study.trackMode] ?? 1;

  const courseSlugsForCareer = new Set(
    courses.filter((c) => !careerSlug || c.careerSlug === careerSlug).map((c) => c.slug),
  );

  const lessonQueue = lessons
    .filter((l) => courseSlugsForCareer.has(l.courseSlug))
    .filter((l) => (TRACK_RANK[l.minimumTrack] ?? 1) <= trackRank)
    .filter((l) => state.lessonProgress[l.id]?.status !== 'Completed')
    .map((l) => ({ id: l.id, title: l.title, slug: l.slug }));

  const attempted = new Set(state.practiceAttempts.map((a) => a.questionId));
  const practiceQueue = practiceQuestions
    .filter((q) => !careerSlug || q.careerSlug === careerSlug || q.careerSlug === null)
    .filter((q) => !attempted.has(q.id))
    .map((q) => ({ id: q.id, title: q.prompt, slug: q.id }));

  return new Queues({
    lessons: lessonQueue,
    practice: practiceQueue,
    coding: codingExercises.map((e) => ({ id: e.id, title: e.title, slug: e.slug })),
    architecture: architectureChallenges.map((a) => ({ id: a.id, title: a.title, slug: a.slug })),
    interview: interviewQuestions.map((q) => ({ id: q.id, title: q.question, slug: q.id })),
    projects: projects.map((p) => ({ id: p.id, title: p.title, slug: p.slug })),
  });
}

/** Rebuilds the plan window, preserving days already marked complete. */
export function generatePlan(state: DemoState, from: Date, weeks: number): void {
  const studyDays = new Set(state.study.studyDays);
  const until = addDays(from, weeks * 7 - 1);
  const fromIso = isoDate(from);
  const untilIso = isoDate(until);

  const kept = state.planDays.filter(
    (d) => d.onDate < fromIso || d.onDate > untilIso || d.status === 'Completed',
  );
  const keptDates = new Set(kept.map((d) => d.onDate));

  const queues = buildQueues(state);
  const created: DemoState['planDays'] = [];

  for (let date = new Date(from); date <= until; date = addDays(date, 1)) {
    const dayName = DAY_NAMES[date.getDay()];
    if (!studyDays.has(dayName)) continue;
    if (keptDates.has(isoDate(date))) continue;

    const hours =
      date.getDay() === 6
        ? state.study.saturdayHours
        : date.getDay() === 0
          ? state.study.sundayHours
          : state.study.weekdayHours;

    const targetMinutes = Math.round(hours * 60);
    if (targetMinutes < 15) continue;

    const template = DAY_TEMPLATE[date.getDay()];
    const totalWeight = template.reduce((sum, [, w]) => sum + w, 0);
    const items: DemoState['planDays'][number]['items'] = [];
    let allocated = 0;
    let order = 1;

    template.forEach(([type, weight], index) => {
      const minutes =
        index === template.length - 1
          ? targetMinutes - allocated
          : Math.max(15, Math.round((targetMinutes * weight) / totalWeight / 5) * 5);
      if (minutes < 10) return;
      allocated += minutes;

      const item = queues.next(type, minutes, order);
      if (!item) return;
      items.push(item);
      order++;
    });

    if (items.length === 0) continue;

    created.push({
      id: `day:${isoDate(date)}`,
      onDate: isoDate(date),
      status: 'Scheduled',
      targetMinutes,
      items,
    });
  }

  state.planDays = [...kept, ...created].sort((a, b) => a.onDate.localeCompare(b.onDate));
}

/** A day is Late when it is in the past with unfinished items. */
export function effectiveStatus(day: DemoState['planDays'][number], today: Date): string {
  if (day.status === 'Completed') return 'Completed';
  if (day.onDate < isoDate(today) && day.items.some((i) => i.status !== 'Completed')) return 'Late';
  return day.status;
}

export function planDayDto(day: DemoState['planDays'][number], today: Date) {
  return {
    id: day.id,
    onDate: day.onDate,
    dayOfWeek: DAY_NAMES[new Date(`${day.onDate}T00:00:00`).getDay()],
    status: effectiveStatus(day, today),
    targetMinutes: day.targetMinutes,
    completedMinutes: day.items
      .filter((i) => i.status === 'Completed')
      .reduce((sum, i) => sum + i.minutes, 0),
    items: [...day.items].sort((a, b) => a.order - b.order),
  };
}

/** Hours for the target career's courses under the selected track. */
export function courseHours(state: DemoState) {
  const careerSlug = state.study.targetCareerSlug;
  const factor = TRACK_FACTOR[state.study.trackMode] ?? 1;

  return courses
    .filter((c) => !careerSlug || c.careerSlug === careerSlug)
    .map((course) => {
      const courseLessons = lessons.filter((l) => l.courseSlug === course.slug);
      const completed = courseLessons.filter(
        (l) => state.lessonProgress[l.id]?.status === 'Completed',
      ).length;
      const hours = Math.round(course.estimatedHours * factor);
      const share = courseLessons.length === 0 ? 0 : completed / courseLessons.length;

      return {
        course,
        hours,
        completedHours: Math.round(hours * share),
        lessonCount: courseLessons.length,
        completedLessons: completed,
        progressPercent:
          courseLessons.length === 0 ? 0 : Math.round((completed / courseLessons.length) * 100),
      };
    });
}
