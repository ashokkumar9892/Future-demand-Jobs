import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Timer } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardHeader, EmptyState, LoadingPanel, Select, Stat } from '@/components/ui';
import { formatDate, minutesLabel } from '@/lib/format';
import type { UsageOverview } from '@/types/api';

/**
 * Time people actually had the application open.
 *
 * Deliberately separate from "minutes studied" elsewhere in this console: that
 * figure credits minutes for finishing a lesson or an attempt, so someone who
 * spends an hour reading career paths and never completes anything scores zero
 * there. This is wall-clock time with the tab in front of them.
 */
export function UsagePanel() {
  const [days, setDays] = useState(30);

  const usage = useQuery({
    queryKey: ['admin-usage', days],
    queryFn: () => api.get<UsageOverview>(`/admin/usage?days=${days}`),
  });

  if (usage.isLoading) return <LoadingPanel label="Loading time in app" />;
  if (usage.isError) return null;

  const data = usage.data;
  if (!data) return null;

  const peak = Math.max(1, ...data.daily.map((d) => d.learnerMinutes + d.visitorMinutes));

  return (
    <Card className="mb-5">
      <CardHeader
        title="Time in the application"
        subtitle="Wall-clock time with the tab open and visible — not minutes credited for completing lessons"
        icon={<Timer size={15} />}
        action={
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-36">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </Select>
        }
      />

      <div className="card-pad space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Total time"
            value={minutesLabel(data.totalMinutes)}
            detail={`${minutesLabel(data.minutesToday)} today`}
          />
          <Stat
            label="Signed-in learners"
            value={minutesLabel(data.learnerMinutes)}
            detail={`${data.activeLearners} people · ${minutesLabel(Math.round(data.averageMinutesPerLearner))} each`}
          />
          <Stat
            label="Guests"
            value={minutesLabel(data.visitorMinutes)}
            detail={`${data.activeVisitors} visitors · ${minutesLabel(Math.round(data.averageMinutesPerVisitor))} each`}
          />
          <Stat
            label="Daily average"
            value={minutesLabel(Math.round(data.totalMinutes / Math.max(1, data.days)))}
            detail={`over ${data.days} days`}
          />
        </div>

        <div>
          <p className="label mb-2">Daily total</p>
          <div className="flex h-28 items-end gap-[2px]">
            {data.daily.map((day) => {
              const total = day.learnerMinutes + day.visitorMinutes;
              const height = Math.round((total / peak) * 100);
              return (
                <div
                  key={day.date}
                  className="group relative flex-1 rounded-sm bg-surface-sunken"
                  style={{ height: '100%' }}
                  title={`${formatDate(day.date)} — ${minutesLabel(total)} (${day.learners} learners, ${day.visitors} guests)`}
                >
                  <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end" style={{ height: `${height}%` }}>
                    <div
                      className="w-full rounded-t-sm bg-brand-500/80"
                      style={{
                        height: total === 0 ? '0%' : `${Math.round((day.learnerMinutes / total) * 100)}%`,
                      }}
                    />
                    <div
                      className="w-full bg-amber-500/60"
                      style={{
                        height: total === 0 ? '0%' : `${Math.round((day.visitorMinutes / total) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-ink-faint">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-brand-500/80" /> Signed in
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-amber-500/60" /> Guests
            </span>
          </div>
        </div>

        <div>
          <p className="label mb-2">Most time in the application</p>
          {data.topLearners.length === 0 ? (
            <EmptyState
              title="No time recorded yet"
              description="Figures appear once people use the deployed application."
            />
          ) : (
            <div className="space-y-1">
              {data.topLearners.map((person) => (
                <div
                  key={person.userId ?? person.name}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[13px] hover:bg-surface-overlay"
                >
                  <span className="min-w-0 flex-1 truncate text-ink">{person.name}</span>
                  <span className="shrink-0 text-[11px] text-ink-faint">
                    {person.activeDays} day{person.activeDays === 1 ? '' : 's'}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 tabular-nums text-ink-muted">
                    <Clock size={12} />
                    {minutesLabel(person.minutes)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-ink-faint">
          Counted in the browser and paused whenever the tab is hidden, so a page left open
          overnight adds nothing. Guests are identified by a random first-party id, not by any
          property of the person or device; clearing site data ends that visitor.
        </p>
      </div>
    </Card>
  );
}
