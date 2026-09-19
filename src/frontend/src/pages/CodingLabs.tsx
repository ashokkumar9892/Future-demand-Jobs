import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Code2, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Card, Disclaimer, ErrorPanel, Input, LoadingPanel, Stat } from '@/components/ui';
import { cn, scoreTone } from '@/lib/format';
import type { CodingExerciseListItem } from '@/types/api';

export default function CodingLabs() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const exercises = useQuery({
    queryKey: ['coding-exercises'],
    queryFn: () => api.get<CodingExerciseListItem[]>('/coding-exercises'),
  });

  const categories = useMemo(() => {
    const set = new Set((exercises.data ?? []).map((e) => e.category));
    return ['All', ...Array.from(set).sort()];
  }, [exercises.data]);

  const filtered = useMemo(() => {
    let list = exercises.data ?? [];
    if (category !== 'All') list = list.filter((e) => e.category === category);
    const term = search.trim().toLowerCase();
    if (term) list = list.filter((e) => e.title.toLowerCase().includes(term));
    return list;
  }, [exercises.data, category, search]);

  const passed = (exercises.data ?? []).filter((e) => e.passed).length;

  return (
    <>
      <PageHeader
        title="Coding labs"
        description="Browser-based exercises across the stack you will actually be asked about. Submissions are checked against the constructs each exercise requires."
        actions={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter exercises"
              className="w-56 pl-9"
            />
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="card-pad">
          <Stat label="Exercises" value={exercises.data?.length ?? 0} detail={`${categories.length - 1} categories`} />
        </Card>
        <Card className="card-pad">
          <Stat label="Passed" value={`${passed} / ${exercises.data?.length ?? 0}`} />
        </Card>
        <Card className="card-pad">
          <Stat
            label="Coverage"
            value={`${exercises.data?.length ? Math.round((passed / exercises.data.length) * 100) : 0}%`}
          />
        </Card>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition',
              category === c
                ? 'border-brand-500/60 bg-brand-600/15 text-ink'
                : 'border-line text-ink-faint hover:text-ink-muted',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {exercises.isLoading && <LoadingPanel label="Loading exercises" />}
      {exercises.error && <ErrorPanel message={(exercises.error as Error).message} />}

      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((exercise) => (
          <Link
            key={exercise.id}
            to={`/coding-labs/${exercise.slug}`}
            className="group rounded-2xl border border-line bg-surface-raised p-4 shadow-card transition hover:border-line-strong hover:shadow-lift"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Code2 size={15} className="text-brand-400" />
                <Badge tone="neutral">{exercise.category}</Badge>
              </div>
              {exercise.passed ? (
                <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              ) : exercise.bestScore !== undefined && exercise.bestScore !== null ? (
                <span className={cn('text-xs font-semibold tabular-nums', scoreTone(exercise.bestScore))}>
                  {exercise.bestScore}%
                </span>
              ) : null}
            </div>

            <h3 className="mt-2.5 text-sm font-medium text-ink transition group-hover:text-brand-300">
              {exercise.title}
            </h3>

            <div className="mt-3 flex items-center justify-between text-[11px] text-ink-faint">
              <span>
                {exercise.difficulty} · {exercise.language}
              </span>
              <span>{exercise.estimatedMinutes} min</span>
            </div>
          </Link>
        ))}
      </div>

      <Disclaimer className="mt-6">
        Submissions are checked statically against the constructs each exercise requires. Code is
        not executed in this build — wiring a sandboxed runner behind the same endpoint is a
        documented next step.
      </Disclaimer>
    </>
  );
}
