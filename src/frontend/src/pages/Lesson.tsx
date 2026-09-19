import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  Clock,
  ExternalLink,
  FileQuestion,
  Lightbulb,
  NotebookPen,
  PlayCircle,
  Video as VideoIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, CardHeader, ErrorPanel, LoadingPanel, Progress, Tabs, Textarea } from '@/components/ui';
import { CodeBlock, Markdown, MermaidDiagram } from '@/components/content';
import { cn, minutesLabel, scoreTone } from '@/lib/format';
import type { LessonDetail, Note, QuizResult } from '@/types/api';

type Tab = 'lesson' | 'diagram' | 'code' | 'quiz';

export default function Lesson() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) ?? 'lesson');
  const [minutesOnPage, setMinutesOnPage] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ['lesson', slug],
    queryFn: () => api.get<LessonDetail>(`/lessons/${slug}`),
  });

  // Time on the lesson is recorded so the dashboard's hours figure reflects
  // actual reading rather than only the estimate attached to the lesson.
  useEffect(() => {
    setMinutesOnPage(0);
    const interval = setInterval(() => setMinutesOnPage((m) => m + 1), 60_000);
    return () => clearInterval(interval);
  }, [slug]);

  useEffect(() => {
    const requested = params.get('tab') as Tab | null;
    if (requested && requested !== tab) setTab(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const saveProgress = useMutation({
    mutationFn: (payload: { status: string; videoWatched: boolean }) =>
      api.post<LessonDetail>(`/lessons/${data!.id}/progress`, {
        status: payload.status,
        minutesSpent: minutesOnPage,
        videoWatched: payload.videoWatched,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['lesson', slug], updated);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['course', updated.courseSlug] });
      setMinutesOnPage(0);
    },
  });

  const toggleBookmark = useMutation({
    mutationFn: () =>
      api.post('/bookmarks/toggle', {
        itemType: 'Lesson',
        refId: data!.id,
        title: data!.title,
        subtitle: data!.courseTitle,
        deepLink: `/learn/${data!.slug}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson', slug] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });

  if (isLoading) return <LoadingPanel label="Loading lesson" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  if (!data) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'lesson', label: 'Lesson' },
    ...(data.diagramMermaid ? [{ key: 'diagram' as const, label: 'Architecture' }] : []),
    ...(data.codeExample ? [{ key: 'code' as const, label: 'Code' }] : []),
    ...(data.quiz ? [{ key: 'quiz' as const, label: 'Quiz' }] : []),
  ];

  const changeTab = (next: Tab) => {
    setTab(next);
    const updated = new URLSearchParams(params);
    if (next === 'lesson') updated.delete('tab');
    else updated.set('tab', next);
    setParams(updated, { replace: true });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
      {/* LEFT: course navigation */}
      <aside className="hidden xl:block">
        <div className="sticky top-[88px]">
          <Card>
            <CardHeader
              title={data.courseTitle}
              subtitle={`${data.courseNavigation.filter((n) => n.status === 'Completed').length} of ${data.courseNavigation.length} complete`}
              icon={<BookOpen size={15} />}
            />
            <nav className="max-h-[calc(100vh-14rem)] overflow-y-auto py-1">
              {data.courseNavigation.map((item, index) => {
                const active = item.slug === data.slug;
                const showModule =
                  index === 0 || data.courseNavigation[index - 1].moduleTitle !== item.moduleTitle;
                return (
                  <div key={item.id}>
                    {showModule && (
                      <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                        {item.moduleTitle}
                      </p>
                    )}
                    <Link
                      to={`/learn/${item.slug}`}
                      className={cn(
                        'flex items-start gap-2 px-4 py-1.5 text-[12px] transition',
                        active
                          ? 'bg-brand-600/15 text-ink'
                          : 'text-ink-muted hover:bg-surface-overlay hover:text-ink',
                      )}
                    >
                      <span className="mt-0.5 shrink-0">
                        {item.status === 'Completed' ? (
                          <CheckCircle2 size={12} className="text-emerald-400" />
                        ) : item.status === 'InProgress' ? (
                          <CircleDot size={12} className="text-amber-400" />
                        ) : (
                          <Circle size={12} className="text-ink-faint" />
                        )}
                      </span>
                      <span className="leading-snug">{item.title}</span>
                    </Link>
                  </div>
                );
              })}
            </nav>
            <div className="border-t border-line px-4 py-3">
              <Link to={`/courses/${data.courseSlug}`} className="text-[11px] text-brand-400 hover:underline">
                Course overview →
              </Link>
            </div>
          </Card>
        </div>
      </aside>

      {/* CENTRE */}
      <div className="min-w-0 space-y-5">
        <div>
          <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
            <Link to="/courses" className="transition hover:text-ink">
              Courses
            </Link>
            <ChevronRight size={11} />
            <Link to={`/courses/${data.courseSlug}`} className="transition hover:text-ink">
              {data.courseTitle}
            </Link>
            <ChevronRight size={11} />
            <span className="text-ink-muted">{data.moduleTitle}</span>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{data.title}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} />
                  {minutesLabel(data.estimatedMinutes)}
                </span>
                <Badge tone="neutral">{data.type}</Badge>
                {data.status === 'Completed' && <Badge tone="success">Completed</Badge>}
                {data.quizScorePercent !== undefined && data.quizScorePercent !== null && (
                  <Badge tone={data.quizScorePercent >= 70 ? 'success' : 'warning'}>
                    Quiz {data.quizScorePercent}%
                  </Badge>
                )}
              </div>
            </div>

            <Button
              variant={data.isBookmarked ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => toggleBookmark.mutate()}
              loading={toggleBookmark.isPending}
              icon={<Bookmark size={14} />}
            >
              {data.isBookmarked ? 'Saved' : 'Bookmark'}
            </Button>
          </div>
        </div>

        <VideoPanel lesson={data} onWatched={() => saveProgress.mutate({ status: 'InProgress', videoWatched: true })} />

        <Card>
          <div className="border-b border-line px-4 py-3">
            <Tabs tabs={tabs} active={tab} onChange={changeTab} />
          </div>

          <div className="p-5 sm:p-6">
            {tab === 'lesson' && <Markdown>{data.contentMarkdown}</Markdown>}

            {tab === 'diagram' && data.diagramMermaid && (
              <div>
                <p className="label mb-3">Architecture diagram</p>
                <MermaidDiagram chart={data.diagramMermaid} />
              </div>
            )}

            {tab === 'code' && data.codeExample && (
              <CodeBlock code={data.codeExample} language={data.codeLanguage} title={`${data.codeLanguage} example`} />
            )}

            {tab === 'quiz' && data.quiz && <QuizRunner lessonId={data.id} quiz={data.quiz} lessonSlug={slug} />}
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {data.previous ? (
            <Link
              to={`/learn/${data.previous.slug}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs text-ink-muted transition hover:bg-surface-overlay hover:text-ink"
            >
              <ChevronLeft size={14} />
              <span className="max-w-[16rem] truncate">{data.previous.title}</span>
            </Link>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            {data.status !== 'Completed' && (
              <Button
                variant="primary"
                loading={saveProgress.isPending}
                onClick={() => saveProgress.mutate({ status: 'Completed', videoWatched: data.videoWatched })}
                icon={<CheckCircle2 size={15} />}
              >
                Mark complete
              </Button>
            )}
            {data.next && (
              <Link
                to={`/learn/${data.next.slug}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs text-ink-muted transition hover:bg-surface-overlay hover:text-ink"
              >
                <span className="max-w-[16rem] truncate">{data.next.title}</span>
                <ChevronRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT rail */}
      <aside className="space-y-4">
        <Card>
          <CardHeader title="Key takeaways" icon={<Lightbulb size={15} />} />
          <ul className="space-y-2 card-pad">
            {data.keyTakeaways.map((item) => (
              <li key={item} className="flex gap-2 text-[12px] leading-relaxed text-ink-muted">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Your progress" />
          <div className="card-pad">
            <div className="mb-1.5 flex items-baseline justify-between text-[11px]">
              <span className="text-ink-faint">Status</span>
              <span className="text-ink">{data.status}</span>
            </div>
            <Progress value={data.status === 'Completed' ? 100 : data.status === 'InProgress' ? 50 : 0} />
            <dl className="mt-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <dt className="text-ink-faint">Time recorded</dt>
                <dd className="text-ink-muted">{minutesLabel(data.minutesSpent)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-faint">This session</dt>
                <dd className="text-ink-muted">{minutesLabel(minutesOnPage)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-faint">Video watched</dt>
                <dd className="text-ink-muted">{data.videoWatched ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </div>
        </Card>

        <NotesPanel lessonId={data.id} lessonTitle={data.title} />

        {data.relatedPractice.length > 0 && (
          <Card>
            <CardHeader title="Practise this" icon={<FileQuestion size={15} />} />
            <div className="divide-y divide-line">
              {data.relatedPractice.map((question) => (
                <Link
                  key={question.id}
                  to={`/practice/${question.id}`}
                  className="block px-4 py-3 transition hover:bg-surface-overlay"
                >
                  <p className="line-clamp-2 text-[12px] leading-relaxed text-ink-muted">
                    {question.prompt}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Badge tone="neutral">{question.mode}</Badge>
                    <span className="text-[10px] text-ink-faint">{question.estimatedMinutes} min</span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {data.resources.length > 0 && (
          <Card>
            <CardHeader title="Further reading" />
            <div className="divide-y divide-line">
              {data.resources.map((resource) => (
                <a
                  key={resource.id}
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-2 px-4 py-3 transition hover:bg-surface-overlay"
                >
                  <ExternalLink size={12} className="mt-0.5 shrink-0 text-ink-faint" />
                  <span className="min-w-0">
                    <span className="block text-[12px] text-ink-muted">{resource.title}</span>
                    <span className="block text-[10px] text-ink-faint">{resource.kind}</span>
                  </span>
                </a>
              ))}
            </div>
          </Card>
        )}
      </aside>
    </div>
  );
}

/** Extracts the video id from the URL forms an admin is likely to paste. */
function youTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function VideoPanel({ lesson, onWatched }: { lesson: LessonDetail; onWatched: () => void }) {
  const video = lesson.videos[0];
  if (!video) return null;

  const id = video.youTubeUrl ? youTubeId(video.youTubeUrl) : null;

  return (
    <Card>
      <CardHeader
        title={video.title}
        subtitle={[video.instructor, `${video.durationMinutes} min`, video.skillLevel]
          .filter(Boolean)
          .join(' · ')}
        icon={<VideoIcon size={15} />}
        action={
          id && (
            <Button size="sm" variant="secondary" onClick={onWatched} icon={<CheckCircle2 size={13} />}>
              Mark watched
            </Button>
          )
        }
      />

      {id ? (
        <div className="aspect-video w-full overflow-hidden rounded-b-2xl bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${id}`}
            title={video.title}
            className="h-full w-full"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        // No invented URLs: most lessons carry a link that was checked against
        // YouTube's oEmbed endpoint. Where none was found, send the learner to a
        // search for the topic rather than leaving them at a dead end.
        <div className="flex flex-col items-center justify-center gap-3 border-t border-line bg-surface-sunken px-6 py-10 text-center">
          <PlayCircle size={28} className="text-ink-faint" />
          <p className="text-sm text-ink-muted">No verified video linked to this lesson</p>
          <p className="max-w-md text-[11px] leading-relaxed text-ink-faint">
            This platform only embeds links it has checked, so it shows nothing here rather
            than a video that might not exist. The reading below covers the material, and an
            administrator can attach a link in Admin → Videos.
          </p>
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(lesson.title)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[11px] text-ink-muted transition hover:bg-surface-overlay hover:text-ink"
          >
            <ExternalLink size={12} />
            Search YouTube for “{lesson.title}”
          </a>
        </div>
      )}
    </Card>
  );
}

function QuizRunner({ lessonId, quiz, lessonSlug }: { lessonId: string; quiz: NonNullable<LessonDetail['quiz']>; lessonSlug: string }) {
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api.post<QuizResult>(`/lessons/${lessonId}/quiz`, {
        answers: quiz.questions.map((question) => ({
          questionId: question.id,
          selectedOptionIds: answers[question.id] ?? [],
        })),
      }),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['lesson', lessonSlug] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const toggle = (questionId: string, optionId: string, multiple: boolean) => {
    if (result) return;
    setAnswers((current) => {
      const existing = current[questionId] ?? [];
      if (!multiple) return { ...current, [questionId]: [optionId] };
      return {
        ...current,
        [questionId]: existing.includes(optionId)
          ? existing.filter((id) => id !== optionId)
          : [...existing, optionId],
      };
    });
  };

  const answered = quiz.questions.filter((q) => (answers[q.id] ?? []).length > 0).length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{quiz.title}</h3>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            {quiz.questions.length} questions · pass mark {quiz.passMarkPercent}%
          </p>
        </div>
        {result && (
          <div className="text-right">
            <p className={cn('text-2xl font-semibold tabular-nums', scoreTone(result.scorePercent))}>
              {result.scorePercent}%
            </p>
            <p className="text-[11px] text-ink-faint">
              {result.passed ? `Passed · +${result.xpAwarded} XP` : 'Below the pass mark'}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-5">
        {quiz.questions.map((question, index) => {
          const questionResult = result?.results.find((r) => r.questionId === question.id);
          const selected = answers[question.id] ?? [];

          return (
            <div key={question.id} className="rounded-xl border border-line bg-surface-sunken p-4">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-line text-[10px] text-ink-faint">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{question.prompt}</p>
                  {question.allowsMultiple && (
                    <p className="mt-0.5 text-[10px] text-ink-faint">Select all that apply</p>
                  )}
                </div>
                {questionResult && (
                  <Badge tone={questionResult.correct ? 'success' : 'danger'}>
                    {questionResult.correct ? 'Correct' : 'Incorrect'}
                  </Badge>
                )}
              </div>

              <div className="mt-3 space-y-1.5">
                {question.options.map((option) => {
                  const isSelected = selected.includes(option.id);
                  const isCorrect = questionResult?.correctOptionIds.includes(option.id);

                  return (
                    <button
                      key={option.id}
                      onClick={() => toggle(question.id, option.id, question.allowsMultiple)}
                      disabled={!!result}
                      className={cn(
                        'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] transition',
                        result
                          ? isCorrect
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                            : isSelected
                              ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                              : 'border-line text-ink-muted'
                          : isSelected
                            ? 'border-brand-500/60 bg-brand-600/15 text-ink'
                            : 'border-line text-ink-muted hover:border-line-strong hover:bg-surface-overlay',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 h-3.5 w-3.5 shrink-0 border',
                          question.allowsMultiple ? 'rounded' : 'rounded-full',
                          isSelected ? 'border-brand-400 bg-brand-500' : 'border-line-strong',
                        )}
                      />
                      {option.text}
                    </button>
                  );
                })}
              </div>

              {questionResult && (
                <p className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-ink-muted">
                  {questionResult.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[11px] text-ink-faint">
          {answered} of {quiz.questions.length} answered
        </p>
        {result ? (
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null);
              setAnswers({});
            }}
          >
            Try again
          </Button>
        ) : (
          <Button
            variant="primary"
            loading={submit.isPending}
            disabled={answered < quiz.questions.length}
            onClick={() => submit.mutate()}
          >
            Submit answers
          </Button>
        )}
      </div>
    </div>
  );
}

function NotesPanel({ lessonId, lessonTitle }: { lessonId: string; lessonTitle: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [important, setImportant] = useState(false);

  const notes = useQuery({
    queryKey: ['notes', 'lesson', lessonId],
    queryFn: () => api.get<Note[]>(`/notes?scope=Lesson&refId=${lessonId}`),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<Note>('/notes', {
        scope: 'Lesson',
        refId: lessonId,
        refTitle: lessonTitle,
        title: body.split('\n')[0].slice(0, 60),
        body,
        isImportant: important,
        isQuestion: false,
      }),
    onSuccess: () => {
      setBody('');
      setImportant(false);
      queryClient.invalidateQueries({ queryKey: ['notes', 'lesson', lessonId] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/notes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes', 'lesson', lessonId] }),
  });

  const existing = useMemo(() => notes.data ?? [], [notes.data]);

  return (
    <Card>
      <CardHeader title="Notes" subtitle={`${existing.length} on this lesson`} icon={<NotebookPen size={15} />} />
      <div className="card-pad">
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What do you want to remember from this lesson?"
          className="text-[12px]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-ink-faint">
            <input
              type="checkbox"
              checked={important}
              onChange={(e) => setImportant(e.target.checked)}
              className="accent-brand-500"
            />
            Important
          </label>
          <Button
            size="sm"
            variant="primary"
            disabled={body.trim().length === 0}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Save note
          </Button>
        </div>
      </div>

      {existing.length > 0 && (
        <div className="divide-y divide-line border-t border-line">
          {existing.map((note) => (
            <div key={note.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink-muted">
                  {note.body}
                </p>
                <button
                  onClick={() => remove.mutate(note.id)}
                  className="shrink-0 text-[10px] text-ink-faint transition hover:text-rose-300"
                >
                  Delete
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                {note.isImportant && <Badge tone="warning">Important</Badge>}
                <span className="text-[10px] text-ink-faint">{note.createdAt}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
