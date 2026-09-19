import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Target } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Card, CardHeader, Disclaimer, ErrorPanel, LoadingPanel, Stat, Tabs } from '@/components/ui';
import { SkillRadar } from '@/components/charts';
import { cn } from '@/lib/format';
import type { SkillMatrix, SkillMatrixRow } from '@/types/api';

export default function Skills() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('All');

  const { data, isLoading, error } = useQuery({
    queryKey: ['skill-matrix'],
    queryFn: () => api.get<SkillMatrix>('/skills/matrix'),
  });

  const update = useMutation({
    mutationFn: (payload: { skillId: string; currentLevel: number }) =>
      api.put<SkillMatrix>('/skills/mine', payload),
    onSuccess: (payload) => {
      queryClient.setQueryData(['skill-matrix'], payload);
      queryClient.invalidateQueries({ queryKey: ['careers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const categories = useMemo(() => {
    const set = new Set((data?.rows ?? []).map((r) => r.category));
    return ['All', 'Required', ...Array.from(set).sort()];
  }, [data?.rows]);

  const rows = useMemo(() => {
    let list = data?.rows ?? [];
    if (category === 'Required') list = list.filter((r) => r.target > 0);
    else if (category !== 'All') list = list.filter((r) => r.category === category);
    return list;
  }, [data?.rows, category]);

  const radar = useMemo(
    () =>
      (data?.rows ?? [])
        .filter((r) => r.target > 0)
        .sort((a, b) => b.target - a.target)
        .slice(0, 10)
        .map((r) => ({ skill: r.name.split(' /')[0], current: r.current, target: r.target })),
    [data?.rows],
  );

  if (isLoading) return <LoadingPanel label="Loading skill matrix" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  if (!data) return null;

  const biggestGaps = [...(data.rows ?? [])]
    .filter((r) => r.target > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="Skill matrix"
        description={
          data.careerTitle
            ? `Your current level against the targets for ${data.careerTitle}. Targets come from the career; the Current column is yours to edit.`
            : 'Your current levels. Choose a target career to see the required targets.'
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <Card className="card-pad">
          <Stat label="Skills tracked" value={data.rows.length} />
        </Card>
        <Card className="card-pad">
          <Stat label="Average current" value={data.averageCurrent} />
        </Card>
        <Card className="card-pad">
          <Stat label="Average target" value={data.averageTarget} detail="for required skills" />
        </Card>
        <Card className="card-pad">
          <Stat
            label="Largest gap"
            value={biggestGaps[0] ? `${biggestGaps[0].gap} pts` : '—'}
            detail={biggestGaps[0]?.name}
          />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-4">
            <Tabs
              tabs={categories.map((c) => ({ key: c, label: c }))}
              active={category}
              onChange={setCategory}
            />
          </div>

          <Card>
            <CardHeader
              title="Current against target"
              subtitle="Drag a slider to update your self-assessment"
              icon={<Target size={15} />}
            />
            <div className="divide-y divide-line">
              <div className="hidden grid-cols-[minmax(0,1fr)_64px_64px_1fr] gap-3 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint sm:grid">
                <span>Skill</span>
                <span className="text-right">Current</span>
                <span className="text-right">Target</span>
                <span>Adjust</span>
              </div>

              {rows.map((row) => (
                <SkillRow
                  key={row.skillId}
                  row={row}
                  onChange={(level) => update.mutate({ skillId: row.skillId, currentLevel: level })}
                />
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Radar" subtitle="Top ten required skills" />
            <div className="p-4">
              <SkillRadar data={radar} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Where the next hours pay most" />
            <div className="divide-y divide-line">
              {biggestGaps.map((row) => (
                <div key={row.skillId} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-ink">{row.name}</p>
                    <p className="text-[11px] text-ink-faint">{row.importance}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-300">
                    +{row.gap}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Disclaimer>
            These levels are your own assessment. They shape what the platform recommends, but they
            deliberately do not feed the Job Readiness score — that is computed only from completed
            work, so it cannot be inflated here.
          </Disclaimer>
        </div>
      </div>
    </>
  );
}

function SkillRow({ row, onChange }: { row: SkillMatrixRow; onChange: (level: number) => void }) {
  const [value, setValue] = useState(row.current);

  return (
    <div className="grid grid-cols-1 items-center gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_64px_64px_1fr] sm:gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] text-ink">{row.name}</p>
          {row.importance === 'Core' && <Badge tone="brand">Core</Badge>}
        </div>
        <p className="text-[11px] text-ink-faint">{row.category}</p>
      </div>

      <span className="text-right text-sm tabular-nums text-ink sm:text-right">{value}</span>
      <span
        className={cn(
          'text-right text-sm tabular-nums sm:text-right',
          row.target === 0 ? 'text-ink-faint' : value >= row.target ? 'text-emerald-300' : 'text-amber-300',
        )}
      >
        {row.target || '—'}
      </span>

      <div className="relative">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          onMouseUp={() => onChange(value)}
          onTouchEnd={() => onChange(value)}
          onKeyUp={() => onChange(value)}
          className="w-full accent-brand-500"
        />
        {row.target > 0 && (
          <span
            className="pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-accent-400"
            style={{ left: `${row.target}%` }}
            title={`Target ${row.target}`}
          />
        )}
      </div>
    </div>
  );
}
