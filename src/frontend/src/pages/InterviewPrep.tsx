import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Lightbulb, MessagesSquare, Send, Timer } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Disclaimer,
  ErrorPanel,
  LoadingPanel,
  Stat,
  Tabs,
  Textarea,
} from '@/components/ui';
import { Markdown } from '@/components/content';
import { ReadinessBars } from '@/components/charts';
import { cn, scoreTone } from '@/lib/format';
import type {
  InterviewQuestionDetail,
  InterviewQuestionListItem,
  InterviewResult,
} from '@/types/api';

const CATEGORIES = [
  { key: 'All', label: 'All' },
  { key: 'Technical', label: 'Technical' },
  { key: 'Architecture', label: 'Architecture' },
  { key: 'SystemDesign', label: 'System Design' },
  { key: 'Ai', label: 'AI' },
  { key: 'Cloud', label: 'Cloud' },
  { key: 'Coding', label: 'Coding' },
  { key: 'Behavioral', label: 'Behavioural' },
];

export default function InterviewPrep() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState('All');
  const [selectedId, setSelectedId] = useState<string | null>(params.get('question'));

  const list = useQuery({
    queryKey: ['interview-questions', category],
    queryFn: () =>
      api.get<InterviewQuestionListItem[]>(
        `/interview/questions${category === 'All' ? '' : `?category=${category}`}`,
      ),
  });

  useEffect(() => {
    if (!selectedId && list.data && list.data.length > 0) setSelectedId(list.data[0].id);
  }, [list.data, selectedId]);

  const select = (id: string) => {
    setSelectedId(id);
    const next = new URLSearchParams(params);
    next.set('question', id);
    setParams(next, { replace: true });
  };

  const attempted = (list.data ?? []).filter((q) => q.attemptCount > 0);
  const average =
    attempted.length > 0
      ? Math.round(attempted.reduce((sum, q) => sum + (q.bestScore ?? 0), 0) / attempted.length)
      : 0;

  return (
    <>
      <PageHeader
        title="Interview preparation"
        description="Answer under a timer, then compare with a strong response. The dimensions you are scored on are the ones a panel actually probes."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="card-pad">
          <Stat label="Questions" value={list.data?.length ?? 0} detail={`${CATEGORIES.length - 1} categories`} />
        </Card>
        <Card className="card-pad">
          <Stat label="Attempted" value={`${attempted.length} / ${list.data?.length ?? 0}`} />
        </Card>
        <Card className="card-pad">
          <Stat label="Average best" value={`${average}%`} tone={scoreTone(average)} />
        </Card>
      </div>

      <div className="mb-5">
        <Tabs tabs={CATEGORIES} active={category} onChange={setCategory} />
      </div>

      {list.isLoading && <LoadingPanel label="Loading questions" />}
      {list.error && <ErrorPanel message={(list.error as Error).message} />}

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Questions" subtitle={`${list.data?.length ?? 0} in this category`} icon={<MessagesSquare size={15} />} />
          <div className="max-h-[70vh] divide-y divide-line overflow-y-auto">
            {(list.data ?? []).map((question) => (
              <button
                key={question.id}
                onClick={() => select(question.id)}
                className={cn(
                  'block w-full px-4 py-3 text-left transition',
                  selectedId === question.id ? 'bg-brand-600/12' : 'hover:bg-surface-overlay',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge tone="neutral">{question.category}</Badge>
                  {question.bestScore !== undefined && question.bestScore !== null && (
                    <span className={cn('text-[11px] font-semibold tabular-nums', scoreTone(question.bestScore))}>
                      {question.bestScore}%
                    </span>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-ink-muted">
                  {question.question}
                </p>
                <p className="mt-1 text-[10px] text-ink-faint">
                  {Math.round(question.timeLimitSeconds / 60)} min · {question.difficulty}
                </p>
              </button>
            ))}
          </div>
        </Card>

        {selectedId ? (
          <QuestionPanel
            id={selectedId}
            onAnswered={() => {
              queryClient.invalidateQueries({ queryKey: ['interview-questions'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            }}
          />
        ) : (
          <Card className="card-pad">
            <p className="text-sm text-ink-faint">Select a question to begin.</p>
          </Card>
        )}
      </div>
    </>
  );
}

function QuestionPanel({ id, onAnswered }: { id: string; onAnswered: () => void }) {
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<InterviewResult | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['interview-question', id],
    queryFn: () => api.get<InterviewQuestionDetail>(`/interview/questions/${id}`),
  });

  useEffect(() => {
    setAnswer('');
    setResult(null);
    setSeconds(0);
    setRunning(false);
  }, [id]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  const submit = useMutation({
    mutationFn: () =>
      api.post<InterviewResult>(`/interview/questions/${id}/attempt`, {
        answerText: answer,
        secondsTaken: seconds,
      }),
    onSuccess: (payload) => {
      setResult(payload);
      setRunning(false);
      onAnswered();
    },
  });

  const toggleBookmark = useMutation({
    mutationFn: () =>
      api.post('/bookmarks/toggle', {
        itemType: 'InterviewQuestion',
        refId: id,
        title: data!.question.slice(0, 80),
        subtitle: data!.category,
        deepLink: `/interview-prep?question=${id}`,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['interview-question', id] }),
  });

  if (isLoading) return <LoadingPanel label="Loading question" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  if (!data) return null;

  const remaining = data.timeLimitSeconds - seconds;
  const overtime = remaining < 0;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={`${data.category} · ${data.difficulty}`}
          action={
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 font-mono text-[12px] tabular-nums',
                  overtime ? 'text-rose-300' : 'text-ink-muted',
                )}
              >
                <Timer size={12} />
                {overtime ? '+' : ''}
                {Math.floor(Math.abs(remaining) / 60)}:
                {String(Math.abs(remaining) % 60).padStart(2, '0')}
              </span>
              <Button
                size="sm"
                variant={data.isBookmarked ? 'primary' : 'secondary'}
                onClick={() => toggleBookmark.mutate()}
                icon={<Bookmark size={13} />}
              >
                {data.isBookmarked ? 'Saved' : 'Save'}
              </Button>
            </div>
          }
        />
        <div className="card-pad">
          <p className="text-[15px] leading-relaxed text-ink">{data.question}</p>

          {data.tips && (
            <div className="mt-4 flex gap-2.5 rounded-xl border border-brand-500/25 bg-brand-600/8 p-3.5">
              <Lightbulb size={14} className="mt-0.5 shrink-0 text-brand-400" />
              <p className="text-[12px] leading-relaxed text-ink-muted">{data.tips}</p>
            </div>
          )}

          {data.followUps.length > 0 && (
            <div className="mt-4">
              <p className="label mb-1.5">Likely follow-ups</p>
              <ul className="space-y-1">
                {data.followUps.map((followUp) => (
                  <li key={followUp} className="text-[12px] text-ink-faint">
                    — {followUp}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Your answer"
          subtitle={`${answer.trim().split(/\s+/).filter(Boolean).length} words`}
          action={
            !running &&
            !result && (
              <Button size="sm" variant="secondary" onClick={() => setRunning(true)} icon={<Timer size={13} />}>
                Start timer
              </Button>
            )
          }
        />
        <div className="card-pad">
          <Textarea
            rows={12}
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              if (!running && !result) setRunning(true);
            }}
            disabled={!!result}
            placeholder="Speak it out loud first, then type what you actually said. That is what makes this useful."
            className="text-[13px] leading-relaxed"
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-ink-faint">
              {data.bestScore !== undefined && data.bestScore !== null
                ? `Best so far: ${data.bestScore}%`
                : 'Not attempted yet'}
            </p>
            {result ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setResult(null);
                  setAnswer('');
                  setSeconds(0);
                }}
              >
                Try again
              </Button>
            ) : (
              <Button
                variant="primary"
                loading={submit.isPending}
                disabled={answer.trim().length < 10}
                onClick={() => submit.mutate()}
                icon={<Send size={14} />}
              >
                Submit
              </Button>
            )}
          </div>
        </div>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader
              title="Review"
              subtitle={result.evaluationMethod}
              action={
                <span className={cn('text-2xl font-semibold tabular-nums', scoreTone(result.score))}>
                  {result.score}%
                </span>
              }
            />
            <div className="card-pad">
              <ReadinessBars
                data={result.dimensions.map((d) => ({
                  name: d.dimension,
                  score: d.score,
                  weight: d.weight,
                }))}
              />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="label mb-2 text-emerald-300">Strengths</p>
                  <ul className="space-y-1.5">
                    {result.strengths.map((item) => (
                      <li key={item} className="text-[12px] leading-relaxed text-ink-muted">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="label mb-2 text-amber-300">To improve</p>
                  <ul className="space-y-1.5">
                    {result.weaknesses.map((item) => (
                      <li key={item} className="text-[12px] leading-relaxed text-ink-muted">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="A strong response" />
            <div className="card-pad">
              <Markdown>{result.suggestedAnswer}</Markdown>
            </div>
          </Card>
        </>
      )}

      <Disclaimer>
        Scoring is a deterministic rubric check, not a human assessment. It is useful for spotting
        omissions; judge delivery by reading your answer back out loud.
      </Disclaimer>
    </div>
  );
}
