import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Network } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Card, Disclaimer, ErrorPanel, LoadingPanel, Stat } from '@/components/ui';
import { cn, scoreTone } from '@/lib/format';
import type { ArchitectureChallengeListItem } from '@/types/api';

export default function ArchitectureLab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['architecture-challenges'],
    queryFn: () => api.get<ArchitectureChallengeListItem[]>('/architecture-challenges'),
  });

  const attempted = (data ?? []).filter((c) => c.bestScore !== undefined && c.bestScore !== null);
  const best = attempted.length > 0 ? Math.max(...attempted.map((c) => c.bestScore ?? 0)) : 0;

  return (
    <>
      <PageHeader
        title="Architecture lab"
        description="Realistic scenarios with real constraints. Choose each component, then compare against a suggested architecture and the reasoning behind it."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="card-pad">
          <Stat label="Challenges" value={data?.length ?? 0} />
        </Card>
        <Card className="card-pad">
          <Stat label="Attempted" value={`${attempted.length} / ${data?.length ?? 0}`} />
        </Card>
        <Card className="card-pad">
          <Stat label="Best score" value={`${best}%`} tone={scoreTone(best)} />
        </Card>
      </div>

      {isLoading && <LoadingPanel label="Loading challenges" />}
      {error && <ErrorPanel message={(error as Error).message} />}

      <div className="grid gap-4 lg:grid-cols-2">
        {(data ?? []).map((challenge) => (
          <Link
            key={challenge.id}
            to={`/architecture-lab/${challenge.id}`}
            className="group rounded-2xl border border-line bg-surface-raised p-5 shadow-card transition hover:border-line-strong hover:shadow-lift"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Network size={15} className="text-accent-400" />
                <Badge tone={challenge.difficulty === 'Expert' ? 'danger' : 'info'}>
                  {challenge.difficulty}
                </Badge>
              </div>
              {challenge.bestScore !== undefined && challenge.bestScore !== null && (
                <span className={cn('text-sm font-semibold tabular-nums', scoreTone(challenge.bestScore))}>
                  {challenge.bestScore}%
                </span>
              )}
            </div>

            <h3 className="mt-2.5 text-sm font-semibold tracking-tight text-ink transition group-hover:text-brand-300">
              {challenge.title}
            </h3>
            <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-ink-muted">
              {challenge.scenario}
            </p>

            <p className="mt-3 text-[11px] text-ink-faint">~{challenge.estimatedMinutes} minutes</p>
          </Link>
        ))}
      </div>

      <Disclaimer className="mt-6">
        Architecture rarely has exactly one right answer. A defensible alternative earns most of the
        credit, and the rationale explains why the suggested choice was preferred for these specific
        constraints.
      </Disclaimer>
    </>
  );
}
