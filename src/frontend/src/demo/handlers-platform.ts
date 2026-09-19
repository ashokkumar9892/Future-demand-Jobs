/**
 * Demo route handlers for the platform surfaces: mock interview, projects,
 * certifications, readiness, skills, resume, dashboard, notes, bookmarks,
 * search, gamification and admin.
 *
 * Split from handlers.ts purely to keep each file a readable size.
 */
import {
  DISCLAIMER_EVALUATOR,
  DISCLAIMER_EVIDENCE,
  addDays,
  evaluateAnswer,
  isoDate,
  levelTitle,
  longestStreak,
  monthLabel,
  streakFrom,
  weeksFor,
  XP,
  type RubricSpec,
} from './rules';
import {
  architectureChallenges,
  badges,
  careers,
  certifications,
  codingExercises,
  courses,
  humanise,
  interviewById,
  interviewQuestions,
  lessons,
  practiceQuestions,
  projectBySlug,
  projects,
  skillBySlug,
  skills,
} from './seed';
import { courseHours, planDayDto } from './planner';
import {
  award,
  careerReadiness,
  careerSummary,
  completePlanItems,
  DemoHttpError,
  isBookmarked,
  projectListItem,
  readinessSignals,
  saveState,
  skillLevel,
  targetCareer,
  today,
  weeklyHours,
  type DemoState,
} from './shared';

export function handlePlatform(
  method: string,
  segments: string[],
  route: string,
  query: URLSearchParams,
  body: Record<string, unknown> | undefined,
  state: DemoState,
): unknown {
  // ----- mock interview -----

  if (route === 'POST /mock-interview/start') {
    const count = Math.max(3, Math.min(10, Number(body?.questionCount ?? 5)));
    const careerId = body?.careerPathId as string | undefined;
    const career =
      (careerId ? careers.find((c) => c.id === careerId) : undefined) ??
      targetCareer(state) ??
      careers[0];

    // One question per category where possible, so the scorecard has signal on
    // every dimension rather than five variations of the same topic.
    const byCategory = new Map<string, typeof interviewQuestions>();
    for (const question of interviewQuestions) {
      const list = byCategory.get(question.category) ?? [];
      list.push(question);
      byCategory.set(question.category, list);
    }

    const picked = [...byCategory.values()].map((list) => list[0]).slice(0, count);
    for (const question of interviewQuestions) {
      if (picked.length >= count) break;
      if (!picked.some((p) => p.id === question.id)) picked.push(question);
    }

    const session = {
      id: `mock:${Date.now()}`,
      careerTitle: career.title,
      completedAt: null,
      scores: {},
      recommendations: [],
      // Orders are spaced by 10 so a follow-up slots in after its parent.
      turns: picked.map((question, index) => ({
        id: `turn:${index}`,
        order: (index + 1) * 10,
        questionId: question.id,
        question: question.question,
        isFollowUp: false,
        answerText: '',
        turnScore: 0,
        feedback: '',
      })),
    };

    state.mockSessions.push(session);
    saveState(state);
    return mockStateDto(session);
  }

  if (method === 'POST' && segments[0] === 'mock-interview' && segments[2] === 'answer') {
    const session = state.mockSessions.find((s) => s.id === segments[1]);
    if (!session) throw new DemoHttpError(404, 'Mock interview session was not found.');
    if (session.completedAt) throw new DemoHttpError(400, 'This interview has already finished.');

    const turn = [...session.turns].sort((a, b) => a.order - b.order).find((t) => !t.answerText);
    if (!turn) {
      throw new DemoHttpError(
        400,
        'Every question has been answered. Finish the interview to see your scorecard.',
      );
    }

    const answerText = String(body?.answerText ?? '');
    if (answerText.trim().length === 0) {
      throw new DemoHttpError(400, 'Answer the question before continuing.');
    }

    const question = turn.questionId ? interviewById.get(turn.questionId) : undefined;
    const evaluation = evaluateAnswer(answerText, question?.rubric as RubricSpec[] | undefined);

    turn.answerText = answerText;
    turn.turnScore = evaluation.score;
    turn.feedback = [...evaluation.weaknesses.slice(0, 2), ...evaluation.strengths.slice(0, 1)].join('\n');

    // A weak answer earns one follow-up, the way a real panel would probe.
    const followUps = question?.followUps ?? [];
    const alreadyFollowedUp = session.turns.some(
      (t) => t.isFollowUp && t.questionId === turn.questionId,
    );
    if (evaluation.score < 70 && followUps.length > 0 && !alreadyFollowedUp && !turn.isFollowUp) {
      session.turns.push({
        id: `turn:${session.turns.length}:followup`,
        order: turn.order + 1,
        questionId: turn.questionId,
        question: followUps[0],
        isFollowUp: true,
        answerText: '',
        turnScore: 0,
        feedback: '',
      });
    }

    saveState(state);
    return mockStateDto(session);
  }

  if (method === 'POST' && segments[0] === 'mock-interview' && segments[2] === 'finish') {
    const session = state.mockSessions.find((s) => s.id === segments[1]);
    if (!session) throw new DemoHttpError(404, 'Mock interview session was not found.');

    const answered = session.turns.filter((t) => t.answerText);
    if (answered.length === 0) {
      throw new DemoHttpError(400, 'Answer at least one question before finishing.');
    }

    const scoreFor = (categories: string[]) => {
      const relevant = answered.filter((t) => {
        const q = t.questionId ? interviewById.get(t.questionId) : undefined;
        return q && categories.includes(q.category);
      });
      const source = relevant.length > 0 ? relevant : answered;
      return Math.round(source.reduce((sum, t) => sum + t.turnScore, 0) / source.length);
    };

    // Communication is judged on delivery, not on technical correctness.
    const communication = Math.round(
      answered.reduce((sum, t) => {
        const words = t.answerText.split(/\s+/).filter(Boolean).length;
        const length = words < 30 ? 40 : words < 80 ? 70 : words < 350 ? 90 : 70;
        const structure = /\n|first|then/i.test(t.answerText) ? 10 : 0;
        return sum + Math.min(100, length + structure);
      }, 0) / answered.length,
    );

    const SECURITY_MARKERS = [
      'security', 'authentication', 'authorization', 'rbac', 'managed identity', 'key vault',
      'secret', 'encryption', 'pii', 'least privilege', 'audit', 'prompt injection', 'private endpoint',
    ];
    const securityAwareness = Math.min(
      100,
      Math.round(
        (answered.reduce(
          (sum, t) =>
            sum + SECURITY_MARKERS.filter((m) => t.answerText.toLowerCase().includes(m)).length,
          0,
        ) /
          answered.length) *
          25,
      ),
    );

    const technicalKnowledge = scoreFor(['Technical', 'Cloud', 'Coding']);
    const architecture = scoreFor(['Architecture', 'SystemDesign']);
    const problemSolving = scoreFor(['SystemDesign', 'Technical']);
    const overall = Math.round(
      communication * 0.2 +
        technicalKnowledge * 0.25 +
        architecture * 0.25 +
        problemSolving * 0.2 +
        securityAwareness * 0.1,
    );

    const baseScore = Math.round(
      answered.reduce((sum, t) => sum + t.turnScore, 0) / answered.length,
    );
    const recommendations: string[] = [];
    if (architecture < 70)
      recommendations.push(
        'Rehearse end-to-end architecture walkthroughs: context, components, data flow, failure modes, cost.',
      );
    if (securityAwareness < 70)
      recommendations.push(
        'Name concrete controls unprompted — managed identity, Key Vault, private endpoints, PII handling, prompt-injection defences.',
      );
    if (communication < 70)
      recommendations.push(
        'Structure answers explicitly: requirements, options considered, decision, trade-offs.',
      );
    if (technicalKnowledge < 70)
      recommendations.push(
        'Deepen hands-on work in the target stack and quote specific services, limits and SLAs.',
      );
    if (problemSolving < 70)
      recommendations.push(
        'State assumptions out loud and quantify: users, RPS, latency budget, token cost.',
      );
    if (baseScore >= 80)
      recommendations.push(
        'Strong baseline. Add measurable outcomes (latency, cost per request, adoption) to make answers memorable.',
      );
    recommendations.push('Repeat this mock weekly and compare the five dimensions over time.');

    session.completedAt = new Date().toISOString();
    session.scores = {
      communication,
      technicalKnowledge,
      architecture,
      problemSolving,
      securityAwareness,
      overall,
    };
    session.recommendations = recommendations;

    award(state, XP.MockInterviewCompleted, 'Mock interview completed', answered.length * 5);
    saveState(state);
    return scorecardDto(session);
  }

  if (route === 'GET /mock-interview/latest') {
    const completed = state.mockSessions.filter((s) => s.completedAt);
    return completed.length ? scorecardDto(completed[completed.length - 1]) : null;
  }

  // ----- projects -----

  if (route === 'GET /projects') return projects.map((p) => projectListItem(state, p));

  if (method === 'GET' && segments[0] === 'projects' && segments.length === 2) {
    return projectDetail(state, segments[1]);
  }

  if (method === 'POST' && segments[0] === 'projects' && segments[2] === 'progress') {
    const project = projects.find((p) => p.id === segments[1]);
    if (!project) throw new DemoHttpError(404, 'Project was not found.');

    const existing = ensureProject(state, project.id);
    const previousStatus = existing.status;
    existing.status = (body?.status as typeof existing.status) ?? existing.status;
    existing.repoUrl = (body?.repoUrl as string) ?? existing.repoUrl;
    existing.demoUrl = (body?.demoUrl as string) ?? existing.demoUrl;
    existing.notes = (body?.notes as string) ?? existing.notes;

    if (existing.status !== 'NotStarted' && !existing.startedAt) existing.startedAt = isoDate(today());
    if (existing.status === 'Completed') {
      existing.percentComplete = 100;
      existing.milestones = project.milestones.map((m) => m.id);
      if (!existing.completedAt) existing.completedAt = isoDate(today());
      if (previousStatus !== 'Completed') {
        award(state, XP.ProjectCompleted, `Project completed: ${project.title}`);
      }
    }

    saveState(state);
    return projectDetail(state, project.slug);
  }

  if (method === 'POST' && segments[2] === 'milestones' && segments[4] === 'toggle') {
    const project = projects.find((p) => p.id === segments[1]);
    if (!project) throw new DemoHttpError(404, 'Project was not found.');
    const milestone = project.milestones.find((m) => m.id === segments[3]);
    if (!milestone) throw new DemoHttpError(404, 'Milestone was not found.');

    const progress = ensureProject(state, project.id);
    if (progress.milestones.includes(milestone.id)) {
      progress.milestones = progress.milestones.filter((m) => m !== milestone.id);
    } else {
      progress.milestones.push(milestone.id);
      award(
        state,
        XP.ProjectMilestone,
        `Milestone: ${milestone.title}`,
        milestone.estimatedHours * 60,
      );
    }

    progress.percentComplete =
      project.milestones.length === 0
        ? 0
        : Math.round((progress.milestones.length * 100) / project.milestones.length);
    progress.status =
      progress.percentComplete === 0
        ? 'NotStarted'
        : progress.percentComplete === 100
          ? 'Completed'
          : 'InProgress';

    if (progress.status !== 'NotStarted' && !progress.startedAt) progress.startedAt = isoDate(today());
    if (progress.status === 'Completed' && !progress.completedAt) {
      progress.completedAt = isoDate(today());
      award(state, XP.ProjectCompleted, `Project completed: ${project.title}`);
      completePlanItems(state, 'project', project.id);
    }

    saveState(state);
    return projectDetail(state, project.slug);
  }

  // ----- certifications -----

  if (route === 'GET /certifications') {
    const career = targetCareer(state);
    const recommended = new Set(
      career?.certifications.map((code) => `cert:${code}`) ?? [],
    );
    return certifications.map((cert) => certificationDto(state, cert, recommended.has(cert.id)));
  }

  if (method === 'PUT' && segments[0] === 'certifications' && segments[1] === 'mine') {
    const cert = certifications.find((c) => c.id === segments[2]);
    if (!cert) throw new DemoHttpError(404, 'Certification was not found.');

    const existing = state.certifications[cert.id] ?? {
      status: 'NotStarted',
      targetDate: null,
      completedDate: null,
      scorePercent: null,
      prepHoursLogged: 0,
    };
    const wasPassed = existing.status === 'Passed';

    existing.status = String(body?.status ?? existing.status);
    existing.targetDate = (body?.targetDate as string | null) ?? existing.targetDate;
    existing.completedDate = (body?.completedDate as string | null) ?? existing.completedDate;
    existing.scorePercent = (body?.scorePercent as number | null) ?? existing.scorePercent;
    existing.prepHoursLogged = Math.max(0, Number(body?.prepHoursLogged ?? existing.prepHoursLogged));

    if (existing.status === 'Passed') {
      existing.completedDate = existing.completedDate ?? isoDate(today());
      if (!wasPassed) award(state, XP.CertificationPassed, `Certification passed: ${cert.code}`);
    }

    state.certifications[cert.id] = existing;
    saveState(state);
    return certificationDto(state, cert, false);
  }

  // ----- readiness, skills, resume -----

  if (route === 'GET /readiness') {
    const signals = readinessSignals(state);
    return careers.map((c) => careerReadiness(state, c, signals));
  }

  if (method === 'GET' && segments[0] === 'readiness' && segments.length === 2) {
    const career = careers.find((c) => c.slug === segments[1]);
    if (!career) throw new DemoHttpError(404, 'Career path was not found.');
    return careerReadiness(state, career);
  }

  if (route === 'GET /skills/matrix') return skillMatrix(state);

  if (route === 'PUT /skills/mine') {
    const skillId = String(body?.skillId ?? '');
    const skill = skills.find((s) => s.id === skillId);
    if (!skill) throw new DemoHttpError(404, 'Skill was not found.');
    state.skillLevels[skill.slug] = Math.max(0, Math.min(100, Number(body?.currentLevel ?? 0)));
    saveState(state);
    return skillMatrix(state);
  }

  if (route === 'GET /resume' || route === 'POST /resume/generate') return resume(state);

  // ----- dashboard -----

  if (route === 'GET /dashboard') return dashboard(state);

  // ----- notes -----

  if (route === 'GET /notes') {
    const scope = query.get('scope');
    const refId = query.get('refId');
    const search = (query.get('search') ?? '').trim().toLowerCase();
    const importantOnly = query.get('importantOnly') === 'true';

    return state.notes
      .filter((n) => !scope || n.scope === scope)
      .filter((n) => !refId || n.refId === refId)
      .filter((n) => !importantOnly || n.isImportant)
      .filter(
        (n) =>
          !search ||
          n.title.toLowerCase().includes(search) ||
          n.body.toLowerCase().includes(search) ||
          n.tags.toLowerCase().includes(search),
      )
      .slice()
      .reverse();
  }

  if (route === 'POST /notes') {
    const note = {
      id: `note:${Date.now()}`,
      scope: String(body?.scope ?? 'General'),
      refId: (body?.refId as string) ?? null,
      refTitle: String(body?.refTitle ?? ''),
      title: String(body?.title ?? ''),
      body: String(body?.body ?? ''),
      isImportant: Boolean(body?.isImportant),
      isQuestion: Boolean(body?.isQuestion),
      codeSnippet: (body?.codeSnippet as string) ?? null,
      links: String(body?.links ?? ''),
      tags: String(body?.tags ?? ''),
      createdAt: isoDate(today()),
      updatedAt: null,
    };
    state.notes.push(note);
    saveState(state);
    return note;
  }

  if (method === 'PUT' && segments[0] === 'notes') {
    const note = state.notes.find((n) => n.id === segments[1]);
    if (!note) throw new DemoHttpError(404, 'Note was not found.');
    Object.assign(note, {
      scope: String(body?.scope ?? note.scope),
      title: String(body?.title ?? note.title),
      body: String(body?.body ?? note.body),
      isImportant: Boolean(body?.isImportant),
      isQuestion: Boolean(body?.isQuestion),
      codeSnippet: (body?.codeSnippet as string) ?? note.codeSnippet,
      links: String(body?.links ?? note.links),
      tags: String(body?.tags ?? note.tags),
      updatedAt: isoDate(today()),
    });
    saveState(state);
    return note;
  }

  if (method === 'DELETE' && segments[0] === 'notes') {
    state.notes = state.notes.filter((n) => n.id !== segments[1]);
    saveState(state);
    return undefined;
  }

  // ----- bookmarks -----

  if (route === 'GET /bookmarks') {
    const itemType = query.get('itemType');
    return state.bookmarks
      .filter((b) => !itemType || b.itemType === itemType)
      .slice()
      .reverse();
  }

  if (route === 'POST /bookmarks/toggle') {
    const itemType = String(body?.itemType ?? 'Lesson');
    const refId = String(body?.refId ?? '');
    const existing = state.bookmarks.find((b) => b.itemType === itemType && b.refId === refId);

    if (existing) {
      state.bookmarks = state.bookmarks.filter((b) => b.id !== existing.id);
      saveState(state);
      return { ...existing, createdAt: '' };
    }

    const bookmark = {
      id: `bm:${Date.now()}`,
      itemType,
      refId,
      title: String(body?.title ?? ''),
      subtitle: String(body?.subtitle ?? ''),
      deepLink: (body?.deepLink as string) ?? null,
      createdAt: isoDate(today()),
    };
    state.bookmarks.push(bookmark);
    saveState(state);
    return bookmark;
  }

  if (method === 'DELETE' && segments[0] === 'bookmarks') {
    state.bookmarks = state.bookmarks.filter((b) => b.id !== segments[1]);
    saveState(state);
    return undefined;
  }

  // ----- search -----

  if (route === 'GET /search') {
    const term = (query.get('q') ?? '').trim().toLowerCase();
    if (term.length < 2) return { query: term, total: 0, results: [] };
    const take = Math.max(1, Math.min(25, Number(query.get('limit') ?? 8)));

    const results = [
      ...courses
        .filter((c) => c.title.toLowerCase().includes(term) || c.summary.toLowerCase().includes(term))
        .slice(0, take)
        .map((c) => ({ type: 'Course', id: c.id, title: c.title, subtitle: c.summary, deepLink: `/courses/${c.slug}`, matched: 'Course' })),
      ...lessons
        .filter((l) => l.title.toLowerCase().includes(term) || l.contentMarkdown.toLowerCase().includes(term))
        .slice(0, take)
        .map((l) => ({ type: 'Lesson', id: l.id, title: l.title, subtitle: l.moduleTitle, deepLink: `/learn/${l.slug}`, matched: 'Lesson' })),
      ...practiceQuestions
        .filter((q) => q.prompt.toLowerCase().includes(term) || q.tags.toLowerCase().includes(term))
        .slice(0, take)
        .map((q) => ({ type: 'Practice', id: q.id, title: q.prompt, subtitle: q.category, deepLink: `/practice/${q.id}`, matched: 'Practice' })),
      ...projects
        .filter((p) => p.title.toLowerCase().includes(term) || p.summary.toLowerCase().includes(term) || p.techStack.toLowerCase().includes(term))
        .slice(0, take)
        .map((p) => ({ type: 'Project', id: p.id, title: p.title, subtitle: p.techStack, deepLink: `/projects/${p.slug}`, matched: 'Project' })),
      ...careers
        .filter((c) => c.title.toLowerCase().includes(term) || c.resumeKeywords.join(' ').toLowerCase().includes(term))
        .slice(0, take)
        .map((c) => ({ type: 'Career', id: c.id, title: c.title, subtitle: c.summary, deepLink: `/careers/${c.slug}`, matched: 'Career' })),
      ...skills
        .filter((s) => s.name.toLowerCase().includes(term))
        .slice(0, take)
        .map((s) => ({ type: 'Technology', id: s.id, title: s.name, subtitle: humanise(s.category), deepLink: '/skills', matched: 'Technology' })),
      ...interviewQuestions
        .filter((q) => q.question.toLowerCase().includes(term))
        .slice(0, take)
        .map((q) => ({ type: 'Interview', id: q.id, title: q.question, subtitle: humanise(q.category), deepLink: `/interview-prep?question=${q.id}`, matched: 'Interview' })),
      ...codingExercises
        .filter((e) => e.title.toLowerCase().includes(term) || e.category.toLowerCase().includes(term))
        .slice(0, take)
        .map((e) => ({ type: 'Coding Lab', id: e.id, title: e.title, subtitle: e.category, deepLink: `/coding-labs/${e.slug}`, matched: 'Coding Lab' })),
      ...state.notes
        .filter((n) => n.title.toLowerCase().includes(term) || n.body.toLowerCase().includes(term))
        .slice(0, take)
        .map((n) => ({ type: 'Note', id: n.id, title: n.title, subtitle: n.refTitle, deepLink: '/notes', matched: 'Note' })),
    ];

    return { query: query.get('q') ?? '', total: results.length, results };
  }

  // ----- gamification -----

  if (route === 'GET /gamification') return gamification(state);

  // ----- admin -----

  if (route.startsWith('GET /admin') || route.startsWith('PUT /admin') || route.startsWith('POST /admin') || route.startsWith('DELETE /admin')) {
    return admin(method, segments, route, query, body, state);
  }

  throw new DemoHttpError(404, `The demo does not implement ${route}.`);
}

// ---------- projections ----------

function mockStateDto(session: DemoState['mockSessions'][number]) {
  const turns = [...session.turns]
    .sort((a, b) => a.order - b.order)
    .map((t, index) => turnDto(t, index + 1));
  const current = turns.find((t) => !t.answerText);
  return {
    sessionId: session.id,
    careerTitle: session.careerTitle,
    turnsAnswered: turns.filter((t) => t.answerText).length,
    totalPlanned: turns.length,
    currentTurn: current,
    isComplete: !current,
    history: turns,
  };
}

const turnDto = (turn: DemoState['mockSessions'][number]['turns'][number], displayOrder: number) => ({
  id: turn.id,
  order: displayOrder,
  question: turn.question,
  isFollowUp: turn.isFollowUp,
  answerText: turn.answerText || undefined,
  turnScore: turn.answerText ? turn.turnScore : undefined,
  feedback: turn.feedback || undefined,
});

function scorecardDto(session: DemoState['mockSessions'][number]) {
  return {
    sessionId: session.id,
    communication: session.scores.communication ?? 0,
    technicalKnowledge: session.scores.technicalKnowledge ?? 0,
    architecture: session.scores.architecture ?? 0,
    problemSolving: session.scores.problemSolving ?? 0,
    securityAwareness: session.scores.securityAwareness ?? 0,
    overallScore: session.scores.overall ?? 0,
    recommendations: session.recommendations,
    turns: [...session.turns]
      .sort((a, b) => a.order - b.order)
      .map((t, index) => turnDto(t, index + 1)),
    evaluationMethod: DISCLAIMER_EVALUATOR,
  };
}

function ensureProject(state: DemoState, projectId: string) {
  state.projectProgress[projectId] ??= {
    status: 'NotStarted',
    percentComplete: 0,
    milestones: [],
    repoUrl: null,
    demoUrl: null,
    notes: '',
    startedAt: null,
    completedAt: null,
  };
  return state.projectProgress[projectId];
}

function projectDetail(state: DemoState, slug: string) {
  const project = projectBySlug.get(slug);
  if (!project) throw new DemoHttpError(404, 'Project was not found.');
  const progress = state.projectProgress[project.id];
  const completed = new Set(progress?.milestones ?? []);

  return {
    project: projectListItem(state, project),
    briefMarkdown: project.briefMarkdown,
    architectureMermaid: project.architectureMermaid,
    acceptanceCriteria: project.acceptanceCriteria,
    resumeBullets: project.resumeBullets,
    skills: project.skillSlugs.map((s) => skillBySlug.get(s)?.name ?? s),
    milestones: project.milestones.map((m) => ({
      id: m.id,
      order: m.order,
      title: m.title,
      description: m.description,
      estimatedHours: m.estimatedHours,
      completed: completed.has(m.id),
    })),
    repoUrl: progress?.repoUrl ?? undefined,
    demoUrl: progress?.demoUrl ?? undefined,
    notes: progress?.notes ?? '',
    isBookmarked: isBookmarked(state, 'Project', project.id),
  };
}

function certificationDto(
  state: DemoState,
  cert: (typeof certifications)[number],
  recommended: boolean,
) {
  const mine = state.certifications[cert.id];
  return {
    id: cert.id,
    code: cert.code,
    name: cert.name,
    vendor: cert.vendor,
    level: cert.level,
    estimatedPrepHours: cert.estimatedPrepHours,
    topics: cert.topics,
    examCostUsd: cert.examCostUsd,
    officialUrl: cert.officialUrl,
    status: mine?.status ?? 'NotStarted',
    targetDate: mine?.targetDate ?? undefined,
    completedDate: mine?.completedDate ?? undefined,
    scorePercent: mine?.scorePercent ?? undefined,
    prepHoursLogged: mine?.prepHoursLogged ?? 0,
    recommendedForTarget: recommended,
  };
}

function skillMatrix(state: DemoState) {
  const career = targetCareer(state);
  const targets = new Map(
    (career?.skills ?? []).map((cs) => [cs.slug, { target: cs.targetLevel, importance: humanise(cs.importance) }]),
  );

  const rows = skills
    .map((skill) => {
      const current = skillLevel(state, skill.slug);
      const entry = targets.get(skill.slug);
      return {
        skillId: skill.id,
        name: skill.name,
        slug: skill.slug,
        category: humanise(skill.category),
        current,
        target: entry?.target ?? 0,
        gap: Math.max(0, (entry?.target ?? 0) - current),
        importance: entry?.importance ?? 'Not Required',
      };
    })
    // Target-bearing skills lead: the matrix should show what the career demands.
    .sort((a, b) => Number(b.target > 0) - Number(a.target > 0) || b.gap - a.gap || a.name.localeCompare(b.name));

  const withTarget = rows.filter((r) => r.target > 0);

  return {
    careerTitle: career?.title,
    rows,
    averageCurrent: rows.length ? Math.round(rows.reduce((s, r) => s + r.current, 0) / rows.length) : 0,
    averageTarget: withTarget.length
      ? Math.round(withTarget.reduce((s, r) => s + r.target, 0) / withTarget.length)
      : 0,
  };
}

function resume(state: DemoState) {
  const career = targetCareer(state);
  const readiness = career ? careerReadiness(state, career) : null;
  const readinessPercent = readiness?.overall ?? 0;

  const items: { id: string; section: string; text: string; evidenceKind: string; order: number }[] = [];
  let order = 1;

  for (const entry of courseHours(state)) {
    if (entry.progressPercent < 80) continue;
    const covered = entry.course.skillSlugs.map((s) => skillBySlug.get(s)?.name ?? s);
    items.push({
      id: `resume:course:${entry.course.slug}`,
      section: 'Training',
      text: `${entry.course.title} — completed structured training (${entry.course.estimatedHours} hrs)${covered.length ? `: ${covered.join(', ')}` : ''}`,
      evidenceKind: 'Training',
      order: order++,
    });
  }

  for (const project of projects) {
    if (state.projectProgress[project.id]?.status !== 'Completed') continue;
    const bullet = project.resumeBullets[0] ?? project.summary;
    items.push({
      id: `resume:project:${project.slug}`,
      section: 'Projects',
      text: `${project.title} — ${bullet} (${project.techStack})`,
      evidenceKind: 'PersonalProject',
      order: order++,
    });
  }

  for (const cert of certifications) {
    const mine = state.certifications[cert.id];
    if (mine?.status !== 'Passed') continue;
    items.push({
      id: `resume:cert:${cert.code}`,
      section: 'Certifications',
      text: `${cert.code} — ${cert.name} (${cert.vendor})${mine.completedDate ? `, ${mine.completedDate}` : ''}`,
      evidenceKind: 'Certification',
      order: order++,
    });
  }

  for (const dimension of readiness?.dimensions ?? []) {
    if (dimension.score < 60) continue;
    items.push({
      id: `resume:skill:${dimension.name}`,
      section: 'Skills',
      text: dimension.name,
      evidenceKind: 'Training',
      order: order++,
    });
  }

  const hasProjects = items.some((i) => i.evidenceKind === 'PersonalProject');
  // The title only changes once there is real evidence behind it.
  const headline = !career
    ? '.NET / Azure Full Stack Developer'
    : readinessPercent >= 75 && hasProjects
      ? `.NET / Azure ${career.title.replace(' Architect', ' Engineer')} — transitioning to ${career.title}`
      : readinessPercent >= 50 && hasProjects
        ? '.NET / Azure / AI Solutions Engineer'
        : readinessPercent >= 30
          ? '.NET / Azure Developer with applied AI engineering training'
          : '.NET / Azure Full Stack Developer';

  const projectCount = items.filter((i) => i.evidenceKind === 'PersonalProject').length;
  const certCount = items.filter((i) => i.evidenceKind === 'Certification').length;
  let summary =
    `${state.profile.yearsExperience}+ years of enterprise software engineering across .NET, Angular, SQL Server ` +
    `and cloud platforms. Currently building applied AI engineering depth toward ` +
    `${career?.title ?? 'a senior architecture role'} (${readinessPercent}% through a structured programme`;
  if (projectCount > 0) summary += `, ${projectCount} portfolio project${projectCount === 1 ? '' : 's'} delivered`;
  if (certCount > 0) summary += `, ${certCount} certification${certCount === 1 ? '' : 's'} passed`;
  summary += ').';

  return {
    headline,
    beforeHeadline: '.NET / Angular / SQL Server Full Stack Developer',
    summary,
    generatedAt: isoDate(today()),
    items,
    suggestedKeywords: career?.resumeKeywords ?? [],
    readinessPercent,
    evidencePolicy: DISCLAIMER_EVIDENCE,
  };
}

function gamification(state: DemoState) {
  const totalXp = state.xpEvents.reduce((sum, e) => sum + e.amount, 0);
  const level = Math.max(1, Math.floor(totalXp / XP.PerLevel) + 1);
  const dates = new Set(state.studySessions.map((s) => s.date));
  const earned = new Set(state.earnedBadges);

  return {
    totalXp,
    level,
    levelTitle: levelTitle(level),
    xpIntoLevel: totalXp % XP.PerLevel,
    xpForNextLevel: XP.PerLevel,
    studyStreakDays: streakFrom(dates, today()),
    longestStreakDays: longestStreak(dates),
    badgesEarned: earned.size,
    badgesTotal: badges.length,
    badges: badges.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      description: b.description,
      tier: b.tier,
      criteria: b.criteria,
      earned: earned.has(b.id),
      earnedAt: earned.has(b.id) ? isoDate(addDays(today(), -10)) : undefined,
    })),
  };
}

function dashboard(state: DemoState) {
  const career = targetCareer(state);
  const breakdown = courseHours(state);
  const totalHours = breakdown.reduce((sum, b) => sum + b.hours, 0);
  const hoursCompleted = breakdown.reduce((sum, b) => sum + b.completedHours, 0);
  const coursesCompleted = breakdown.filter(
    (b) => b.lessonCount > 0 && b.completedLessons === b.lessonCount,
  ).length;

  const projectsCompleted = projects.filter(
    (p) => state.projectProgress[p.id]?.status === 'Completed',
  ).length;

  const readiness = career ? careerReadiness(state, career) : null;
  const readinessRings = readiness
    ? [
        { label: 'Overall readiness', percent: readiness.overall, detail: readiness.verdictLabel },
        ...readiness.dimensions
          .slice(0, 4)
          .map((d) => ({ label: d.name, percent: d.score, detail: undefined })),
      ]
    : [];

  const matrix = skillMatrix(state);
  const radar = matrix.rows
    .filter((r) => r.target > 0)
    .sort((a, b) => b.target - a.target)
    .slice(0, 8)
    .map((r) => ({ skill: r.name, current: r.current, target: r.target }));

  // Planned against actual for the last eight weeks, Monday-aligned.
  const weekly = weeklyHours(state);
  let start = addDays(today(), -49);
  start = addDays(start, -((start.getDay() + 6) % 7));
  const weeklyHoursPoints = Array.from({ length: 8 }, (_, i) => {
    const weekStart = addDays(start, i * 7);
    const weekEnd = addDays(weekStart, 6);
    const minutes = state.studySessions
      .filter((s) => s.date >= isoDate(weekStart) && s.date <= isoDate(weekEnd))
      .reduce((sum, s) => sum + s.minutes, 0);
    return {
      weekLabel: weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      plannedHours: Math.round(weekly * 10) / 10,
      actualHours: Math.round((minutes / 60) * 10) / 10,
    };
  });

  const todayPlan = state.planDays.find((d) => d.onDate === isoDate(today()));
  const nextLesson = lessons.find(
    (l) =>
      (!career || courses.find((c) => c.slug === l.courseSlug)?.careerSlug === career.slug) &&
      state.lessonProgress[l.id]?.status !== 'Completed',
  );
  const attempted = new Set(state.practiceAttempts.map((a) => a.questionId));
  const nextPractice = practiceQuestions.find((q) => !attempted.has(q.id));
  const nextProject = projects.find(
    (p) => state.projectProgress[p.id]?.status !== 'Completed',
  );

  const inProgressProject = projects.find(
    (p) => state.projectProgress[p.id]?.status === 'InProgress',
  );

  const plannedCert = certifications
    .map((c) => ({ cert: c, mine: state.certifications[c.id] }))
    .filter((c) => c.mine && c.mine.status !== 'Passed')
    .sort((a, b) => (a.mine!.targetDate ?? '9999').localeCompare(b.mine!.targetDate ?? '9999'))[0];
  const recommendedCert = career
    ? certifications.find((c) => c.code === career.certifications[0])
    : undefined;
  const upcomingCert = plannedCert
    ? {
        id: plannedCert.cert.id,
        code: plannedCert.cert.code,
        name: plannedCert.cert.name,
        status: plannedCert.mine!.status,
        targetDate: plannedCert.mine!.targetDate ?? undefined,
        estimatedPrepHours: plannedCert.cert.estimatedPrepHours,
      }
    : recommendedCert
      ? {
          id: recommendedCert.id,
          code: recommendedCert.code,
          name: recommendedCert.name,
          status: 'NotStarted',
          targetDate: undefined,
          estimatedPrepHours: recommendedCert.estimatedPrepHours,
        }
      : undefined;

  const game = gamification(state);
  const remaining = Math.max(0, totalHours - hoursCompleted);
  const eta = addDays(today(), weeksFor(remaining, weekly) * 7);
  const hour = new Date().getHours();
  const careerSalary = career
    ? `$${Math.round(career.salaryMinUsd / 1000)}K–$${Math.round(career.salaryMaxUsd / 1000)}K+`
    : '—';

  return {
    greeting: hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening',
    displayName: state.profile.displayName,
    targetCareerTitle: career?.title,
    targetCareerSlug: career?.slug,
    targetSalaryRange: careerSalary,
    estimatedCompletion: remaining === 0 ? 'Track complete' : monthLabel(eta),
    progressPercent: totalHours === 0 ? 0 : Math.round((hoursCompleted * 100) / totalHours),
    studyStreakDays: game.studyStreakDays,
    hoursCompleted,
    totalHours,
    coursesCompleted,
    totalCourses: breakdown.length,
    projectsCompleted,
    totalProjects: projects.length,
    practiceQuestionsAnswered: state.practiceAttempts.length,
    readinessRings,
    skillRadar: radar,
    weeklyHours: weeklyHoursPoints,
    today: todayPlan ? planDayDto(todayPlan, today()).items.map((i) => ({
      title: i.title,
      activityType: i.activityType,
      minutes: i.minutes,
      deepLink: i.deepLink ?? undefined,
      status: i.status,
    })) : [],
    nextUp: {
      nextLessonTitle: nextLesson?.title,
      nextLessonSlug: nextLesson?.slug,
      nextPracticeTitle: nextPractice?.prompt,
      nextPracticeId: nextPractice?.id,
      nextProjectTitle: nextProject?.title,
      nextProjectSlug: nextProject?.slug,
    },
    currentProject: inProgressProject
      ? {
          id: inProgressProject.id,
          title: inProgressProject.title,
          slug: inProgressProject.slug,
          percentComplete: state.projectProgress[inProgressProject.id]?.percentComplete ?? 0,
          milestonesDone: state.projectProgress[inProgressProject.id]?.milestones.length ?? 0,
          milestonesTotal: inProgressProject.milestones.length,
        }
      : undefined,
    upcomingCertification: upcomingCert,
    gamification: game,
  };
}

// ---------- admin ----------

const ADMIN_RESOURCES: Record<string, { label: string; rows: () => Record<string, unknown>[] }> = {
  careers: { label: 'Career paths', rows: () => careers.map((c) => ({ id: c.id, rank: c.rank, title: c.title, slug: c.slug, salaryMinUsd: c.salaryMinUsd, salaryMaxUsd: c.salaryMaxUsd, salarySource: c.salarySource })) },
  courses: { label: 'Courses', rows: () => courses.map((c) => ({ id: c.id, order: c.order, title: c.title, slug: c.slug, estimatedHours: c.estimatedHours, level: c.level })) },
  lessons: { label: 'Lessons', rows: () => lessons.map((l) => ({ id: l.id, title: l.title, slug: l.slug, type: l.type, estimatedMinutes: l.estimatedMinutes })) },
  videos: { label: 'Videos', rows: () => lessons.filter((l) => l.video).map((l) => ({ id: l.videoId, title: l.video!.title, youTubeUrl: null, durationMinutes: l.video!.durationMinutes, skillLevel: l.video!.skillLevel })) },
  'practice-questions': { label: 'Practice questions', rows: () => practiceQuestions.map((q) => ({ id: q.id, category: q.category, mode: q.mode, prompt: q.prompt, tags: q.tags })) },
  'interview-questions': { label: 'Interview questions', rows: () => interviewQuestions.map((q) => ({ id: q.id, category: q.category, difficulty: q.difficulty, question: q.question })) },
  'architecture-challenges': { label: 'Architecture challenges', rows: () => architectureChallenges.map((a) => ({ id: a.id, title: a.title, slug: a.slug, difficulty: a.difficulty })) },
  'coding-exercises': { label: 'Coding exercises', rows: () => codingExercises.map((e) => ({ id: e.id, category: e.category, title: e.title, slug: e.slug, language: e.language })) },
  projects: { label: 'Projects', rows: () => projects.map((p) => ({ id: p.id, order: p.order, title: p.title, slug: p.slug, estimatedHours: p.estimatedHours })) },
  certifications: { label: 'Certifications', rows: () => certifications.map((c) => ({ id: c.id, code: c.code, name: c.name, vendor: c.vendor, estimatedPrepHours: c.estimatedPrepHours })) },
  skills: { label: 'Technologies & skills', rows: () => skills.map((s) => ({ id: s.id, name: s.name, slug: s.slug, category: s.category, baselineLevel: s.baselineLevel })) },
  badges: { label: 'Badges', rows: () => badges.map((b) => ({ id: b.id, code: b.code, name: b.name, tier: b.tier, xpReward: b.xpReward })) },
};

function admin(
  method: string,
  segments: string[],
  route: string,
  query: URLSearchParams,
  body: Record<string, unknown> | undefined,
  state: DemoState,
): unknown {
  if (state.profile.role !== 'Admin') throw new DemoHttpError(403, 'Not allowed.');

  if (route === 'GET /admin/resources') {
    return Object.entries(ADMIN_RESOURCES).map(([key, entry]) => {
      const rows = entry.rows();
      return {
        key,
        label: entry.label,
        entityName: key,
        count: rows.length,
        fields: Object.keys(rows[0] ?? {}).map((name) => ({
          name,
          type: typeof rows[0]?.[name] === 'number' ? 'number' : 'string',
          required: false,
        })),
      };
    });
  }

  if (route === 'GET /admin/stats') {
    const linked = lessons.filter(
      (l) => l.video && state.contentOverrides[l.videoId]?.youTubeUrl,
    ).length;
    return {
      careers: careers.length,
      courses: courses.length,
      modules: courses.reduce((sum, c) => sum + c.modules.length, 0),
      lessons: lessons.length,
      videos: lessons.filter((l) => l.video).length,
      videosWithUrl: linked,
      practiceQuestions: practiceQuestions.length,
      interviewQuestions: interviewQuestions.length,
      projects: projects.length,
      certifications: certifications.length,
      codingExercises: codingExercises.length,
      architectureChallenges: architectureChallenges.length,
      skills: skills.length,
      badges: badges.length,
      learners: 2,
    };
  }

  if (method === 'PUT' && segments[1] === 'careers' && segments[3] === 'salary') {
    const career = careers.find((c) => c.id === segments[2]);
    if (!career) throw new DemoHttpError(404, 'Career path was not found.');

    const override = state.contentOverrides[career.id] ?? {};
    override.salaryMinUsd = Number(body?.salaryMinUsd ?? career.salaryMinUsd);
    override.salaryMaxUsd = Number(body?.salaryMaxUsd ?? career.salaryMaxUsd);
    override.seniorSalaryMinUsd = Number(body?.seniorSalaryMinUsd ?? career.seniorSalaryMinUsd);
    override.seniorSalaryMaxUsd = Number(body?.seniorSalaryMaxUsd ?? career.seniorSalaryMaxUsd);
    override.salarySource = String(body?.source ?? career.salarySource);
    state.contentOverrides[career.id] = override;

    state.salaryRevisions.push({
      careerSlug: career.slug,
      min: override.salaryMinUsd as number,
      max: override.salaryMaxUsd as number,
      source: override.salarySource as string,
      at: isoDate(today()),
    });

    saveState(state);
    return careerSummary(state, career);
  }

  if (method === 'GET' && segments.length === 2) {
    const resource = ADMIN_RESOURCES[segments[1]];
    if (!resource) throw new DemoHttpError(404, `Admin resource '${segments[1]}' was not found.`);
    const search = (query.get('search') ?? '').trim().toLowerCase();

    const rows = resource
      .rows()
      .map((row) => ({ ...row, ...(state.contentOverrides[String(row.id)] ?? {}) }))
      .filter(
        (row) =>
          !search ||
          Object.values(row).some((v) => typeof v === 'string' && v.toLowerCase().includes(search)),
      );

    return { resource: segments[1], total: rows.length, page: 1, pageSize: rows.length, items: rows };
  }

  if (method === 'PUT' && segments.length === 3) {
    // Edits are stored as overrides so the seed content stays pristine.
    const id = segments[2];
    state.contentOverrides[id] = { ...(state.contentOverrides[id] ?? {}), ...(body ?? {}) };
    saveState(state);
    return state.contentOverrides[id];
  }

  if (method === 'POST' || method === 'DELETE') {
    throw new DemoHttpError(
      400,
      'Creating and deleting content needs the API. In this browser-only demo you can edit ' +
        'existing rows — including attaching a video URL — and the change is kept in your browser.',
    );
  }

  throw new DemoHttpError(404, `The demo does not implement ${route}.`);
}
