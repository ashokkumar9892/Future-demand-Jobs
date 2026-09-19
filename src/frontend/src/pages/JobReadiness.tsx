import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Gauge } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Card, CardHeader, Disclaimer, ErrorPanel, LoadingPanel, Stat } from '@/components/ui';
import { ProgressRing, ReadinessBars } from '@/components/charts';
import { cn } from '@/lib/format';
import type { CareerReadiness } from '@/types/api';

const VERDICT_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  Ready: 'success',
  AlmostReady: 'warning',
  NeedsTraining: 'danger',
};

export default function JobReadiness() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['readiness'],
    queryFn: () => api.get<CareerReadiness[]>('/readiness'),
  });

  if (isLoading) return <LoadingPanel label="Calculating readiness" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  if (!data) return null;

  const ranked = [...data].sort((a, b) => b.overall - a.overall);
  const top = ranked[0];
  const ready = data.filter((c) => c.verdict === 'Ready').length;
  const almost = data.filter((c) => c.verdict === 'AlmostReady').length;

  return (
    <>
      <PageHeader
        title="Job readiness"
        description="Derived from measured activity only: completed lessons, quiz results, scored practice and finished project milestones. Editing your skill matrix does not move these numbers."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <Card className="card-pad">
          <Stat label="Strongest fit" value={top?.careerTitle ?? '—'} detail={`${top?.overall ?? 0}% overall`} />
        </Card>
        <Card className="card-pad">
          <Stat label="Ready" value={ready} detail="80% and above" />
        </Card>
        <Card className="card-pad">
          <Stat label="Almost ready" value={almost} detail="60–79%" />
        </Card>
        <Card className="card-pad">
          <Stat label="Careers assessed" value={data.length} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {ranked.map((career) => (
          <Card key={career.careerPathId}>
            <CardHeader
              title={
                <Link to={`/careers/${career.careerSlug}`} className="transition hover:text-brand-300">
                  {career.careerTitle}
                </Link>
              }
              subtitle={`Rank ${career.rank} · ${career.dimensions.length} dimensions`}
              icon={<Gauge size={15} />}
              action={<Badge tone={VERDICT_TONE[career.verdict]}>{career.verdictLabel}</Badge>}
            />
            <div className="card-pad">
              <div className="flex items-center gap-5">
                <ProgressRing value={career.overall} size={84} stroke={7} />
                <div className="min-w-0 flex-1">
                  <ReadinessBars
                    data={career.dimensions.slice(0, 4).map((d) => ({
                      name: d.name,
                      score: d.score,
                      weight: d.weight,
                    }))}
                  />
                </div>
              </div>

              {career.dimensions.length > 4 && (
                <div className="mt-4 border-t border-line pt-4">
                  <ReadinessBars
                    data={career.dimensions.slice(4).map((d) => ({
                      name: d.name,
                      score: d.score,
                      weight: d.weight,
                    }))}
                  />
                </div>
              )}

              <p
                className={cn(
                  'mt-4 rounded-lg border px-3 py-2 text-[11px] leading-relaxed',
                  career.verdict === 'Ready'
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200'
                    : career.verdict === 'AlmostReady'
                      ? 'border-amber-500/30 bg-amber-500/5 text-amber-200'
                      : 'border-line bg-surface-sunken text-ink-faint',
                )}
              >
                {career.verdict === 'Ready'
                  ? 'Your measured progress covers this role well. Start applying and treat early interviews as calibration.'
                  : career.verdict === 'AlmostReady'
                    ? 'Close. Applying now is reasonable if you treat the first interviews as diagnostics.'
                    : 'Keep building evidence. The weakest dimensions above are where the next hours pay most.'}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <Disclaimer className="mt-6">
        {data[0]?.disclaimer ??
          'Readiness reflects measured learning progress and assessment performance on this platform. It is not a professional qualification and does not certify job competence.'}
      </Disclaimer>
    </>
  );
}
