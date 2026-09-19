import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Button, Card, CardHeader, Disclaimer, ErrorPanel, LoadingPanel, Stat, Tabs } from '@/components/ui';
import { cn, minutesLabel, relativeDay, STATUS_TONE } from '@/lib/format';
import type { CalendarMonth, StudyPlanDay } from '@/types/api';

const LEGEND = [
  { status: 'NotStarted', label: 'Not started' },
  { status: 'Scheduled', label: 'Scheduled' },
  { status: 'InProgress', label: 'In progress' },
  { status: 'Completed', label: 'Completed' },
  { status: 'Late', label: 'Late' },
];

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const today = new Date();

  const [view, setView] = useState<'month' | 'week'>('month');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const monthQuery = useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () => api.get<CalendarMonth>(`/study/calendar/${year}/${month}`),
    enabled: view === 'month',
  });

  const weekQuery = useQuery({
    queryKey: ['plan', 'two-weeks'],
    queryFn: () => api.get<StudyPlanDay[]>('/study/plan'),
    enabled: view === 'week',
  });

  const regenerate = useMutation({
    mutationFn: () => api.post('/study/plan/generate', { weeks: 12 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['plan'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const complete = useMutation({
    mutationFn: (itemId: string) => api.post(`/study/plan/items/${itemId}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const shift = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  };

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Your study plan, generated from the hours and days you set. Regenerating rebuilds future days and leaves completed history alone."
        actions={
          <Button
            variant="secondary"
            loading={regenerate.isPending}
            onClick={() => regenerate.mutate()}
            icon={<RefreshCw size={14} />}
          >
            Regenerate 12 weeks
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { key: 'month', label: 'Month' },
            { key: 'week', label: 'Next two weeks' },
          ]}
          active={view}
          onChange={setView}
        />

        {view === 'month' && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => shift(-1)} icon={<ChevronLeft size={15} />}>
              Prev
            </Button>
            <span className="min-w-36 text-center text-sm font-medium text-ink">
              {monthQuery.data?.monthName ?? `${year}-${String(month).padStart(2, '0')}`}
            </span>
            <Button size="sm" variant="ghost" onClick={() => shift(1)}>
              Next
              <ChevronRight size={15} />
            </Button>
          </div>
        )}
      </div>

      {view === 'month' && (
        <>
          {monthQuery.isLoading && <LoadingPanel label="Loading calendar" />}
          {monthQuery.error && <ErrorPanel message={(monthQuery.error as Error).message} />}

          {monthQuery.data && (
            <>
              <div className="mb-5 grid gap-4 sm:grid-cols-3">
                <Card className="card-pad">
                  <Stat
                    label="Planned this month"
                    value={minutesLabel(monthQuery.data.totalPlannedMinutes)}
                  />
                </Card>
                <Card className="card-pad">
                  <Stat
                    label="Completed"
                    value={minutesLabel(monthQuery.data.totalCompletedMinutes)}
                  />
                </Card>
                <Card className="card-pad">
                  <Stat
                    label="Adherence"
                    value={`${
                      monthQuery.data.totalPlannedMinutes
                        ? Math.round(
                            (monthQuery.data.totalCompletedMinutes /
                              monthQuery.data.totalPlannedMinutes) *
                              100,
                          )
                        : 0
                    }%`}
                  />
                </Card>
              </div>

              <div className="space-y-4">
                {monthQuery.data.weeks.map((week) => (
                  <Card key={week.weekNumber}>
                    <CardHeader
                      title={week.label}
                      subtitle={`${week.startDate} → ${week.endDate}`}
                      icon={<CalendarDays size={15} />}
                      action={<Badge tone="neutral">{week.theme}</Badge>}
                    />
                    <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-4 lg:grid-cols-7">
                      {week.days.map((day) => (
                        <div
                          key={day.onDate}
                          className={cn(
                            'rounded-xl border px-3 py-2.5',
                            STATUS_TONE[day.status] ?? STATUS_TONE.NotStarted,
                          )}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[11px] font-medium">
                              {new Date(`${day.onDate}T00:00:00`).getDate()}
                            </span>
                            {day.targetMinutes > 0 && (
                              <span className="text-[10px] tabular-nums opacity-80">
                                {minutesLabel(day.targetMinutes)}
                              </span>
                            )}
                          </div>
                          <ul className="mt-1.5 space-y-0.5">
                            {day.titles.map((title) => (
                              <li key={title} className="truncate text-[10px] leading-tight opacity-90">
                                {title}
                              </li>
                            ))}
                          </ul>
                          {day.itemCount > day.titles.length && (
                            <p className="mt-1 text-[10px] opacity-70">
                              +{day.itemCount - day.titles.length} more
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {LEGEND.map((entry) => (
                  <span
                    key={entry.status}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]',
                      STATUS_TONE[entry.status],
                    )}
                  >
                    {entry.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {view === 'week' && (
        <>
          {weekQuery.isLoading && <LoadingPanel label="Loading plan" />}
          {weekQuery.error && <ErrorPanel message={(weekQuery.error as Error).message} />}

          <div className="grid gap-4 lg:grid-cols-2">
            {(weekQuery.data ?? []).map((day) => (
              <Card key={day.id}>
                <CardHeader
                  title={relativeDay(day.onDate)}
                  subtitle={`${day.dayOfWeek} · target ${minutesLabel(day.targetMinutes)}`}
                  action={
                    <Badge
                      tone={
                        day.status === 'Completed'
                          ? 'success'
                          : day.status === 'Late'
                            ? 'danger'
                            : day.status === 'InProgress'
                              ? 'warning'
                              : 'neutral'
                      }
                    >
                      {day.status}
                    </Badge>
                  }
                />
                <div className="divide-y divide-line">
                  {day.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-2.5">
                      <button
                        onClick={() => complete.mutate(item.id)}
                        disabled={item.status === 'Completed' || complete.isPending}
                        className="shrink-0 text-ink-faint transition hover:text-emerald-400 disabled:text-emerald-400"
                        aria-label="Mark complete"
                      >
                        <CheckCircle2 size={15} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-[13px]',
                            item.status === 'Completed' ? 'text-ink-faint line-through' : 'text-ink',
                          )}
                        >
                          {item.title}
                        </p>
                        <p className="text-[10px] text-ink-faint">
                          {item.activityType} · {minutesLabel(item.minutes)}
                        </p>
                      </div>
                      {item.deepLink && (
                        <Link
                          to={item.deepLink}
                          className="shrink-0 rounded-md border border-line px-2 py-0.5 text-[10px] text-ink-muted transition hover:bg-surface-overlay hover:text-ink"
                        >
                          Open
                        </Link>
                      )}
                    </div>
                  ))}
                  {day.items.length === 0 && (
                    <p className="px-5 py-4 text-xs text-ink-faint">Nothing scheduled.</p>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {(weekQuery.data ?? []).length === 0 && !weekQuery.isLoading && (
            <Card className="card-pad">
              <p className="text-sm text-ink-muted">
                No plan generated yet. Use "Regenerate 12 weeks" above to build one from your study
                profile.
              </p>
            </Card>
          )}
        </>
      )}

      <Disclaimer className="mt-6">
        The plan is generated from your stated hours and study days. Completed days are never
        rewritten — regenerating only rebuilds what is still ahead of you.
      </Disclaimer>
    </>
  );
}
