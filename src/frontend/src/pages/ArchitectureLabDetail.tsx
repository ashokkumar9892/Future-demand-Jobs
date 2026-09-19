import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ClipboardCheck, MinusCircle, Send, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Button, Card, CardHeader, Disclaimer, ErrorPanel, LoadingPanel } from '@/components/ui';
import { MermaidDiagram } from '@/components/content';
import { cn, scoreTone } from '@/lib/format';
import type { ArchitectureChallengeDetail, ArchitectureResult } from '@/types/api';

export default function ArchitectureLabDetail() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();

  const [selections, setSelections] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ArchitectureResult | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['architecture-challenge', id],
    queryFn: () => api.get<ArchitectureChallengeDetail>(`/architecture-challenges/${id}`),
  });

  useEffect(() => {
    setSelections({});
    setResult(null);
  }, [id]);

  const submit = useMutation({
    mutationFn: () =>
      api.post<ArchitectureResult>(`/architecture-challenges/${id}/attempt`, { selections }),
    onSuccess: (payload) => {
      setResult(payload);
      queryClient.invalidateQueries({ queryKey: ['architecture-challenges'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  if (isLoading) return <LoadingPanel label="Loading challenge" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  if (!data) return null;

  const answered = Object.keys(selections).length;
  const complete = answered === data.choiceGroups.length;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Architecture lab', to: '/architecture-lab' }, { label: data.difficulty }]}
        title={data.title}
        description={`~${data.estimatedMinutes} minutes · ${data.choiceGroups.length} decisions`}
        actions={
          <Link
            to="/architecture-lab"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs text-ink-muted transition hover:bg-surface-overlay hover:text-ink"
          >
            <ArrowLeft size={14} />
            All challenges
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader title="Scenario" />
            <div className="card-pad">
              <p className="text-[14px] leading-relaxed text-ink-muted">{data.scenario}</p>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Your decisions"
              subtitle={`${answered} of ${data.choiceGroups.length} chosen`}
              action={
                result ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setResult(null);
                      setSelections({});
                    }}
                  >
                    Try again
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!complete}
                    loading={submit.isPending}
                    onClick={() => submit.mutate()}
                    icon={<Send size={13} />}
                  >
                    Compare
                  </Button>
                )
              }
            />
            <div className="divide-y divide-line">
              {data.choiceGroups.map((group) => {
                const outcome = result?.groups.find((g) => g.key === group.key);
                return (
                  <div key={group.key} className="px-5 py-4">
                    <div className="mb-2.5 flex items-center justify-between gap-3">
                      <p className="text-[13px] font-medium text-ink">{group.label}</p>
                      {outcome && (
                        <Badge tone={outcome.matched ? 'success' : outcome.acceptable ? 'warning' : 'danger'}>
                          {outcome.matched ? 'Matched' : outcome.acceptable ? 'Defensible' : 'Differs'}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {group.options.map((option) => {
                        const chosen = selections[group.key] === option;
                        const isSuggested = outcome?.suggestedChoice === option;

                        return (
                          <button
                            key={option}
                            disabled={!!result}
                            onClick={() => setSelections((s) => ({ ...s, [group.key]: option }))}
                            className={cn(
                              'rounded-lg border px-3 py-1.5 text-[12px] transition',
                              result
                                ? isSuggested
                                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                                  : chosen
                                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                                    : 'border-line text-ink-faint'
                                : chosen
                                  ? 'border-brand-500/60 bg-brand-600/15 text-ink'
                                  : 'border-line text-ink-muted hover:border-line-strong hover:bg-surface-overlay',
                            )}
                          >
                            {option}
                            {result && isSuggested && ' ✓'}
                          </button>
                        );
                      })}
                    </div>

                    {outcome?.rationale && (
                      <p className="mt-3 border-l-2 border-brand-500/40 pl-3 text-[12px] leading-relaxed text-ink-muted">
                        {outcome.rationale}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {result && (
            <Card>
              <CardHeader
                title="Why this architecture"
                action={
                  <span className={cn('text-2xl font-semibold tabular-nums', scoreTone(result.score))}>
                    {result.score}%
                  </span>
                }
              />
              <div className="card-pad">
                <div className="mb-4 flex flex-wrap gap-3 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-emerald-300">
                    <CheckCircle2 size={12} />
                    {result.groups.filter((g) => g.matched).length} matched
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-amber-300">
                    <MinusCircle size={12} />
                    {result.groups.filter((g) => g.acceptable).length} defensible
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-rose-300">
                    <XCircle size={12} />
                    {result.groups.filter((g) => !g.matched && !g.acceptable).length} differ
                  </span>
                  <Badge tone="brand">+{result.xpAwarded} XP</Badge>
                </div>

                <p className="text-[13px] leading-relaxed text-ink-muted">{result.rationale}</p>

                {result.diagramMermaid && (
                  <div className="mt-5">
                    <p className="label mb-2">Suggested architecture</p>
                    <MermaidDiagram chart={result.diagramMermaid} />
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Requirements" icon={<ClipboardCheck size={15} />} />
            <ul className="space-y-2 card-pad">
              {data.requirements.map((requirement) => (
                <li key={requirement} className="flex gap-2 text-[12px] leading-relaxed text-ink-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-400" />
                  {requirement}
                </li>
              ))}
            </ul>
          </Card>

          {data.bestScore !== undefined && data.bestScore !== null && (
            <Card className="card-pad">
              <p className="label">Your best score</p>
              <p className={cn('stat-value mt-1', scoreTone(data.bestScore))}>{data.bestScore}%</p>
            </Card>
          )}

          <Disclaimer>
            A defensible alternative earns 70% of the credit for that decision. The rationale
            explains why the suggested option fits these constraints specifically — change the
            constraints and the answer changes.
          </Disclaimer>
        </div>
      </div>
    </>
  );
}
