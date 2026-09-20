import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookOpen,
  CreditCard,
  Globe2,
  Inbox,
  LogIn,
  MapPin,
  Monitor,
  Save,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { api, DEMO_MODE } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Disclaimer,
  EmptyState,
  ErrorPanel,
  Field,
  Input,
  LoadingPanel,
  Progress,
  Select,
  Stat,
  Tabs,
  Textarea,
} from '@/components/ui';
import { formatDate, minutesLabel } from '@/lib/format';
import { RatingStars, STATUS_LABEL, STATUS_TONE } from '@/components/feedback';
import { UsagePanel } from '@/pages/admin/UsagePanel';
import type {
  AdminFeedback,
  CourseEngagement,
  EngagementOverview,
  FeedbackStatus,
  FeedbackSummary,
  LearnerDetail,
  LearnerRow,
  LocationRollup,
  LoginEvent,
  Paged,
  PaymentRequestDto,
} from '@/types/api';

type Tab = 'overview' | 'learners' | 'logins' | 'courses' | 'feedback' | 'payments';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'learners', label: 'Learners' },
  { key: 'logins', label: 'Login activity' },
  { key: 'courses', label: 'Course engagement' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'payments', label: 'Payments' },
];

export default function Insights() {
  const [tab, setTab] = useState<Tab>('overview');

  if (DEMO_MODE) {
    return (
      <>
        <PageHeader title="Learners & feedback" />
        <EmptyState
          icon={<Users size={22} />}
          title="These reports need the API"
          description="Accounts, login history and feedback are stored server-side. This browser-only build has no API behind it, so there is nothing to report on."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Usage & learners"
        description="How long people spend in the application, how many sign in, which course each learner is working through, where they signed in from, and the feedback queue."
      />

      <div className="mb-5">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'overview' && <OverviewTab onJump={setTab} />}
      {tab === 'learners' && <LearnersTab />}
      {tab === 'logins' && <LoginsTab />}
      {tab === 'courses' && <CoursesTab />}
      {tab === 'feedback' && <FeedbackTab />}
      {tab === 'payments' && <PaymentsTab />}
    </>
  );
}

// ---------- overview ----------

function OverviewTab({ onJump }: { onJump: (tab: Tab) => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['engagement-overview'],
    queryFn: () => api.get<EngagementOverview>('/admin/engagement/overview'),
  });

  if (isLoading) return <LoadingPanel label="Loading engagement" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <UsagePanel />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="card-pad">
          <Stat label="Learners" value={data.totalLearners} detail={`${data.newLast30Days} joined in 30 days`} />
        </Card>
        <Card className="card-pad">
          <Stat
            label="Studied this week"
            value={data.activeLast7Days}
            detail={`${data.activeLast30Days} in the last 30 days`}
          />
        </Card>
        <Card className="card-pad">
          <Stat
            label="Sign-ins this week"
            value={data.loginsLast7Days}
            detail={
              data.failedLoginsLast7Days > 0
                ? `${data.failedLoginsLast7Days} failed attempt${data.failedLoginsLast7Days === 1 ? '' : 's'}`
                : 'No failed attempts'
            }
          />
        </Card>
        <Card className="card-pad">
          <Stat
            label="Open feedback"
            value={data.openFeedback}
            detail={`${data.implementedFeedback} implemented · ${
              data.averageRating > 0 ? `${data.averageRating} / 5 avg` : 'no ratings yet'
            }`}
          />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Where learners sign in from"
            subtitle="Successful sign-ins, grouped by resolved location"
            icon={<Globe2 size={15} />}
          />
          <LocationList locations={data.topLocations} />
        </Card>

        <Card>
          <CardHeader
            title="Most-studied courses"
            subtitle="By number of learners with progress"
            icon={<BookOpen size={15} />}
            action={
              <Button size="sm" variant="ghost" onClick={() => onJump('courses')}>
                All courses
              </Button>
            }
          />
          <div className="divide-y divide-line">
            {data.topCourses.length === 0 && (
              <p className="px-5 py-6 text-center text-xs text-ink-faint">No course activity yet.</p>
            )}
            {data.topCourses.map((course) => (
              <div key={course.courseId} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[13px] text-ink">{course.title}</p>
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-faint">
                    {course.learners} learner{course.learners === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <Progress value={course.averagePercent} className="flex-1" />
                  <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-ink-faint">
                    {course.averagePercent}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Disclaimer>
        Locations are derived from the sign-in IP address by a third-party geo-IP service and are
        approximate — usually the city of the network, not the person. Set <code>GeoIp:Enabled</code>{' '}
        to false to stop the platform resolving them at all.
      </Disclaimer>
    </div>
  );
}

function LocationList({ locations }: { locations: LocationRollup[] }) {
  if (locations.length === 0) {
    return <p className="px-5 py-6 text-center text-xs text-ink-faint">No sign-ins recorded yet.</p>;
  }

  return (
    <div className="divide-y divide-line">
      {locations.map((location) => (
        <div key={location.location} className="flex items-center justify-between gap-3 px-5 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink">
            <MapPin size={13} className="shrink-0 text-ink-faint" />
            <span className="truncate">{location.location}</span>
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-ink-faint">
            {location.loginCount} sign-in{location.loginCount === 1 ? '' : 's'} ·{' '}
            {location.learners} learner{location.learners === 1 ? '' : 's'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------- learners ----------

function LearnersTab() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['engagement-learners', search, sort, page],
    queryFn: () =>
      api.get<Paged<LearnerRow>>(
        `/admin/engagement/learners?page=${page}&pageSize=25&sort=${sort}` +
          (search ? `&search=${encodeURIComponent(search)}` : ''),
      ),
  });

  if (selected) return <LearnerDetailPanel id={selected} onBack={() => setSelected(null)} />;

  return (
    <Card>
      <CardHeader
        title="Accounts"
        subtitle={`${data?.total ?? 0} account${data?.total === 1 ? '' : 's'}`}
        icon={<Users size={15} />}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Name or email"
                className="h-8 w-44 pl-7 text-xs"
              />
            </div>
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-8 w-36 text-xs"
            >
              <option value="recent">Recent sign-in</option>
              <option value="name">Name</option>
              <option value="joined">Newest account</option>
            </Select>
          </div>
        }
      />

      {isLoading && <LoadingPanel label="Loading learners" />}
      {error && (
        <div className="p-4">
          <ErrorPanel message={(error as Error).message} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-line text-ink-faint">
              <th className="px-4 py-2 font-medium">Learner</th>
              <th className="px-4 py-2 font-medium">Currently studying</th>
              <th className="px-4 py-2 font-medium">Progress</th>
              <th className="px-4 py-2 font-medium">Last sign-in</th>
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((row) => (
              <tr key={row.id} className="border-b border-line/60 hover:bg-surface-overlay">
                <td className="px-4 py-2.5">
                  <p className="font-medium text-ink">{row.displayName}</p>
                  <p className="text-[11px] text-ink-faint">{row.email}</p>
                </td>
                <td className="max-w-[16rem] px-4 py-2.5">
                  {row.currentCourse ? (
                    <>
                      <p className="truncate text-ink-muted">{row.currentCourse}</p>
                      <p className="text-[11px] text-ink-faint">
                        {row.coursesStarted} started · {row.coursesCompleted} completed
                      </p>
                    </>
                  ) : (
                    <span className="text-ink-faint">
                      {row.role === 'Admin' ? '—' : 'Not started'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Progress value={row.currentCoursePercent} className="w-16" />
                    <span className="tabular-nums text-ink-faint">{row.currentCoursePercent}%</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    {row.lessonsCompleted} lessons · {minutesLabel(row.minutesStudied)}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">
                  {row.lastLoginAt ? formatDate(row.lastLoginAt) : <span className="text-ink-faint">Never</span>}
                  {row.failedLoginCount > 0 && (
                    <p className="text-[11px] text-amber-300">{row.failedLoginCount} failed</p>
                  )}
                </td>
                <td className="max-w-[14rem] px-4 py-2.5">
                  <p className="truncate text-ink-muted">{row.lastLocation ?? '—'}</p>
                  {row.lastDevice && <p className="truncate text-[11px] text-ink-faint">{row.lastDevice}</p>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setSelected(row.id)}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total === 0 && !isLoading && (
        <div className="p-4">
          <EmptyState title="No accounts match" description="Try a different name or email." />
        </div>
      )}

      <Pager page={page} pageSize={data?.pageSize ?? 25} total={data?.total ?? 0} onChange={setPage} />
    </Card>
  );
}

function LearnerDetailPanel({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['engagement-learner', id],
    queryFn: () => api.get<LearnerDetail>(`/admin/engagement/learners/${id}`),
  });

  if (isLoading) return <LoadingPanel label="Loading learner" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  if (!data) return null;

  const { learner } = data;

  return (
    <div className="space-y-5">
      <Button size="sm" variant="ghost" onClick={onBack} icon={<ArrowLeft size={14} />}>
        All learners
      </Button>

      <Card>
        <CardHeader
          title={learner.displayName}
          subtitle={`${learner.email} · joined ${formatDate(learner.joinedAt)}`}
          action={<Badge tone={learner.role === 'Admin' ? 'brand' : 'neutral'}>{learner.role}</Badge>}
        />
        <div className="card-pad grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Lessons completed"
            value={learner.lessonsCompleted}
            detail={`${learner.lessonsInProgress} in progress`}
          />
          <Stat label="Time studied" value={minutesLabel(learner.minutesStudied)} detail={`${learner.xp} XP`} />
          <Stat
            label="Courses"
            value={`${learner.coursesCompleted} / ${learner.coursesStarted}`}
            detail="completed of started"
          />
          <Stat
            label="Sign-ins"
            value={learner.loginCount}
            detail={
              learner.failedLoginCount > 0 ? `${learner.failedLoginCount} failed attempts` : 'no failed attempts'
            }
          />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Card>
          <CardHeader
            title="Course progress"
            subtitle="Every course this learner has touched"
            icon={<BookOpen size={15} />}
          />
          {data.courses.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No course activity" description="This account has not opened a lesson yet." />
            </div>
          ) : (
            <div className="divide-y divide-line">
              {data.courses.map((course) => (
                <div key={course.courseId} className="px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] text-ink">
                      <span className="text-ink-faint">Phase {course.phaseNumber} · </span>
                      {course.title}
                    </p>
                    <Badge
                      tone={
                        course.status === 'Completed'
                          ? 'success'
                          : course.status === 'In progress'
                            ? 'brand'
                            : 'neutral'
                      }
                    >
                      {course.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={course.percentComplete} className="flex-1" />
                    <span className="w-28 shrink-0 text-right text-[11px] tabular-nums text-ink-faint">
                      {course.completedLessons}/{course.totalLessons} · {course.percentComplete}%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {minutesLabel(course.minutesSpent)}
                    {course.lastActivityAt ? ` · last active ${formatDate(course.lastActivityAt)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Sign-in locations" icon={<Globe2 size={15} />} />
            <LocationList locations={data.locations} />
          </Card>

          <Card>
            <CardHeader title="Recent sign-ins" subtitle={`${data.logins.length} shown`} icon={<LogIn size={15} />} />
            {data.logins.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-ink-faint">No sign-ins recorded.</p>
            ) : (
              <div className="max-h-96 divide-y divide-line overflow-y-auto">
                {data.logins.map((event) => (
                  <div key={event.id} className="px-5 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] text-ink">{formatDateTime(event.at)}</span>
                      <OutcomeBadge outcome={event.outcome} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      {event.location} · {event.ipAddress}
                    </p>
                    <p className="text-[11px] text-ink-faint">
                      {event.browser} on {event.operatingSystem} · {event.deviceKind}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Feedback from this learner" subtitle={`${data.feedback.length} item(s)`} icon={<Inbox size={15} />} />
        {data.feedback.length === 0 ? (
          <p className="px-5 py-6 text-center text-xs text-ink-faint">Nothing submitted.</p>
        ) : (
          <div className="divide-y divide-line">
            {data.feedback.map((item) => (
              <div key={item.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] text-ink">{item.subject}</p>
                  <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{item.message}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- login activity ----------

function LoginsTab() {
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['engagement-logins', search, outcome, page],
    queryFn: () =>
      api.get<Paged<LoginEvent>>(
        `/admin/engagement/logins?page=${page}&pageSize=50&outcome=${outcome}` +
          (search ? `&search=${encodeURIComponent(search)}` : ''),
      ),
  });

  return (
    <Card>
      <CardHeader
        title="Sign-in activity"
        subtitle={`${data?.total ?? 0} attempt${data?.total === 1 ? '' : 's'} recorded`}
        icon={<LogIn size={15} />}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Email, IP or city"
                className="h-8 w-44 pl-7 text-xs"
              />
            </div>
            <Select
              value={outcome}
              onChange={(e) => {
                setOutcome(e.target.value);
                setPage(1);
              }}
              className="h-8 w-36 text-xs"
            >
              <option value="all">All attempts</option>
              <option value="Success">Successful</option>
              <option value="failed">Failed only</option>
            </Select>
          </div>
        }
      />

      {isLoading && <LoadingPanel label="Loading sign-ins" />}
      {error && (
        <div className="p-4">
          <ErrorPanel message={(error as Error).message} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-line text-ink-faint">
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2 font-medium">IP address</th>
              <th className="px-4 py-2 font-medium">Device</th>
              <th className="px-4 py-2 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((event) => (
              <tr key={event.id} className="border-b border-line/60 hover:bg-surface-overlay">
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">{formatDateTime(event.at)}</td>
                <td className="px-4 py-2.5">
                  <p className="text-ink">{event.email}</p>
                  {event.userId && <p className="text-[11px] text-ink-faint">{event.displayName}</p>}
                </td>
                <td className="max-w-[16rem] px-4 py-2.5">
                  <p className="truncate text-ink-muted">{event.location}</p>
                  {event.isp && <p className="truncate text-[11px] text-ink-faint">{event.isp}</p>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-ink-faint">
                  {event.ipAddress}
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-1.5 text-ink-muted">
                    <Monitor size={12} className="shrink-0 text-ink-faint" />
                    {event.browser} / {event.operatingSystem}
                  </span>
                  <p className="text-[11px] text-ink-faint">{event.deviceKind}</p>
                </td>
                <td className="px-4 py-2.5">
                  <OutcomeBadge outcome={event.outcome} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total === 0 && !isLoading && (
        <div className="p-4">
          <EmptyState title="No sign-ins recorded" description="Attempts appear here as soon as someone signs in." />
        </div>
      )}

      <Pager page={page} pageSize={data?.pageSize ?? 50} total={data?.total ?? 0} onChange={setPage} />

      <div className="border-t border-line px-5 py-3">
        <Disclaimer>
          Failed attempts are kept so repeated sign-in attempts against an account are visible. A
          location of &ldquo;Local network&rdquo; means the request came from this machine or a private
          network, which has no public location to resolve.
        </Disclaimer>
      </div>
    </Card>
  );
}

function OutcomeBadge({ outcome }: { outcome: LoginEvent['outcome'] }) {
  if (outcome === 'Success') return <Badge tone="success">Signed in</Badge>;
  return (
    <Badge tone={outcome === 'WrongPassword' ? 'warning' : 'danger'}>
      <ShieldAlert size={11} />
      {outcome === 'WrongPassword' ? 'Wrong password' : 'No such account'}
    </Badge>
  );
}

// ---------- course engagement ----------

function CoursesTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['engagement-courses'],
    queryFn: () => api.get<CourseEngagement[]>('/admin/engagement/courses'),
  });

  if (isLoading) return <LoadingPanel label="Loading courses" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;

  return (
    <Card>
      <CardHeader
        title="Course engagement"
        subtitle="Every course, and how far learners have got through it"
        icon={<BookOpen size={15} />}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-line text-ink-faint">
              <th className="px-4 py-2 font-medium">Course</th>
              <th className="px-4 py-2 font-medium">Learners</th>
              <th className="px-4 py-2 font-medium">Active this week</th>
              <th className="px-4 py-2 font-medium">Completed</th>
              <th className="px-4 py-2 font-medium">Average progress</th>
              <th className="px-4 py-2 font-medium">Time studied</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((course) => (
              <tr key={course.courseId} className="border-b border-line/60 hover:bg-surface-overlay">
                <td className="px-4 py-2.5">
                  <p className="text-ink">{course.title}</p>
                  <p className="text-[11px] text-ink-faint">
                    Phase {course.phaseNumber} · {course.totalLessons} lessons
                  </p>
                </td>
                <td className="px-4 py-2.5 tabular-nums text-ink-muted">{course.learners}</td>
                <td className="px-4 py-2.5 tabular-nums text-ink-muted">{course.activeLast7Days}</td>
                <td className="px-4 py-2.5 tabular-nums text-ink-muted">{course.completedLearners}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Progress value={course.averagePercent} className="w-20" />
                    <span className="tabular-nums text-ink-faint">{course.averagePercent}%</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 tabular-nums text-ink-muted">
                  {minutesLabel(course.minutesStudied)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------- feedback queue ----------

const STATUSES: FeedbackStatus[] = [
  'New',
  'UnderReview',
  'Planned',
  'InProgress',
  'Implemented',
  'Declined',
];

function FeedbackTab() {
  const [status, setStatus] = useState('open');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const summary = useQuery({
    queryKey: ['feedback-summary'],
    queryFn: () => api.get<FeedbackSummary>('/admin/feedback/summary'),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['feedback-admin', status, category, search, page],
    queryFn: () =>
      api.get<Paged<AdminFeedback>>(
        `/admin/feedback?status=${status}&category=${category}&page=${page}&pageSize=25` +
          (search ? `&search=${encodeURIComponent(search)}` : ''),
      ),
  });

  return (
    <div className="space-y-5">
      {summary.data && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="card-pad">
            <Stat label="Total received" value={summary.data.total} detail={`${summary.data.new} untriaged`} />
          </Card>
          <Card className="card-pad">
            <Stat label="Open" value={summary.data.open} detail={`${summary.data.inProgress} in progress`} />
          </Card>
          <Card className="card-pad">
            <Stat
              label="Implemented"
              value={summary.data.implemented}
              detail={`${summary.data.declined} not planned`}
            />
          </Card>
          <Card className="card-pad">
            <Stat
              label="Average rating"
              value={summary.data.ratedCount > 0 ? `${summary.data.averageRating} / 5` : '—'}
              detail={`${summary.data.ratedCount} rated`}
            />
          </Card>
        </div>
      )}

      <Card>
        <CardHeader
          title="Feedback queue"
          subtitle={`${data?.total ?? 0} item${data?.total === 1 ? '' : 's'} · untriaged first`}
          icon={<Inbox size={15} />}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search"
                  className="h-8 w-36 pl-7 text-xs"
                />
              </div>
              <Select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                className="h-8 w-36 text-xs"
              >
                <option value="all">All categories</option>
                {['Course', 'Lesson', 'Video', 'Practice', 'Project', 'Content', 'Bug', 'FeatureRequest', 'General'].map(
                  (value) => (
                    <option key={value} value={value}>
                      {value.replace(/([a-z])([A-Z])/g, '$1 $2')}
                    </option>
                  ),
                )}
              </Select>
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="h-8 w-36 text-xs"
              >
                <option value="open">Open</option>
                <option value="all">All</option>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABEL[value]}
                  </option>
                ))}
              </Select>
            </div>
          }
        />

        {isLoading && <LoadingPanel label="Loading feedback" />}
        {error && (
          <div className="p-4">
            <ErrorPanel message={(error as Error).message} />
          </div>
        )}
        {data && data.total === 0 && !isLoading && (
          <div className="p-4">
            <EmptyState
              title="Nothing in this view"
              description="Change the filters, or wait for learners to send something."
            />
          </div>
        )}

        <div className="divide-y divide-line">
          {(data?.items ?? []).map((row) => (
            <FeedbackRow key={row.item.id} row={row} />
          ))}
        </div>

        <Pager page={page} pageSize={data?.pageSize ?? 25} total={data?.total ?? 0} onChange={setPage} />
      </Card>
    </div>
  );
}

function FeedbackRow({ row }: { row: AdminFeedback }) {
  const queryClient = useQueryClient();
  const { item } = row;

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<FeedbackStatus>(item.status);
  const [response, setResponse] = useState(item.adminResponse ?? '');
  const [note, setNote] = useState(row.adminNote ?? '');
  const [implementation, setImplementation] = useState(item.implementationNote ?? '');

  const save = useMutation({
    mutationFn: () =>
      api.put<AdminFeedback>(`/admin/feedback/${item.id}`, {
        status,
        adminResponse: response,
        adminNote: note,
        implementationNote: implementation,
      }),
    onSuccess: () => {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['feedback-admin'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-summary'] });
      queryClient.invalidateQueries({ queryKey: ['engagement-overview'] });
    },
  });

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{item.subject}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            {item.learnerName} &lt;{item.learnerEmail}&gt; · {item.category.replace(/([a-z])([A-Z])/g, '$1 $2')}
            {item.area ? ` · ${item.area}` : ''} · {formatDate(item.submittedAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.rating > 0 && <RatingStars value={item.rating} />}
          <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
          <Button size="sm" variant={open ? 'ghost' : 'secondary'} onClick={() => setOpen(!open)}>
            {open ? 'Cancel' : 'Respond'}
          </Button>
        </div>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-muted">{item.message}</p>

      {!open && item.adminResponse && (
        <p className="mt-2 rounded-lg border border-line bg-surface-sunken px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
          <span className="label">Reply sent</span>
          <br />
          {item.adminResponse}
        </p>
      )}

      {!open && item.implementationNote && (
        <p className="mt-2 text-[11px] text-emerald-300">Implemented: {item.implementationNote}</p>
      )}

      {open && (
        <div className="mt-4 space-y-3 rounded-xl border border-line bg-surface-sunken p-4">
          <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)]">
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus)}>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABEL[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reply to the learner" hint="Shown on their feedback page.">
              <Textarea
                rows={3}
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="What you decided, and why."
              />
            </Field>
          </div>

          <Field
            label="What was implemented"
            hint="Recorded against the item and shown to the learner when the status is Implemented."
          >
            <Textarea
              rows={2}
              value={implementation}
              onChange={(e) => setImplementation(e.target.value)}
              placeholder="e.g. Added three worked examples to the retrieval lesson."
            />
          </Field>

          <Field label="Internal note" hint="Admin-only. Never returned to the learner.">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          {save.isError && <ErrorPanel message={(save.error as Error).message} />}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={save.isPending}
              onClick={() => save.mutate()}
              icon={<Save size={14} />}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- shared ----------

function Pager({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (next: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
      <span className="text-[11px] text-ink-faint">
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

/** Sign-in rows need the time of day, which formatDate deliberately drops. */
function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------- payments ----------

const PAYMENT_STATUSES = ['Pending', 'AwaitingConfirmation', 'Paid', 'Rejected', 'Cancelled', 'Refunded'];

const PAYMENT_TONE: Record<string, 'neutral' | 'brand' | 'success' | 'warning' | 'info' | 'danger'> = {
  Pending: 'info',
  AwaitingConfirmation: 'warning',
  Paid: 'success',
  Rejected: 'danger',
  Cancelled: 'neutral',
  Refunded: 'neutral',
};

/**
 * Where an administrator reconciles payments against their own bank records.
 * Confirming one is what enrols the learner and unlocks the course, so it is
 * deliberately a manual, explicit act.
 */
function PaymentsTab() {
  const [status, setStatus] = useState('open');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-payments', status, search, page],
    queryFn: () =>
      api.get<Paged<PaymentRequestDto>>(
        `/admin/payments?status=${status}&page=${page}&pageSize=25` +
          (search ? `&search=${encodeURIComponent(search)}` : ''),
      ),
  });

  return (
    <Card>
      <CardHeader
        title="Payments"
        subtitle={`${data?.total ?? 0} request${data?.total === 1 ? '' : 's'} · awaiting confirmation first`}
        icon={<CreditCard size={15} />}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Reference, email or course"
                className="h-8 w-48 pl-7 text-xs"
              />
            </div>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="h-8 w-40 text-xs"
            >
              <option value="open">Open</option>
              <option value="all">All</option>
              {PAYMENT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value === 'AwaitingConfirmation' ? 'Awaiting confirmation' : value}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {isLoading && <LoadingPanel label="Loading payments" />}
      {error && (
        <div className="p-4">
          <ErrorPanel message={(error as Error).message} />
        </div>
      )}
      {data && data.total === 0 && !isLoading && (
        <div className="p-4">
          <EmptyState
            title="Nothing in this view"
            description="Payments appear here when a learner buys an advanced course."
          />
        </div>
      )}

      <div className="divide-y divide-line">
        {(data?.items ?? []).map((payment) => (
          <PaymentRow key={payment.id} payment={payment} />
        ))}
      </div>

      <Pager page={page} pageSize={data?.pageSize ?? 25} total={data?.total ?? 0} onChange={setPage} />

      <div className="border-t border-line px-5 py-3">
        <Disclaimer>
          No payment gateway is connected. Check the reference against your own bank or wallet records
          before confirming — confirming is what grants the learner access.
        </Disclaimer>
      </div>
    </Card>
  );
}

function PaymentRow({ payment }: { payment: PaymentRequestDto }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(payment.adminNote ?? '');

  const decide = useMutation({
    mutationFn: (next: string) =>
      api.put<PaymentRequestDto>(`/admin/payments/${payment.id}`, { status: next, adminNote: note }),
    onSuccess: () => {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['engagement-overview'] });
    },
  });

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{payment.courseTitle}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            <span className="font-mono">{payment.reference}</span> · {payment.learnerName} &lt;
            {payment.learnerEmail}&gt; · {payment.countryCode}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-ink">{payment.amountLabel}</span>
          <Badge tone={PAYMENT_TONE[payment.status] ?? 'neutral'}>
            {payment.status === 'AwaitingConfirmation' ? 'Awaiting confirmation' : payment.status}
          </Badge>
          <Button size="sm" variant={open ? 'ghost' : 'secondary'} onClick={() => setOpen(!open)}>
            {open ? 'Cancel' : 'Review'}
          </Button>
        </div>
      </div>

      {payment.learnerNote && (
        <p className="mt-2 rounded-lg border border-line bg-surface-sunken px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
          <span className="label">Learner&rsquo;s reference</span>
          <br />
          {payment.learnerNote}
        </p>
      )}

      {!open && payment.confirmedByName && (
        <p className="mt-2 text-[11px] text-ink-faint">
          Decided by {payment.confirmedByName}
          {payment.decidedAt ? ` on ${formatDate(payment.decidedAt)}` : ''}
          {payment.adminNote ? ` · ${payment.adminNote}` : ''}
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-3 rounded-xl border border-line bg-surface-sunken p-4">
          <Field label="Internal note" hint="Why you confirmed or rejected. Never shown to the learner.">
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Matched against bank statement, 19 Sep."
            />
          </Field>

          {decide.isError && <ErrorPanel message={(decide.error as Error).message} />}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              loading={decide.isPending}
              onClick={() => decide.mutate('Rejected')}
            >
              Not received
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={decide.isPending}
              onClick={() => decide.mutate('Paid')}
              icon={<CreditCard size={13} />}
            >
              Confirm payment &amp; grant access
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
