import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Flame,
  GraduationCap,
  Play,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Disclaimer,
  ErrorPanel,
  LoadingPanel,
  Progress,
  Stat,
} from '@/components/ui';
import { ProgressRing, SkillRadar, WeeklyHoursChart } from '@/components/charts';
import { cn, minutesLabel, STATUS_TONE } from '@/lib/format';
import type { Dashboard as DashboardDto, StartTodayResponse } from '@/types/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardDto>('/dashboard'),
  });

  const startToday = useMutation({
    mutationFn: () => api.post<StartTodayResponse>('/study/start-today'),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (result.deepLink) navigate(result.deepLink);
    },
  });

  if (isLoading) return <LoadingPanel label="Loading your dashboard" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  if (!data) return null;

  const overall = data.readinessRings[0];
  const dimensionRings = data.readinessRings.slice(1);

  return (
    <>
      <PageHeader
        title={`${data.greeting}, ${data.displayName.split(' ')[0]}`}
        description={
          data.targetCareerTitle ? (
            <span>
              Working toward{' '}
              <Link to={`/careers/${data.targetCareerSlug}`} className="link font-medium">
                {data.targetCareerTitle}
              </Link>{' '}
              · {data.targetSalaryRange} · estimated completion{' '}
              <span className="text-ink">{data.estimatedCompletion}</span>
            </span>
          ) : (
            'Choose a target career to start planning.'
          )
        }
        actions={
          <Button
            variant="primary"
            size="lg"
            loading={startToday.isPending}
            onClick={() => startToday.mutate()}
            icon={<Play size={16} />}
          >
            Start today's training
          </Button>
        }
      />

      {startToday.data && !startToday.data.deepLink && (
        <div className="mb-5 rounded-xl border border-brand-500/30 bg-brand-600/10 px-4 py-3 text-sm text-ink">
          {startToday.data.message}
        </div>
      )}

      {/* headline numbers */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="card-pad">
          <div className="flex items-start justify-between">
            <Stat
              label="Programme progress"
              value={`${data.progressPercent}%`}
              detail={`${data.hoursCompleted} of ${data.totalHours} hours`}
            />
            <TrendingUp size={16} className="text-brand-400" />
          </div>
          <Progress value={data.progressPercent} className="mt-3" />
        </Card>

        <Card className="card-pad">
          <div className="flex items-start justify-between">
            <Stat
              label="Study streak"
              value={`${data.studyStreakDays} days`}
              detail={`Longest ${data.gamification.longestStreakDays} days`}
            />
            <Flame size={16} className="text-amber-400" />
          </div>
          <Progress
            value={Math.min(100, (data.studyStreakDays / 30) * 100)}
            className="mt-3"
            barClassName="bg-amber-500"
          />
        </Card>

        <Card className="card-pad">
          <div className="flex items-start justify-between">
            <Stat
              label="Courses completed"
              value={`${data.coursesCompleted} / ${data.totalCourses}`}
              detail={`${data.practiceQuestionsAnswered} practice answers recorded`}
            />
            <BookOpen size={16} className="text-sky-400" />
          </div>
          <Progress
            value={data.totalCourses ? (data.coursesCompleted / data.totalCourses) * 100 : 0}
            className="mt-3"
            barClassName="bg-sky-500"
          />
        </Card>

        <Card className="card-pad">
          <div className="flex items-start justify-between">
            <Stat
              label="Projects delivered"
              value={`${data.projectsCompleted} / ${data.totalProjects}`}
              detail={`Level ${data.gamification.level} · ${data.gamification.levelTitle}`}
            />
            <GraduationCap size={16} className="text-emerald-400" />
          </div>
          <Progress
            value={data.totalProjects ? (data.projectsCompleted / data.totalProjects) * 100 : 0}
            className="mt-3"
            barClassName="bg-emerald-500"
          />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {/* today */}
          <Card>
            <CardHeader
              title="Today's plan"
              subtitle={
                data.today.length > 0
                  ? `${data.today.length} scheduled item${data.today.length === 1 ? '' : 's'} · ${minutesLabel(
                      data.today.reduce((sum, item) => sum + item.minutes, 0),
                    )}`
                  : 'Nothing scheduled — generate a plan from Calendar'
              }
              icon={<Timer size={15} />}
              action={
                <Link to="/calendar" className="text-xs text-ink-faint transition hover:text-ink">
                  Calendar
                </Link>
              }
            />
            <div className="divide-y divide-line">
              {data.today.length === 0 && (
                <p className="px-5 py-6 text-sm text-ink-faint">
                  No items scheduled for today. Open Calendar to generate or pull work forward.
                </p>
              )}
              {data.today.map((item, index) => (
                <div key={`${item.title}-${index}`} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[10px] font-semibold',
                      item.status === 'Completed'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-line text-ink-faint',
                    )}
                  >
                    {item.status === 'Completed' ? <CheckCircle2 size={12} /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-sm',
                        item.status === 'Completed' ? 'text-ink-faint line-through' : 'text-ink',
                      )}
                    >
                      {item.title}
                    </p>
                    <p className="text-[11px] text-ink-faint">
                      {item.activityType} · {minutesLabel(item.minutes)}
                    </p>
                  </div>
                  {item.deepLink && item.status !== 'Completed' && (
                    <Link
                      to={item.deepLink}
                      className="shrink-0 rounded-md border border-line px-2.5 py-1 text-[11px] text-ink-muted transition hover:bg-surface-overlay hover:text-ink"
                    >
                      Open
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* weekly hours */}
          <Card>
            <CardHeader
              title="Weekly hours"
              subtitle="Planned against actual, last eight weeks"
              icon={<Timer size={15} />}
            />
            <div className="p-4">
              <WeeklyHoursChart data={data.weeklyHours} />
            </div>
          </Card>

          {/* skills radar */}
          <Card>
            <CardHeader
              title="Skills radar"
              subtitle={`Current level against the target for ${data.targetCareerTitle ?? 'your role'}`}
              icon={<TrendingUp size={15} />}
              action={
                <Link to="/skills" className="text-xs text-ink-faint transition hover:text-ink">
                  Full matrix
                </Link>
              }
            />
            <div className="p-4">
              <SkillRadar data={data.skillRadar} />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {/* readiness */}
          <Card>
            <CardHeader
              title="Career readiness"
              subtitle={overall?.detail ?? 'Measured from completed work'}
              icon={<Briefcase size={15} />}
              action={
                <Link to="/job-readiness" className="text-xs text-ink-faint transition hover:text-ink">
                  Details
                </Link>
              }
            />
            <div className="p-5">
              {overall ? (
                <>
                  <div className="flex justify-center">
                    <ProgressRing value={overall.percent} size={116} stroke={9} />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-4">
                    {dimensionRings.map((ring) => (
                      <div key={ring.label}>
                        <div className="mb-1 flex items-baseline justify-between text-[11px]">
                          <span className="truncate text-ink-muted">{ring.label}</span>
                          <span className="tabular-nums text-ink">{ring.percent}%</span>
                        </div>
                        <Progress value={ring.percent} />
                      </div>
                    ))}
                  </div>
                  <Disclaimer className="mt-4">
                    Readiness reflects measured learning progress and assessment performance on this
                    platform. It is not a professional qualification.
                  </Disclaimer>
                </>
              ) : (
                <p className="text-sm text-ink-faint">Select a target career to see readiness.</p>
              )}
            </div>
          </Card>

          {/* next up */}
          <Card>
            <CardHeader title="Next up" icon={<ClipboardList size={15} />} />
            <div className="divide-y divide-line">
              <NextRow
                label="Next lesson"
                value={data.nextUp.nextLessonTitle}
                to={data.nextUp.nextLessonSlug ? `/learn/${data.nextUp.nextLessonSlug}` : undefined}
              />
              <NextRow
                label="Next practice"
                value={data.nextUp.nextPracticeTitle}
                to={data.nextUp.nextPracticeId ? `/practice/${data.nextUp.nextPracticeId}` : undefined}
              />
              <NextRow
                label="Next project"
                value={data.nextUp.nextProjectTitle}
                to={data.nextUp.nextProjectSlug ? `/projects/${data.nextUp.nextProjectSlug}` : undefined}
              />
            </div>
          </Card>

          {/* current project */}
          {data.currentProject && (
            <Card>
              <CardHeader title="Current project" icon={<GraduationCap size={15} />} />
              <div className="card-pad">
                <Link
                  to={`/projects/${data.currentProject.slug}`}
                  className="text-sm font-medium text-ink transition hover:text-brand-300"
                >
                  {data.currentProject.title}
                </Link>
                <div className="mt-3 flex items-baseline justify-between text-xs text-ink-faint">
                  <span>
                    {data.currentProject.milestonesDone} of {data.currentProject.milestonesTotal}{' '}
                    milestones
                  </span>
                  <span className="tabular-nums text-ink">{data.currentProject.percentComplete}%</span>
                </div>
                <Progress value={data.currentProject.percentComplete} className="mt-2" barClassName="bg-emerald-500" />
              </div>
            </Card>
          )}

          {/* certification */}
          {data.upcomingCertification && (
            <Card>
              <CardHeader title="Upcoming certification" icon={<Award size={15} />} />
              <div className="card-pad">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{data.upcomingCertification.code}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">{data.upcomingCertification.name}</p>
                  </div>
                  <Badge tone={data.upcomingCertification.status === 'Studying' ? 'warning' : 'neutral'}>
                    {data.upcomingCertification.status}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-ink-faint">
                  {data.upcomingCertification.estimatedPrepHours} hours preparation
                  {data.upcomingCertification.targetDate
                    ? ` · target ${data.upcomingCertification.targetDate}`
                    : ''}
                </p>
                <Link
                  to="/certifications"
                  className="mt-3 inline-block text-xs text-brand-400 transition hover:underline"
                >
                  Manage certifications
                </Link>
              </div>
            </Card>
          )}

          {/* badges */}
          <Card>
            <CardHeader
              title="Recognition"
              subtitle={`${data.gamification.totalXp.toLocaleString()} XP · ${data.gamification.badgesEarned} of ${data.gamification.badgesTotal} badges`}
              icon={<Award size={15} />}
            />
            <div className="card-pad">
              <div className="mb-3 flex items-baseline justify-between text-[11px] text-ink-faint">
                <span>Level {data.gamification.level}</span>
                <span>
                  {data.gamification.xpIntoLevel} / {data.gamification.xpForNextLevel} XP
                </span>
              </div>
              <Progress
                value={(data.gamification.xpIntoLevel / data.gamification.xpForNextLevel) * 100}
                barClassName="bg-gradient-to-r from-brand-500 to-accent-500"
              />
              <div className="mt-4 flex flex-wrap gap-1.5">
                {data.gamification.badges
                  .filter((badge) => badge.earned)
                  .slice(0, 8)
                  .map((badge) => (
                    <span
                      key={badge.id}
                      title={badge.description}
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[11px]',
                        STATUS_TONE.Completed,
                      )}
                    >
                      {badge.name}
                    </span>
                  ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function NextRow({ label, value, to }: { label: string; value?: string; to?: string }) {
  return (
    <div className="px-5 py-3">
      <p className="label">{label}</p>
      {value ? (
        to ? (
          <Link to={to} className="mt-1 block text-sm text-ink transition hover:text-brand-300">
            {value.length > 90 ? `${value.slice(0, 90)}…` : value}
          </Link>
        ) : (
          <p className="mt-1 text-sm text-ink">{value}</p>
        )
      ) : (
        <p className="mt-1 text-sm text-ink-faint">Nothing outstanding</p>
      )}
    </div>
  );
}
