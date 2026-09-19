import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  Clock,
  FileQuestion,
  PlayCircle,
  Target,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Card, CardHeader, ErrorPanel, LoadingPanel, Progress, Stat } from '@/components/ui';
import { cn, minutesLabel } from '@/lib/format';
import type { CourseDetail as CourseDetailDto, LessonListItem } from '@/types/api';

export default function CourseDetail() {
  const { slug = '' } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ['course', slug],
    queryFn: () => api.get<CourseDetailDto>(`/courses/${slug}`),
  });

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (isLoading) return <LoadingPanel label="Loading course" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  if (!data) return null;

  const { course, modules, outcomes } = data;
  const firstUnfinished = modules
    .flatMap((m) => m.lessons)
    .find((lesson) => lesson.status !== 'Completed');

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Courses', to: '/courses' }, { label: `Phase ${course.phaseNumber}` }]}
        title={course.title}
        description={course.summary}
        actions={
          firstUnfinished && (
            <Link
              to={`/learn/${firstUnfinished.slug}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-brand-500/60 bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-500"
            >
              <PlayCircle size={15} />
              Continue
            </Link>
          )
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="card-pad">
          <Stat label="Progress" value={`${course.progressPercent}%`} detail={`${course.completedLessons} of ${course.lessonCount} lessons`} />
          <Progress value={course.progressPercent} className="mt-3" />
        </Card>
        <Card className="card-pad">
          <Stat label="Estimated time" value={`${course.estimatedHours} hrs`} detail={`${course.moduleCount} modules`} />
        </Card>
        <Card className="card-pad">
          <Stat label="Level" value={course.level} detail={`Included from ${course.minimumTrack}`} />
        </Card>
        <Card className="card-pad">
          <Stat label="Track" value={course.careerTitle} />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-4">
        <div className="space-y-4 xl:col-span-3">
          {modules.map((module) => {
            const isCollapsed = collapsed[module.id];
            return (
              <Card key={module.id}>
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [module.id]: !c[module.id] }))}
                  className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-surface-overlay"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-sunken text-xs font-semibold text-ink-muted">
                    {module.order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold tracking-tight text-ink">{module.title}</h3>
                      <span className="text-[11px] tabular-nums text-ink-faint">
                        {module.estimatedHours} hrs · {module.lessons.length} lessons
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">{module.summary}</p>
                    <Progress
                      value={module.progressPercent}
                      className="mt-2.5"
                      barClassName={module.progressPercent === 100 ? 'bg-emerald-500' : 'bg-brand-500'}
                    />
                  </div>
                  <ChevronDown
                    size={16}
                    className={cn(
                      'mt-1 shrink-0 text-ink-faint transition-transform',
                      isCollapsed && '-rotate-90',
                    )}
                  />
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-line border-t border-line">
                    {module.lessons.map((lesson) => (
                      <LessonRow key={lesson.id} lesson={lesson} />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="What you will be able to do" icon={<Target size={15} />} />
            <ul className="space-y-2.5 card-pad">
              {outcomes.map((outcome) => (
                <li key={outcome} className="flex gap-2 text-xs leading-relaxed text-ink-muted">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-brand-400" />
                  {outcome}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Course contents" />
            <div className="card-pad">
              <ol className="space-y-1.5">
                {modules.map((module) => (
                  <li key={module.id} className="text-xs">
                    <span className="text-ink-faint">{module.order}.</span>{' '}
                    <span className="text-ink-muted">{module.title}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function LessonRow({ lesson }: { lesson: LessonListItem }) {
  return (
    <Link
      to={`/learn/${lesson.slug}`}
      className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-overlay"
    >
      <span className="shrink-0">
        {lesson.status === 'Completed' ? (
          <CheckCircle2 size={16} className="text-emerald-400" />
        ) : lesson.status === 'InProgress' ? (
          <CircleDot size={16} className="text-amber-400" />
        ) : (
          <Circle size={16} className="text-ink-faint" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm',
            lesson.status === 'Completed' ? 'text-ink-muted' : 'text-ink',
          )}
        >
          {lesson.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
          <span className="inline-flex items-center gap-1">
            <Clock size={10} />
            {minutesLabel(lesson.estimatedMinutes)}
          </span>
          <span>{lesson.type}</span>
          {lesson.hasVideo && (
            <span className="inline-flex items-center gap-1">
              <PlayCircle size={10} />
              video
            </span>
          )}
          {lesson.hasQuiz && (
            <span className="inline-flex items-center gap-1">
              <FileQuestion size={10} />
              quiz
            </span>
          )}
        </div>
      </div>

      {lesson.quizScorePercent !== undefined && lesson.quizScorePercent !== null && (
        <Badge tone={lesson.quizScorePercent >= 70 ? 'success' : 'warning'}>
          quiz {lesson.quizScorePercent}%
        </Badge>
      )}
      {lesson.minimumTrack === 'FastTrack' && <Badge tone="brand">Fast Track</Badge>}
    </Link>
  );
}
