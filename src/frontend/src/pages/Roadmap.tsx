import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, CheckCircle2, Circle, CircleDot, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Card, CardHeader, Disclaimer, ErrorPanel, LoadingPanel, Progress, Stat } from '@/components/ui';
import { CompProgression } from '@/components/charts';
import { cn, money } from '@/lib/format';
import type { Roadmap as RoadmapDto } from '@/types/api';

export default function Roadmap() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['roadmap'],
    queryFn: () => api.get<RoadmapDto>('/roadmap'),
  });

  if (isLoading) return <LoadingPanel label="Building your roadmap" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  if (!data) return null;

  return (
    <>
      <PageHeader
        title="My roadmap"
        description={
          <span>
            From <span className="text-ink">{data.currentRole}</span> to{' '}
            <Link to={`/careers/${data.targetCareerSlug}`} className="link font-medium">
              {data.targetCareerTitle}
            </Link>{' '}
            · {data.targetSalaryRange}
          </span>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="card-pad">
          <Stat
            label="Overall progress"
            value={`${data.overallProgressPercent}%`}
            detail={`${data.phases.filter((p) => p.status === 'Completed').length} of ${data.phases.length} phases complete`}
          />
          <Progress value={data.overallProgressPercent} className="mt-3" />
        </Card>
        <Card className="card-pad">
          <Stat
            label="Remaining"
            value={`${data.estimate.totalHours} hrs`}
            detail={`${data.estimate.weeklyHours} hrs/week`}
          />
        </Card>
        <Card className="card-pad">
          <Stat
            label="Time to target"
            value={`${data.estimate.weeks} weeks`}
            detail={`~${data.estimate.months} months`}
          />
        </Card>
        <Card className="card-pad">
          <Stat
            label="Estimated completion"
            value={data.estimate.estimatedCompletionMonth}
            detail={data.estimate.estimatedCompletionDate}
          />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        {/* the ladder */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Career ladder"
            subtitle="The recommended route for a .NET / Angular / Azure background"
            icon={<MapPin size={15} />}
          />
          <div className="p-5">
            {data.ladder.map((stage, index) => (
              <div key={stage.stageOrder}>
                <div
                  className={cn(
                    'rounded-xl border px-4 py-3',
                    stage.isCurrentPosition
                      ? 'border-line bg-surface-sunken'
                      : 'border-brand-500/30 bg-gradient-to-br from-brand-600/10 to-accent-500/5',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{stage.title}</p>
                      <p className="mt-0.5 text-sm font-medium text-ink">{stage.roleTitle}</p>
                    </div>
                    {stage.isCurrentPosition ? (
                      <Badge tone="neutral">You are here</Badge>
                    ) : (
                      <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                        {money(stage.salaryMinUsd)}–{money(stage.salaryMaxUsd)}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">{stage.description}</p>
                  {stage.durationMonths > 0 && (
                    <p className="mt-2 text-[11px] text-ink-faint">≈ {stage.durationMonths} months</p>
                  )}
                </div>

                {index < data.ladder.length - 1 && (
                  <div className="flex justify-center py-1.5">
                    <ArrowDown size={15} className="text-ink-faint" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-5 xl:col-span-3">
          <Card>
            <CardHeader
              title="Compensation progression"
              subtitle="Indicative USA ranges for each rung"
            />
            <div className="card-pad">
              <CompProgression
                stages={data.ladder.map((stage) => ({
                  title: stage.roleTitle.split('/')[0].trim(),
                  min: stage.salaryMinUsd,
                  max: stage.salaryMaxUsd,
                  current: stage.isCurrentPosition,
                }))}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Phase timeline"
              subtitle="Remaining phases laid out end to end at your current pace"
            />
            <div className="divide-y divide-line">
              {data.phases.map((phase) => (
                <Link
                  key={phase.phaseNumber}
                  to={`/courses/${phase.slug}`}
                  className="flex items-start gap-3 px-5 py-4 transition hover:bg-surface-overlay"
                >
                  <span className="mt-0.5 shrink-0">
                    {phase.status === 'Completed' ? (
                      <CheckCircle2 size={17} className="text-emerald-400" />
                    ) : phase.status === 'InProgress' ? (
                      <CircleDot size={17} className="text-amber-400" />
                    ) : (
                      <Circle size={17} className="text-ink-faint" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm text-ink">{phase.title}</p>
                      <p className="text-[11px] tabular-nums text-ink-faint">
                        {phase.estimatedStartMonth === phase.estimatedEndMonth
                          ? phase.estimatedEndMonth
                          : `${phase.estimatedStartMonth} → ${phase.estimatedEndMonth}`}
                      </p>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-faint">{phase.summary}</p>

                    <div className="mt-2 flex items-center gap-3">
                      <Progress
                        value={phase.progressPercent}
                        className="flex-1"
                        barClassName={
                          phase.status === 'Completed' ? 'bg-emerald-500' : 'bg-brand-500'
                        }
                      />
                      <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
                        {phase.completedLessons}/{phase.lessonCount} · {phase.estimatedHours} hrs
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Disclaimer className="mt-6">{data.disclaimer}</Disclaimer>
    </>
  );
}
