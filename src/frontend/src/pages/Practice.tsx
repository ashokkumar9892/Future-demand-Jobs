import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Search, Target } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Card, Disclaimer, EmptyState, ErrorPanel, Input, LoadingPanel, Stat, Tabs } from '@/components/ui';
import { cn, scoreTone } from '@/lib/format';
import type { PracticeListItem } from '@/types/api';

const MODES = [
  { key: 'All', label: 'All' },
  { key: 'Easy', label: 'Easy' },
  { key: 'Medium', label: 'Medium' },
  { key: 'Hard', label: 'Hard' },
  { key: 'Architect', label: 'Architect' },
  { key: 'Interview', label: 'Interview' },
  { key: 'Scenario', label: 'Scenario' },
] as const;

const MODE_TONE: Record<string, string> = {
  Easy: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  Medium: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  Hard: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  Architect: 'border-accent-500/40 bg-accent-500/10 text-accent-400',
  Interview: 'border-brand-500/40 bg-brand-500/10 text-brand-300',
  Scenario: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

export default function Practice() {
  const [mode, setMode] = useState<string>('All');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['practice', mode],
    queryFn: () => api.get<PracticeListItem[]>(`/practice${mode === 'All' ? '' : `?mode=${mode}`}`),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (q) => q.prompt.toLowerCase().includes(term) || q.tags.toLowerCase().includes(term),
    );
  }, [data, search]);

  const attempted = filtered.filter((q) => q.attemptCount > 0);
  const averageBest =
    attempted.length > 0
      ? Math.round(attempted.reduce((sum, q) => sum + (q.bestScore ?? 0), 0) / attempted.length)
      : 0;

  return (
    <>
      <PageHeader
        title="Practice"
        description="Written answers scored against a rubric. Short answers score badly on purpose — an architect's answer needs context, options, decision and trade-offs."
        actions={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter questions"
              className="w-56 pl-9"
            />
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="card-pad">
          <Stat label="Questions" value={filtered.length} detail={`${MODES.length - 1} modes`} />
        </Card>
        <Card className="card-pad">
          <Stat label="Attempted" value={`${attempted.length} / ${filtered.length}`} />
        </Card>
        <Card className="card-pad">
          <Stat
            label="Average best score"
            value={`${averageBest}%`}
            tone={scoreTone(averageBest)}
            detail="across attempted questions"
          />
        </Card>
      </div>

      <div className="mb-5">
        <Tabs tabs={MODES.map((m) => ({ key: m.key, label: m.label }))} active={mode} onChange={setMode} />
      </div>

      {isLoading && <LoadingPanel label="Loading practice questions" />}
      {error && <ErrorPanel message={(error as Error).message} />}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={<ClipboardList size={26} />}
          title="No questions match that filter"
          description="Try a different mode or clear the search."
        />
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((question) => (
          <Link
            key={question.id}
            to={`/practice/${question.id}`}
            className="group rounded-2xl border border-line bg-surface-raised p-4 shadow-card transition hover:border-line-strong hover:shadow-lift"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-[10px] font-medium',
                    MODE_TONE[question.mode] ?? MODE_TONE.Medium,
                  )}
                >
                  {question.mode}
                </span>
                <Badge tone="neutral">{question.category}</Badge>
              </div>
              {question.bestScore !== undefined && question.bestScore !== null && (
                <span className={cn('shrink-0 text-sm font-semibold tabular-nums', scoreTone(question.bestScore))}>
                  {question.bestScore}%
                </span>
              )}
            </div>

            <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-ink-muted transition group-hover:text-ink">
              {question.prompt}
            </p>

            <div className="mt-3 flex items-center justify-between text-[11px] text-ink-faint">
              <span className="inline-flex items-center gap-1">
                <Target size={11} />
                {question.estimatedMinutes} min
              </span>
              <span>
                {question.attemptCount === 0
                  ? 'Not attempted'
                  : `${question.attemptCount} attempt${question.attemptCount === 1 ? '' : 's'}`}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <Disclaimer className="mt-6">
        Answers are reviewed automatically against a rubric — keyword coverage, structure and depth.
        This is not a human or model-graded assessment, and a strong answer that uses different
        vocabulary may score lower than it deserves. Compare against the model answer.
      </Disclaimer>
    </>
  );
}
