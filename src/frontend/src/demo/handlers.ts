/**
 * Demo route handlers for content and learning: the same paths the API
 * controllers expose, answered from bundled seed data plus localStorage.
 *
 * Response shapes mirror FutureTech.Application/Contracts. Reimplemented rules
 * live in rules.ts and planner.ts, not here.
 */
import {
  DISCLAIMER_ESTIMATE,
  addDays,
  evaluateAnswer,
  hoursForTrack,
  isoDate,
  monthLabel,
  monthsFor,
  paceScenarios,
  trainingEstimate,
  weeksFor,
  XP,
  type RubricSpec,
} from './rules';
import {
  architectureById,
  architectureChallenges,
  careerBySlug,
  careers,
  certifications,
  codingById,
  codingBySlug,
  codingExercises,
  courseBySlug,
  courses,
  humanise,
  interviewById,
  interviewQuestions,
  lessonById,
  lessonBySlug,
  lessons,
  practiceById,
  practiceQuestions,
  projectBySlug,
  TRACK_RANK,
} from './seed';
import { courseHours, effectiveStatus, generatePlan, planDayDto } from './planner';
import {
  award,
  careerSummary,
  completePlanItems,
  courseListItem,
  DemoHttpError,
  isBookmarked,
  ladderDto,
  lessonListItem,
  practiceListItem,
  profileDto,
  saveState,
  skillGap,
  studyDaysCount,
  studyProfileDto,
  targetCareer,
  today,
  weeklyHours,
  type DemoState,
} from './shared';
import { ACCOUNTS, loadState } from './state';
import { handlePlatform } from './handlers-platform';

const TOKEN_PREFIX = 'demo-token:';

export function handleLearning(
  method: string,
  segments: string[],
  route: string,
  query: URLSearchParams,
  body: Record<string, unknown> | undefined,
  state: DemoState,
): unknown {
  // ----- auth -----

  if (route === 'GET /auth/me') return profileDto(state);

  if (route === 'PUT /auth/theme') {
    state.profile.themePreference = body?.theme === 'light' ? 'light' : 'dark';
    saveState(state);
    return profileDto(state);
  }

  // ----- careers -----

  if (route === 'GET /careers') {
    const search = (query.get('search') ?? '').trim().toLowerCase();
    const sort = query.get('sort');
    let list = careers.filter(
      (c) =>
        !search || c.title.toLowerCase().includes(search) || c.summary.toLowerCase().includes(search),
    );
    if (sort === 'salary') list = [...list].sort((a, b) => b.salaryMaxUsd - a.salaryMaxUsd);
    else if (sort === 'hours') list = [...list].sort((a, b) => a.estimatedHours - b.estimatedHours);
    return list.map((c) => careerSummary(state, c));
  }

  if (method === 'GET' && segments[0] === 'careers' && segments.length === 2) {
    const career = careerBySlug.get(segments[1]);
    if (!career) throw new DemoHttpError(404, 'Career path was not found.');

    const gap = skillGap(state, career);
    const hours = hoursForTrack(career.estimatedHours, state.study.trackMode);

    return {
      summary: careerSummary(state, career),
      resumeKeywords: career.resumeKeywords,
      responsibilities: career.responsibilities,
      interviewFocus: career.interviewFocus,
      skillsYouHave: gap.filter((g) => g.gap <= 0).sort((a, b) => b.currentLevel - a.currentLevel),
      skillsToLearn: gap.filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap),
      ladder: ladderDto(career),
      certifications: career.certifications.flatMap((code, index) => {
        const cert = certifications.find((c) => c.code === code);
        return cert ? [{ ...cert, priority: index + 1 }] : [];
      }),
      projects: career.projects.flatMap((slug) => {
        const project = projectBySlug.get(slug);
        return project
          ? [
              {
                id: project.id,
                title: project.title,
                slug: project.slug,
                summary: project.summary,
                techStack: project.techStack,
                estimatedHours: project.estimatedHours,
              },
            ]
          : [];
      }),
      courses: courses
        .filter((c) => c.careerSlug === career.slug)
        .map((c) => {
          const item = courseListItem(state, c);
          return {
            id: c.id,
            phaseNumber: c.phaseNumber,
            title: c.title,
            slug: c.slug,
            summary: c.summary,
            estimatedHours: c.estimatedHours,
            level: humanise(c.level),
            lessonCount: item.lessonCount,
            completedLessons: item.completedLessons,
          };
        }),
      totalTrainingHours: hours,
      estimate: trainingEstimate(
        hours,
        weeklyHours(state),
        studyDaysCount(state),
        today(),
        state.study.trackMode,
      ),
    };
  }

  if (method === 'GET' && segments[0] === 'careers' && segments[2] === 'ladder') {
    const career = careerBySlug.get(segments[1]);
    if (!career) throw new DemoHttpError(404, 'Career ladder was not found.');
    return ladderDto(career);
  }

  if (method === 'GET' && segments[0] === 'careers' && segments[2] === 'skill-gap') {
    const career = careerBySlug.get(segments[1]);
    if (!career) throw new DemoHttpError(404, 'Career path was not found.');
    return skillGap(state, career);
  }

  // ----- roadmap -----

  if (route === 'GET /roadmap') {
    const career = targetCareer(state) ?? careers[0];
    const breakdown = courseHours(state);
    const totalHours = breakdown.reduce((sum, b) => sum + b.hours, 0);
    const completedHours = breakdown.reduce((sum, b) => sum + b.completedHours, 0);
    const remaining = Math.max(0, totalHours - completedHours);

    let cursor = today();
    const phases = breakdown.map((entry) => {
      const start = new Date(cursor);
      const remainingHours = entry.hours * (1 - entry.progressPercent / 100);
      const end =
        remainingHours <= 0
          ? cursor
          : addDays(cursor, weeksFor(remainingHours, weeklyHours(state)) * 7);
      cursor = end;

      return {
        phaseNumber: entry.course.phaseNumber,
        title: entry.course.title,
        slug: entry.course.slug,
        summary: entry.course.summary,
        estimatedHours: entry.hours,
        lessonCount: entry.lessonCount,
        completedLessons: entry.completedLessons,
        progressPercent: entry.progressPercent,
        status:
          entry.progressPercent === 100
            ? 'Completed'
            : entry.progressPercent > 0
              ? 'InProgress'
              : 'NotStarted',
        estimatedStartMonth: monthLabel(start),
        estimatedEndMonth: monthLabel(end),
      };
    });

    const summary = careerSummary(state, career);

    return {
      currentRole: '.NET / Angular / SQL Server / Azure & AWS Full Stack Developer',
      targetCareerTitle: career.title,
      targetCareerSlug: career.slug,
      targetSalaryRange: `$${Math.round(summary.salaryMinUsd / 1000)}K–$${Math.round(summary.salaryMaxUsd / 1000)}K+`,
      ladder: ladderDto(career),
      phases,
      estimate: trainingEstimate(
        remaining === 0 ? totalHours : remaining,
        weeklyHours(state),
        studyDaysCount(state),
        today(),
        state.study.trackMode,
      ),
      overallProgressPercent: totalHours === 0 ? 0 : Math.round((completedHours * 100) / totalHours),
      disclaimer: DISCLAIMER_ESTIMATE,
    };
  }

  // ----- courses and lessons -----

  if (route === 'GET /courses') {
    const track = query.get('track');
    const search = (query.get('search') ?? '').trim().toLowerCase();
    return courses
      .filter((c) => !track || (TRACK_RANK[c.minimumTrack] ?? 1) <= (TRACK_RANK[track] ?? 1))
      .filter(
        (c) =>
          !search ||
          c.title.toLowerCase().includes(search) ||
          c.summary.toLowerCase().includes(search),
      )
      .map((c) => courseListItem(state, c));
  }

  if (method === 'GET' && segments[0] === 'courses' && segments.length === 2) {
    const course = courseBySlug.get(segments[1]);
    if (!course) throw new DemoHttpError(404, 'Course was not found.');

    return {
      course: courseListItem(state, course),
      outcomes: course.outcomes,
      modules: [...course.modules]
        .sort((a, b) => a.order - b.order)
        .map((module) => {
          const moduleLessons = lessons.filter(
            (l) => l.courseSlug === course.slug && l.moduleTitle === module.title,
          );
          const items = moduleLessons.map((l) => lessonListItem(state, l));
          const done = items.filter((i) => i.status === 'Completed').length;
          return {
            id: `module:${course.slug}:${module.order}`,
            order: module.order,
            title: module.title,
            summary: module.summary,
            estimatedHours: module.estimatedHours,
            lessons: items,
            progressPercent: items.length === 0 ? 0 : Math.round((done * 100) / items.length),
          };
        }),
    };
  }

  if (method === 'GET' && segments[0] === 'lessons' && segments.length === 2) {
    return lessonDetail(state, segments[1]);
  }

  if (method === 'POST' && segments[0] === 'lessons' && segments[2] === 'progress') {
    const lesson = lessonById.get(segments[1]);
    if (!lesson) throw new DemoHttpError(404, 'Lesson was not found.');

    const previous = state.lessonProgress[lesson.id];
    const status = String(body?.status ?? 'InProgress') as 'InProgress' | 'Completed';
    const minutes = Math.max(0, Number(body?.minutesSpent ?? 0));

    state.lessonProgress[lesson.id] = {
      status,
      videoWatched: (previous?.videoWatched ?? false) || Boolean(body?.videoWatched),
      minutesSpent: (previous?.minutesSpent ?? 0) + minutes,
      quizScorePercent: previous?.quizScorePercent ?? null,
      completedAt:
        status === 'Completed' ? (previous?.completedAt ?? isoDate(today())) : (previous?.completedAt ?? null),
    };

    if (status === 'Completed' && previous?.status !== 'Completed') {
      award(state, XP.LessonCompleted, `Lesson: ${lesson.title}`, minutes);
      completePlanItems(state, 'lesson', lesson.id);
    }
    saveState(state);
    return lessonDetail(state, lesson.slug);
  }

  if (method === 'POST' && segments[0] === 'lessons' && segments[2] === 'quiz') {
    const lesson = lessonById.get(segments[1]);
    if (!lesson?.quiz) throw new DemoHttpError(404, 'Quiz was not found.');

    const answers = (body?.answers ?? []) as { questionId: string; selectedOptionIds: string[] }[];
    let correctCount = 0;

    const results = lesson.quiz.questions.map((question, qi) => {
      const correctIds = question.options
        .flatMap((o, oi) => (o.isCorrect ? [`o:${lesson.slug}:${qi}:${oi}`] : []))
        .sort();
      const selected = [
        ...(answers.find((a) => a.questionId === `q:${lesson.slug}:${qi}`)?.selectedOptionIds ?? []),
      ].sort();
      const correct =
        correctIds.length === selected.length && correctIds.every((id, i) => id === selected[i]);
      if (correct) correctCount++;
      return {
        questionId: `q:${lesson.slug}:${qi}`,
        correct,
        correctOptionIds: correctIds,
        explanation: question.explanation,
      };
    });

    const score = Math.round((correctCount * 100) / lesson.quiz.questions.length);
    const passed = score >= lesson.quiz.passMarkPercent;
    const existing = state.lessonProgress[lesson.id];

    state.lessonProgress[lesson.id] = {
      status: existing?.status ?? 'InProgress',
      videoWatched: existing?.videoWatched ?? false,
      minutesSpent: existing?.minutesSpent ?? 0,
      // Keep the best attempt; a retry must never lower a score.
      quizScorePercent: Math.max(existing?.quizScorePercent ?? 0, score),
      completedAt: existing?.completedAt ?? null,
    };

    award(state, passed ? XP.QuizPassed : 0, 'Quiz completed', 10);
    if (passed) completePlanItems(state, 'quiz', lesson.id);
    saveState(state);

    return { scorePercent: score, passed, xpAwarded: passed ? XP.QuizPassed : 0, results };
  }

  // ----- videos -----

  if (route === 'GET /videos') {
    const search = (query.get('search') ?? '').trim().toLowerCase();
    const onlyLinked = query.get('onlyLinked') === 'true';
    return lessons
      .filter((l) => l.video)
      .map((l) => videoDto(state, l))
      .filter((v) => !onlyLinked || !!v.youTubeUrl)
      .filter(
        (v) =>
          !search ||
          v.title.toLowerCase().includes(search) ||
          (v.lessonTitle ?? '').toLowerCase().includes(search),
      );
  }

  // ----- study planning -----

  if (route === 'GET /study/profile') return studyProfileDto(state);

  if (route === 'PUT /study/profile') {
    const s = state.study;
    const clamp = (hours: number) => Math.max(0, Math.min(16, Math.round(hours * 100) / 100));

    s.weekdayHours = clamp(Number(body?.weekdayHours ?? s.weekdayHours));
    s.saturdayHours = clamp(Number(body?.saturdayHours ?? s.saturdayHours));
    s.sundayHours = clamp(Number(body?.sundayHours ?? s.sundayHours));
    const days = body?.studyDays as string[] | undefined;
    if (days && days.length > 0) s.studyDays = days;
    s.targetCompletionDate = (body?.targetCompletionDate as string | null) ?? null;
    s.desiredSalaryUsd = Number(body?.desiredSalaryUsd ?? s.desiredSalaryUsd) || s.desiredSalaryUsd;
    s.currentSkillLevel = Math.max(
      0,
      Math.min(100, Number(body?.currentSkillLevel ?? s.currentSkillLevel)),
    );
    s.trackMode = String(body?.trackMode ?? s.trackMode);

    const careerId = body?.targetCareerPathId as string | undefined;
    if (careerId) {
      const career = careers.find((c) => c.id === careerId);
      if (career) s.targetCareerSlug = career.slug;
    }
    if (body?.completeOnboarding) state.profile.onboardingCompleted = true;

    // Capacity or target changed: the schedule ahead is now stale.
    generatePlan(state, today(), 26);
    saveState(state);
    return studyProfileDto(state);
  }

  if (route === 'POST /study/calculate') {
    const requested = Number(body?.weeklyHours ?? 0);
    const hours = requested > 0 ? requested : weeklyHours(state);
    const mode = String(body?.trackMode ?? state.study.trackMode);
    const careerId = body?.careerPathId as string | undefined;
    const career =
      (careerId ? careers.find((c) => c.id === careerId) : undefined) ??
      targetCareer(state) ??
      careers[0];

    const breakdown = courses
      .filter((c) => c.careerSlug === career.slug)
      .map((course) => {
        const courseLessons = lessons.filter((l) => l.courseSlug === course.slug);
        const completed = courseLessons.filter(
          (l) => state.lessonProgress[l.id]?.status === 'Completed',
        ).length;
        const areaHours = hoursForTrack(course.estimatedHours, mode);
        const share = courseLessons.length === 0 ? 0 : completed / courseLessons.length;
        return { area: course.title, hours: areaHours, completedHours: Math.round(areaHours * share) };
      });

    const totalHours =
      breakdown.reduce((sum, b) => sum + b.hours, 0) || hoursForTrack(career.estimatedHours, mode);
    const completedHours = breakdown.reduce((sum, b) => sum + b.completedHours, 0);
    const remaining = Math.max(0, totalHours - completedHours);
    const weeks = weeksFor(remaining, hours);
    const end = addDays(today(), weeks * 7);

    return {
      careerTitle: career.title,
      trackMode: mode,
      totalCourseHours: totalHours,
      hoursCompleted: completedHours,
      hoursRemaining: remaining,
      weeklyHours: Math.round(hours * 100) / 100,
      dailyHoursRequired: Math.round((hours / studyDaysCount(state)) * 100) / 100,
      weeksRemaining: weeks,
      daysRemaining: weeks * 7,
      monthsRemaining: monthsFor(weeks),
      estimatedCompletionDate: end.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      estimatedCompletionMonth: monthLabel(end),
      breakdown,
      paceScenarios: paceScenarios(remaining === 0 ? totalHours : remaining),
      disclaimer: DISCLAIMER_ESTIMATE,
    };
  }

  if (route === 'GET /study/plan') {
    ensurePlan(state);
    const from = query.get('from') ?? isoDate(today());
    const to = query.get('to') ?? isoDate(addDays(today(), 13));
    return state.planDays
      .filter((d) => d.onDate >= from && d.onDate <= to)
      .map((d) => planDayDto(d, today()));
  }

  if (route === 'POST /study/plan/generate') {
    const weeks = Math.max(1, Math.min(52, Number(body?.weeks ?? 12)));
    const from = body?.fromDate ? new Date(String(body.fromDate)) : today();
    generatePlan(state, from, weeks);
    saveState(state);
    return state.planDays.map((d) => planDayDto(d, today()));
  }

  if (
    method === 'POST' &&
    segments[1] === 'plan' &&
    segments[2] === 'items' &&
    segments[4] === 'complete'
  ) {
    for (const day of state.planDays) {
      const item = day.items.find((i) => i.id === segments[3]);
      if (!item) continue;
      if (item.status !== 'Completed') {
        item.status = 'Completed';
        award(state, 10, `Plan item: ${item.title}`, item.minutes);
      }
      day.status = day.items.every((i) => i.status === 'Completed') ? 'Completed' : 'InProgress';
      saveState(state);
      return item;
    }
    throw new DemoHttpError(404, 'Plan item was not found.');
  }

  if (route === 'GET /study/today') {
    ensurePlan(state);
    const day = state.planDays.find((d) => d.onDate === isoDate(today()));
    return day ? planDayDto(day, today()) : null;
  }

  if (route === 'POST /study/start-today') {
    ensurePlan(state);
    const day = state.planDays.find((d) => d.onDate === isoDate(today()));

    if (!day) {
      return {
        message: 'Today is a scheduled rest day. Open Calendar to pull work forward.',
      };
    }

    const next = [...day.items]
      .sort((a, b) => a.order - b.order)
      .find((i) => i.status !== 'Completed');

    if (!next) {
      return {
        today: planDayDto(day, today()),
        message: "Today's plan is complete. Well done — the streak is safe.",
      };
    }

    next.status = 'InProgress';
    day.status = 'InProgress';
    saveState(state);
    return {
      nextItem: next,
      deepLink: next.deepLink,
      today: planDayDto(day, today()),
      message: `Starting: ${next.title}`,
    };
  }

  if (method === 'GET' && segments[1] === 'calendar' && segments.length === 4) {
    return calendarMonth(state, Number(segments[2]), Number(segments[3]));
  }

  // ----- practice -----

  if (route === 'GET /practice') {
    const mode = query.get('mode');
    const category = query.get('category');
    const search = (query.get('search') ?? '').trim().toLowerCase();
    return practiceQuestions
      .filter((q) => !mode || q.mode === mode)
      .filter((q) => !category || q.category === category)
      .filter(
        (q) =>
          !search ||
          q.prompt.toLowerCase().includes(search) ||
          q.tags.toLowerCase().includes(search),
      )
      .map((q) => practiceListItem(state, q));
  }

  if (route === 'GET /practice/categories') {
    return [...new Set(practiceQuestions.map((q) => q.category))].sort();
  }

  if (method === 'GET' && segments[0] === 'practice' && segments.length === 2) {
    const question = practiceById.get(segments[1]);
    if (!question) throw new DemoHttpError(404, 'Practice question was not found.');
    const attempts = state.practiceAttempts.filter((a) => a.questionId === question.id);

    return {
      id: question.id,
      category: question.category,
      mode: question.mode,
      prompt: question.prompt,
      scenario: question.scenario,
      tags: question.tags,
      estimatedMinutes: question.estimatedMinutes,
      rubric: question.rubric.map((r) => ({
        dimension: r.dimension,
        weight: r.weight,
        guidance: r.guidance ?? '',
      })),
      bestScore: attempts.length ? Math.max(...attempts.map((a) => a.score)) : undefined,
      lastAnswer: attempts[attempts.length - 1]?.answerText,
      isBookmarked: isBookmarked(state, 'PracticeQuestion', question.id),
    };
  }

  if (method === 'POST' && segments[0] === 'practice' && segments[2] === 'attempt') {
    const question = practiceById.get(segments[1]);
    if (!question) throw new DemoHttpError(404, 'Practice question was not found.');
    const answerText = String(body?.answerText ?? '');
    if (answerText.trim().length === 0) {
      throw new DemoHttpError(400, 'Write an answer before submitting.');
    }

    const evaluation = evaluateAnswer(answerText, question.rubric as RubricSpec[]);
    state.practiceAttempts.push({
      questionId: question.id,
      answerText,
      score: evaluation.score,
      minutesSpent: Number(body?.minutesSpent ?? 0),
      at: isoDate(today()),
    });
    award(state, XP.PracticeAttempt, `Practice: ${question.category}`, question.estimatedMinutes / 2);
    completePlanItems(state, 'practice', question.id);
    saveState(state);

    return {
      score: evaluation.score,
      dimensions: evaluation.dimensions,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      modelAnswer: question.modelAnswer,
      evaluationMethod: evaluation.method,
      xpAwarded: XP.PracticeAttempt,
    };
  }

  // ----- architecture lab -----

  if (route === 'GET /architecture-challenges') {
    return architectureChallenges.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      scenario: a.scenario,
      difficulty: humanise(a.difficulty),
      estimatedMinutes: a.estimatedMinutes,
      bestScore: bestScore(state.architectureAttempts, 'challengeId', a.id),
    }));
  }

  if (method === 'GET' && segments[0] === 'architecture-challenges' && segments.length === 2) {
    const challenge = architectureById.get(segments[1]);
    if (!challenge) throw new DemoHttpError(404, 'Architecture challenge was not found.');
    return {
      id: challenge.id,
      title: challenge.title,
      slug: challenge.slug,
      scenario: challenge.scenario,
      difficulty: humanise(challenge.difficulty),
      estimatedMinutes: challenge.estimatedMinutes,
      requirements: challenge.requirements,
      choiceGroups: challenge.choiceGroups,
      diagramMermaid: challenge.diagramMermaid,
      bestScore: bestScore(state.architectureAttempts, 'challengeId', challenge.id),
    };
  }

  if (method === 'POST' && segments[0] === 'architecture-challenges' && segments[2] === 'attempt') {
    const challenge = architectureById.get(segments[1]);
    if (!challenge) throw new DemoHttpError(404, 'Architecture challenge was not found.');

    const selections = (body?.selections ?? {}) as Record<string, string>;
    let earned = 0;

    const groups = challenge.choiceGroups.map((group) => {
      const choice = selections[group.key] ?? '';
      const answer = challenge.suggested.find((s) => s.key === group.key);
      const matched = !!answer && choice.toLowerCase() === answer.answer.toLowerCase();
      // A defensible alternative earns most of the credit.
      const acceptable =
        !matched && !!answer?.acceptable?.some((a) => a.toLowerCase() === choice.toLowerCase());
      earned += matched ? 1 : acceptable ? 0.7 : 0;

      return {
        key: group.key,
        label: group.label,
        yourChoice: choice,
        suggestedChoice: answer?.answer ?? '—',
        matched,
        acceptable,
        rationale: answer?.rationale ?? '',
      };
    });

    const score =
      challenge.choiceGroups.length === 0
        ? 0
        : Math.round((earned * 100) / challenge.choiceGroups.length);

    state.architectureAttempts.push({
      challengeId: challenge.id,
      score,
      selections,
      at: isoDate(today()),
    });
    award(
      state,
      XP.ArchitectureAttempt,
      `Architecture: ${challenge.title}`,
      challenge.estimatedMinutes,
    );
    completePlanItems(state, 'architecture', challenge.id);
    saveState(state);

    return {
      score,
      groups,
      rationale: challenge.rationale,
      diagramMermaid: challenge.diagramMermaid,
      xpAwarded: XP.ArchitectureAttempt,
    };
  }

  // ----- coding labs -----

  if (route === 'GET /coding-exercises') {
    const category = query.get('category');
    const difficulty = query.get('difficulty');
    const search = (query.get('search') ?? '').trim().toLowerCase();

    return codingExercises
      .filter((e) => !category || e.category === category)
      .filter((e) => !difficulty || e.difficulty === difficulty)
      .filter((e) => !search || e.title.toLowerCase().includes(search))
      .map((e) => {
        const attempts = state.codingAttempts.filter((a) => a.exerciseId === e.id);
        return {
          id: e.id,
          category: e.category,
          title: e.title,
          slug: e.slug,
          difficulty: humanise(e.difficulty),
          language: e.language,
          estimatedMinutes: e.estimatedMinutes,
          passed: attempts.some((a) => a.passed),
          bestScore: attempts.length ? Math.max(...attempts.map((a) => a.score)) : undefined,
        };
      });
  }

  if (route === 'GET /coding-exercises/categories') {
    return [...new Set(codingExercises.map((e) => e.category))].sort();
  }

  if (method === 'GET' && segments[0] === 'coding-exercises' && segments.length === 2) {
    const exercise = codingBySlug.get(segments[1]);
    if (!exercise) throw new DemoHttpError(404, 'Coding exercise was not found.');
    const attempts = state.codingAttempts.filter((a) => a.exerciseId === exercise.id);

    return {
      id: exercise.id,
      category: exercise.category,
      title: exercise.title,
      slug: exercise.slug,
      difficulty: humanise(exercise.difficulty),
      problemMarkdown: exercise.problemMarkdown,
      language: exercise.language,
      starterCode: exercise.starterCode,
      testNames: exercise.tests.map((t) => t.name),
      estimatedMinutes: exercise.estimatedMinutes,
      lastSubmission: attempts[attempts.length - 1]?.code,
      passed: attempts.some((a) => a.passed),
      isBookmarked: isBookmarked(state, 'CodingExercise', exercise.id),
    };
  }

  if (method === 'POST' && segments[0] === 'coding-exercises' && segments[2] === 'attempt') {
    const exercise = codingById.get(segments[1]);
    if (!exercise) throw new DemoHttpError(404, 'Coding exercise was not found.');
    const code = String(body?.code ?? '');
    if (code.trim().length === 0) {
      throw new DemoHttpError(400, 'Write some code before running the tests.');
    }

    const lower = code.toLowerCase();
    const tests = exercise.tests.map((test) => {
      const hasRequired = (test.mustContain ?? []).every((t) => lower.includes(t.toLowerCase()));
      const hasForbidden = (test.mustNotContain ?? []).some((t) => lower.includes(t.toLowerCase()));
      const passed = hasRequired && !hasForbidden;
      return { name: test.name, passed, hint: passed ? '' : (test.hint ?? '') };
    });

    const passedCount = tests.filter((t) => t.passed).length;
    const score = tests.length === 0 ? 0 : Math.round((passedCount * 100) / tests.length);
    const passed = tests.length > 0 && passedCount === tests.length;

    state.codingAttempts.push({ exerciseId: exercise.id, code, passed, score, at: isoDate(today()) });
    award(
      state,
      passed ? XP.CodingPassed : 15,
      `Coding lab: ${exercise.title}`,
      exercise.estimatedMinutes,
    );
    if (passed) completePlanItems(state, 'coding', exercise.id);
    saveState(state);

    return {
      passed,
      score,
      tests,
      // The worked solution unlocks only once every check passes.
      solutionCode: passed ? exercise.solutionCode : undefined,
      explanation: passed ? exercise.explanation : undefined,
      xpAwarded: passed ? XP.CodingPassed : 15,
      evaluationMethod:
        'Static rubric check against required constructs. Code is not executed in this build.',
    };
  }

  // ----- interview questions -----

  if (route === 'GET /interview/questions') {
    const category = query.get('category');
    const difficulty = query.get('difficulty');
    const search = (query.get('search') ?? '').trim().toLowerCase();

    return interviewQuestions
      .filter((q) => !category || q.category === category)
      .filter((q) => !difficulty || q.difficulty === difficulty)
      .filter((q) => !search || q.question.toLowerCase().includes(search))
      .map((q) => {
        const attempts = state.interviewAttempts.filter((a) => a.questionId === q.id);
        return {
          id: q.id,
          category: humanise(q.category),
          difficulty: humanise(q.difficulty),
          question: q.question,
          timeLimitSeconds: q.timeLimitSeconds,
          bestScore: attempts.length ? Math.max(...attempts.map((a) => a.score)) : undefined,
          attemptCount: attempts.length,
        };
      });
  }

  if (
    method === 'GET' &&
    segments[0] === 'interview' &&
    segments[1] === 'questions' &&
    segments.length === 3
  ) {
    const question = interviewById.get(segments[2]);
    if (!question) throw new DemoHttpError(404, 'Interview question was not found.');
    const attempts = state.interviewAttempts.filter((a) => a.questionId === question.id);

    return {
      id: question.id,
      category: humanise(question.category),
      difficulty: humanise(question.difficulty),
      question: question.question,
      tips: question.tips,
      timeLimitSeconds: question.timeLimitSeconds,
      followUps: question.followUps,
      bestScore: attempts.length ? Math.max(...attempts.map((a) => a.score)) : undefined,
      isBookmarked: isBookmarked(state, 'InterviewQuestion', question.id),
    };
  }

  if (method === 'POST' && segments[1] === 'questions' && segments[3] === 'attempt') {
    const question = interviewById.get(segments[2]);
    if (!question) throw new DemoHttpError(404, 'Interview question was not found.');
    const answerText = String(body?.answerText ?? '');
    if (answerText.trim().length === 0) {
      throw new DemoHttpError(400, 'Record an answer before submitting.');
    }

    const evaluation = evaluateAnswer(answerText, question.rubric as RubricSpec[]);
    state.interviewAttempts.push({
      questionId: question.id,
      answerText,
      score: evaluation.score,
      at: isoDate(today()),
    });
    award(state, XP.InterviewAttempt, 'Interview practice', 5);
    completePlanItems(state, 'interview', question.id);
    saveState(state);

    return {
      score: evaluation.score,
      dimensions: evaluation.dimensions,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      suggestedAnswer: question.suggestedAnswer,
      evaluationMethod: evaluation.method,
      xpAwarded: XP.InterviewAttempt,
    };
  }

  return handlePlatform(method, segments, route, query, body, state);
}

// ---------- helpers used by more than one route above ----------

const bestScore = <T extends Record<string, unknown>>(
  attempts: T[],
  key: keyof T,
  id: string,
): number | undefined => {
  const matching = attempts.filter((a) => a[key] === id);
  return matching.length
    ? Math.max(...matching.map((a) => Number(a.score)))
    : undefined;
};

function ensurePlan(state: DemoState) {
  if (state.planDays.length > 0) return;
  generatePlan(state, today(), 12);
  saveState(state);
}

function videoDto(state: DemoState, lesson: (typeof lessons)[number]) {
  const override = state.contentOverrides[lesson.videoId] ?? {};
  return {
    id: lesson.videoId,
    title: lesson.video!.title,
    // Never fabricated — the same rule the API enforces.
    youTubeUrl: (override.youTubeUrl as string) ?? null,
    instructor: lesson.video!.instructor,
    durationMinutes: lesson.video!.durationMinutes,
    skillLevel: lesson.video!.skillLevel,
    isVerified: Boolean(override.isVerified),
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    lessonSlug: lesson.slug,
  };
}

function lessonDetail(state: DemoState, slug: string) {
  const lesson = lessonBySlug.get(slug);
  if (!lesson) throw new DemoHttpError(404, 'Lesson was not found.');

  const courseLessons = lessons.filter((l) => l.courseSlug === lesson.courseSlug);
  const navigation = courseLessons.map((l) => ({
    id: l.id,
    title: l.title,
    slug: l.slug,
    status: state.lessonProgress[l.id]?.status ?? 'NotStarted',
    order: l.order,
    moduleTitle: l.moduleTitle,
  }));

  const index = navigation.findIndex((n) => n.id === lesson.id);
  const progress = state.lessonProgress[lesson.id];

  const keywords = lesson.title
    .toLowerCase()
    .split(' ')
    .filter((w) => w.length > 4)
    .slice(0, 3);
  const related = practiceQuestions
    .filter((q) =>
      keywords.some((k) => q.tags.toLowerCase().includes(k) || q.prompt.toLowerCase().includes(k)),
    )
    .slice(0, 3)
    .map((q) => practiceListItem(state, q));

  return {
    id: lesson.id,
    title: lesson.title,
    slug: lesson.slug,
    type: humanise(lesson.type),
    estimatedMinutes: lesson.estimatedMinutes,
    contentMarkdown: lesson.contentMarkdown,
    codeExample: lesson.codeExample,
    codeLanguage: lesson.codeLanguage ?? 'csharp',
    diagramMermaid: lesson.diagramMermaid,
    keyTakeaways: lesson.keyTakeaways,
    resources: (lesson.resources ?? []).map((r, i) => ({
      id: `res:${lesson.slug}:${i}`,
      title: r.title,
      url: r.url,
      kind: humanise(r.kind),
    })),
    videos: lesson.video ? [videoDto(state, lesson)] : [],
    quiz: lesson.quiz
      ? {
          id: lesson.quizId,
          title: lesson.quiz.title,
          passMarkPercent: lesson.quiz.passMarkPercent,
          questions: lesson.quiz.questions.map((q, qi) => ({
            id: `q:${lesson.slug}:${qi}`,
            order: qi + 1,
            prompt: q.prompt,
            allowsMultiple: q.allowsMultiple,
            options: q.options.map((o, oi) => ({
              id: `o:${lesson.slug}:${qi}:${oi}`,
              order: oi + 1,
              text: o.text,
            })),
          })),
        }
      : null,
    courseId: lesson.courseId,
    courseTitle: lesson.courseTitle,
    courseSlug: lesson.courseSlug,
    moduleTitle: lesson.moduleTitle,
    status: progress?.status ?? 'NotStarted',
    videoWatched: progress?.videoWatched ?? false,
    minutesSpent: progress?.minutesSpent ?? 0,
    quizScorePercent: progress?.quizScorePercent ?? undefined,
    isBookmarked: isBookmarked(state, 'Lesson', lesson.id),
    courseNavigation: navigation,
    previous: index > 0 ? navigation[index - 1] : null,
    next: index >= 0 && index < navigation.length - 1 ? navigation[index + 1] : null,
    relatedPractice: related,
  };
}

interface CalendarDay {
  onDate: string;
  status: string;
  targetMinutes: number;
  completedMinutes: number;
  itemCount: number;
  titles: string[];
}

function calendarMonth(state: DemoState, year: number, month: number) {
  ensurePlan(state);

  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const byDate = new Map(state.planDays.map((d) => [d.onDate, d]));

  const weeks: unknown[] = [];
  let cursor = addDays(first, -((first.getDay() + 6) % 7));
  let weekNumber = 1;

  while (cursor <= last) {
    const days: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(cursor, i);
      if (date < first || date > last) continue;
      const planned = byDate.get(isoDate(date));
      days.push(
        planned
          ? {
              onDate: planned.onDate,
              status: effectiveStatus(planned, today()),
              targetMinutes: planned.targetMinutes,
              completedMinutes: planned.items
                .filter((i) => i.status === 'Completed')
                .reduce((sum, i) => sum + i.minutes, 0),
              itemCount: planned.items.length,
              titles: planned.items.slice(0, 4).map((i) => i.title),
            }
          : {
              onDate: isoDate(date),
              status: 'NotStarted',
              targetMinutes: 0,
              completedMinutes: 0,
              itemCount: 0,
              titles: [],
            },
      );
    }

    if (days.length > 0) {
      const windowStart = isoDate(cursor);
      const windowEnd = isoDate(addDays(cursor, 6));
      const themes = state.planDays
        .filter((d) => d.onDate >= windowStart && d.onDate <= windowEnd)
        .flatMap((d) => d.items.map((i) => i.title.split(':')[0].trim()));
      const theme =
        [...themes].sort(
          (a, b) => themes.filter((t) => t === b).length - themes.filter((t) => t === a).length,
        )[0] ?? 'Open';

      weeks.push({
        weekNumber,
        label: `Week ${weekNumber}`,
        startDate: days[0].onDate,
        endDate: days[days.length - 1].onDate,
        theme,
        days,
      });
      weekNumber++;
    }
    cursor = addDays(cursor, 7);
  }

  const monthDays = state.planDays.filter(
    (d) => d.onDate >= isoDate(first) && d.onDate <= isoDate(last),
  );

  return {
    year,
    month,
    monthName: monthLabel(first),
    weeks,
    totalPlannedMinutes: monthDays.reduce((sum, d) => sum + d.targetMinutes, 0),
    totalCompletedMinutes: monthDays
      .flatMap((d) => d.items)
      .filter((i) => i.status === 'Completed')
      .reduce((sum, i) => sum + i.minutes, 0),
  };
}

/** Sign-in is handled before a session exists, so it lives here. */
export function login(email: string, password: string) {
  const account = ACCOUNTS.find(
    (a) => a.email === email.trim().toLowerCase() && a.password === password,
  );
  if (!account) throw new DemoHttpError(401, 'Email or password is incorrect.');

  const state = loadState(account);
  saveState(state);
  return {
    token: `${TOKEN_PREFIX}${account.email}`,
    expiresAt: addDays(today(), 1).toISOString(),
    user: profileDto(state),
  };
}
