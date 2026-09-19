import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bookmark, CheckCircle2, Send, ThumbsDown, ThumbsUp, Timer } from 'lucide-react';
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
  Textarea,
} from '@/components/ui';
import { Markdown } from '@/components/content';
import { ReadinessBars } from '@/components/charts';
import { cn, minutesLabel, scoreTone } from '@/lib/format';
import type { PracticeDetail as PracticeDetailDto, PracticeResult } from '@/types/api';

export default function PracticeDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [answer, setAnswer] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<PracticeResult | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['practice', id],
    queryFn: () => api.get<PracticeDetailDto>(`/practice/${id}`),
  });

  useEffect(() => {
    setAnswer('');
    setResult(null);
    setSeconds(0);
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [id]);

  const submit = useMutation({
    mutationFn: () =>
      api.post<PracticeResult>(`/practice/${id}/attempt`, {
        answerText: answer,
        minutesSpent: Math.max(1, Math.round(seconds / 60)),
      }),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['practice'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const toggleBookmark = useMutation({
    mutationFn: () =>
      api.post('/bookmarks/toggle', {
        itemType: 'PracticeQuestion',
        refId: id,
        title: data!.prompt.slice(0, 80),
        subtitle: `${data!.mode} · ${data!.category}`,
        deepLink: `/practice/${id}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practice', id] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });

  if (isLoading) return <LoadingPanel label="Loading question" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  if (!data) return null;

  const words = answer.trim().split(/\s+/).filter(Boolean).length;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Practice', to: '/practice' }, { label: data.mode }]}
        title={data.category}
        description={`${data.mode} · suggested time ${minutesLabel(data.estimatedMinutes)}`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/practice')} icon={<ArrowLeft size={14} />}>
              All questions
            </Button>
            <Button
              variant={data.isBookmarked ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => toggleBookmark.mutate()}
              icon={<Bookmark size={14} />}
            >
              {data.isBookmarked ? 'Saved' : 'Bookmark'}
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader
              title="Question"
              action={
                <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-faint">
                  <Timer size={12} />
                  {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
                </span>
              }
            />
            <div className="card-pad">
              <p className="text-[15px] leading-relaxed text-ink">{data.prompt}</p>
              {data.scenario && (
                <div className="mt-4 rounded-xl border border-line bg-surface-sunken p-4">
                  <p className="label mb-1.5">Scenario</p>
                  <p className="text-[13px] leading-relaxed text-ink-muted">{data.scenario}</p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Your answer"
              subtitle={`${words} words${words < 120 ? ' — aim for 150–400 to show reasoning' : ''}`}
            />
            <div className="card-pad">
              <Textarea
                rows={14}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!result}
                placeholder="Structure your answer: assumptions, architecture, security, scale, cost, failure modes, and the alternatives you rejected."
                className="font-[inherit] text-[13px] leading-relaxed"
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-ink-faint">
                  {data.bestScore !== undefined && data.bestScore !== null
                    ? `Your best so far: ${data.bestScore}%`
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
                    icon={<Send size={15} />}
                  >
                    Submit for review
                  </Button>
                )}
              </div>

              {submit.isError && (
                <div className="mt-3">
                  <ErrorPanel message={(submit.error as Error).message} />
                </div>
              )}
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
                      <p className="label mb-2 inline-flex items-center gap-1.5 text-emerald-300">
                        <ThumbsUp size={12} /> Strengths
                      </p>
                      <ul className="space-y-1.5">
                        {result.strengths.map((item) => (
                          <li key={item} className="text-[12px] leading-relaxed text-ink-muted">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="label mb-2 inline-flex items-center gap-1.5 text-amber-300">
                        <ThumbsDown size={12} /> To improve
                      </p>
                      <ul className="space-y-1.5">
                        {result.weaknesses.map((item) => (
                          <li key={item} className="text-[12px] leading-relaxed text-ink-muted">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-200">
                    <CheckCircle2 size={12} className="mr-1.5 inline" />
                    +{result.xpAwarded} XP recorded
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="A strong answer"
                  subtitle="Compare structure and specificity, not wording"
                />
                <div className="card-pad">
                  <Markdown>{result.modelAnswer}</Markdown>
                </div>
              </Card>
            </>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="What is being assessed" />
            <div className="space-y-3 card-pad">
              {data.rubric.length === 0 && (
                <p className="text-xs text-ink-faint">
                  This question is scored on the platform's standard six dimensions: architecture,
                  security, scalability, cost, reliability and AI design.
                </p>
              )}
              {data.rubric.map((dimension) => (
                <div key={dimension.dimension}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[12px] font-medium text-ink">{dimension.dimension}</p>
                    <span className="text-[10px] text-ink-faint">
                      {Math.round(dimension.weight * 100)}%
                    </span>
                  </div>
                  {dimension.guidance && (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">
                      {dimension.guidance}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {data.tags && (
            <Card>
              <CardHeader title="Topics" />
              <div className="card-pad">
                <div className="flex flex-wrap gap-1.5">
                  {data.tags.split(',').map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          )}

          <Disclaimer>
            The review is a deterministic rubric check, not a human or model assessment. Use it to
            spot what you left out; use the model answer to judge quality.
          </Disclaimer>
        </div>
      </div>
    </>
  );
}
