import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Clock, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Card, ErrorPanel, Input, LoadingPanel, Progress, Stat, Tabs } from '@/components/ui';
import type { CourseListItem, TrackMode } from '@/types/api';

const TRACK_TABS: { key: TrackMode | 'All'; label: string }[] = [
  { key: 'All', label: 'All phases' },
  { key: 'FastTrack', label: 'Fast Track only' },
  { key: 'Balanced', label: 'Balanced' },
  { key: 'Deep', label: 'Deep Learning' },
];

export default function Courses() {
  const [search, setSearch] = useState('');
  const [track, setTrack] = useState<TrackMode | 'All'>('All');

  const { data, isLoading, error } = useQuery({
    queryKey: ['courses', track],
    queryFn: () =>
      api.get<CourseListItem[]>(`/courses${track === 'All' ? '' : `?track=${track}`}`),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (course) =>
        course.title.toLowerCase().includes(term) || course.summary.toLowerCase().includes(term),
    );
  }, [data, search]);

  const totals = useMemo(() => {
    const hours = filtered.reduce((sum, c) => sum + c.estimatedHours, 0);
    const lessons = filtered.reduce((sum, c) => sum + c.lessonCount, 0);
    const done = filtered.reduce((sum, c) => sum + c.completedLessons, 0);
    return { hours, lessons, done };
  }, [filtered]);

  return (
    <>
      <PageHeader
        title="Courses"
        description="The AI Solutions Architect programme, phase by phase. Written for an engineer with two decades of production experience — not for a beginner."
        actions={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter phases"
              className="w-56 pl-9"
            />
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="card-pad">
          <Stat label="Phases" value={filtered.length} detail={`${totals.hours} hours of content`} />
        </Card>
        <Card className="card-pad">
          <Stat
            label="Lessons"
            value={`${totals.done} / ${totals.lessons}`}
            detail="completed across the track"
          />
        </Card>
        <Card className="card-pad">
          <Stat
            label="Completion"
            value={`${totals.lessons ? Math.round((totals.done / totals.lessons) * 100) : 0}%`}
          />
          <Progress
            value={totals.lessons ? (totals.done / totals.lessons) * 100 : 0}
            className="mt-3"
          />
        </Card>
      </div>

      <div className="mb-5">
        <Tabs tabs={TRACK_TABS} active={track} onChange={setTrack} />
      </div>

      {isLoading && <LoadingPanel label="Loading courses" />}
      {error && <ErrorPanel message={(error as Error).message} />}

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((course) => (
          <Link
            key={course.id}
            to={`/courses/${course.slug}`}
            className="group rounded-2xl border border-line bg-surface-raised p-5 shadow-card transition hover:border-line-strong hover:shadow-lift"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600/30 to-accent-500/20 text-sm font-semibold text-brand-300">
                {course.phaseNumber}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold tracking-tight text-ink transition group-hover:text-brand-300">
                  {course.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                  {course.summary}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Badge tone="neutral">
                <Clock size={10} />
                {course.estimatedHours} hrs
              </Badge>
              <Badge tone="neutral">
                <BookOpen size={10} />
                {course.moduleCount} modules · {course.lessonCount} lessons
              </Badge>
              <Badge tone={course.level === 'Expert' ? 'danger' : 'info'}>{course.level}</Badge>
              {course.minimumTrack === 'FastTrack' && <Badge tone="success">In Fast Track</Badge>}
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-baseline justify-between text-[11px]">
                <span className="text-ink-faint">
                  {course.completedLessons} of {course.lessonCount} lessons
                </span>
                <span className="tabular-nums text-ink">{course.progressPercent}%</span>
              </div>
              <Progress
                value={course.progressPercent}
                barClassName={course.progressPercent === 100 ? 'bg-emerald-500' : 'bg-brand-500'}
              />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
