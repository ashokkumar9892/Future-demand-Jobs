import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Timer, Users } from 'lucide-react';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorPanel,
  Input,
  LoadingPanel,
  Select,
  Stat,
} from '@/components/ui';
import { formatDate, minutesLabel } from '@/lib/format';
import type { Paged, UsageOverview, VisitorRow } from '@/types/api';

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

/**
 * Every person who used the application in the window, signed in or not.
 *
 * Guests are listed alongside accounts because "how many people use this" is
 * not a question about accounts — and since the catalogue opened to anonymous
 * browsing, most people in this table will never have created one.
 */
export function VisitorsTab() {
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const visitors = useQuery({
    queryKey: ['admin-visitors', days, search, page],
    queryFn: () =>
      api.get<Paged<VisitorRow>>(
        `/admin/usage/visitors?days=${days}&page=${page}&pageSize=50${
          search ? `&search=${encodeURIComponent(search)}` : ''
        }`,
      ),
  });

  if (visitors.isLoading) return <LoadingPanel label="Loading visitors" />;
  if (visitors.isError) return <ErrorPanel message={(visitors.error as Error).message} />;

  const data = visitors.data;
  if (!data) return null;

  const guests = data.items.filter((v) => !v.signedIn).length;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <Card>
      <CardHeader
        title="Everyone who visited"
        subtitle={`${data.total} people in the last ${days} days · ${guests} of the ${data.items.length} shown have no account`}
        icon={<Users size={15} />}
        action={
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Name, email or place"
              className="w-48"
            />
            <Select
              value={days}
              onChange={(e) => {
                setDays(Number(e.target.value));
                setPage(1);
              }}
              className="w-32"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </Select>
          </div>
        }
      />

      {data.items.length === 0 ? (
        <EmptyState
          title="Nobody yet"
          description="Visitors appear here as soon as someone opens the deployed application."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2 font-medium">Who</th>
                <th className="px-4 py-2 font-medium">Time spent</th>
                <th className="px-4 py-2 font-medium">Days</th>
                <th className="px-4 py-2 font-medium">First seen</th>
                <th className="px-4 py-2 font-medium">Last seen</th>
                <th className="px-4 py-2 font-medium">Where / device</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((visitor) => (
                <tr key={visitor.key} className="border-b border-line/50 hover:bg-surface-overlay">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge tone={visitor.signedIn ? 'brand' : 'warning'}>
                        {visitor.signedIn ? 'Account' : 'Guest'}
                      </Badge>
                      <div className="min-w-0">
                        <p className="truncate text-ink">{visitor.label}</p>
                        {visitor.email && (
                          <p className="truncate text-[11px] text-ink-faint">{visitor.email}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-ink">{minutesLabel(visitor.minutes)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-ink-muted">{visitor.activeDays}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{formatDate(visitor.firstSeenAt)}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{formatDate(visitor.lastSeenAt)}</td>
                  <td className="px-4 py-2.5">
                    <p className="text-ink-muted">{visitor.location ?? '—'}</p>
                    <p className="text-[11px] text-ink-faint">{visitor.device ?? '—'}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <p className="text-xs text-ink-faint">
            Page {data.page} of {pages}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <p className="card-pad text-xs text-ink-faint">
        A guest is one browser that kept its storage — two devices are two rows, and clearing site
        data starts a new one. Place is filled in only where that address has already been resolved
        by a sign-in; behind a proxy it reflects the proxy, not the visitor.
      </p>
    </Card>
  );
}
