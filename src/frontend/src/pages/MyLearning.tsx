import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BadgeCheck,
  BookOpen,
  CreditCard,
  Download,
  ExternalLink,
  GraduationCap,
  Star,
  Target,
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
  Tabs,
  Textarea,
} from '@/components/ui';
import { formatDate, minutesLabel } from '@/lib/format';
import type { Certificate, Enrollment, PaymentRequestDto } from '@/types/api';

type Tab = 'courses' | 'certificates' | 'payments';

export default function MyLearning() {
  const [tab, setTab] = useState<Tab>('courses');

  const enrollments = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => api.get<Enrollment[]>('/enrollments'),
    enabled: !DEMO_MODE,
  });

  const certificates = useQuery({
    queryKey: ['certificates'],
    queryFn: () => api.get<Certificate[]>('/certificates'),
    enabled: !DEMO_MODE,
  });

  const payments = useQuery({
    queryKey: ['payments-mine'],
    queryFn: () => api.get<PaymentRequestDto[]>('/payments/mine'),
    enabled: !DEMO_MODE,
  });

  if (DEMO_MODE) {
    return (
      <>
        <PageHeader title="My learning" />
        <EmptyState
          icon={<GraduationCap size={22} />}
          title="Enrolments need the API"
          description="This browser-only build has no server to record enrolments, payments or certificates."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="My learning"
        description="The courses you enrolled in, what you set out to get from them, and the certificates you have earned."
      />

      <div className="mb-5">
        <Tabs
          tabs={[
            { key: 'courses' as const, label: 'Enrolled courses', count: enrollments.data?.length },
            { key: 'certificates' as const, label: 'Certificates', count: certificates.data?.length },
            { key: 'payments' as const, label: 'Payments', count: payments.data?.length },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'courses' && (
        <EnrolledCourses
          data={enrollments.data}
          isLoading={enrollments.isLoading}
          error={enrollments.error as Error | null}
        />
      )}
      {tab === 'certificates' && (
        <Certificates
          data={certificates.data}
          isLoading={certificates.isLoading}
          error={certificates.error as Error | null}
        />
      )}
      {tab === 'payments' && (
        <Payments data={payments.data} isLoading={payments.isLoading} error={payments.error as Error | null} />
      )}
    </>
  );
}

// ---------- enrolled courses ----------

function EnrolledCourses({
  data,
  isLoading,
  error,
}: {
  data?: Enrollment[];
  isLoading: boolean;
  error: Error | null;
}) {
  if (isLoading) return <LoadingPanel label="Loading your courses" />;
  if (error) return <ErrorPanel message={error.message} />;
  if (!data?.length) {
    return (
      <EmptyState
        icon={<BookOpen size={22} />}
        title="You have not enrolled in anything yet"
        description="Enrolling records what you want out of a course and how much time you mean to give it."
        action={
          <Button variant="primary">
            <Link to="/courses" className="contents">
              Browse courses
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {data.map((enrollment) => (
        <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
      ))}
    </div>
  );
}

function EnrollmentCard({ enrollment }: { enrollment: Enrollment }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState(enrollment.goal ?? '');
  const [hours, setHours] = useState(enrollment.weeklyHoursTarget);
  const [priority, setPriority] = useState(enrollment.isPriority);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    queryClient.invalidateQueries({ queryKey: ['certificates'] });
    queryClient.invalidateQueries({ queryKey: ['courses'] });
  };

  const save = useMutation({
    mutationFn: () =>
      api.put<Enrollment>(`/enrollments/${enrollment.courseId}`, {
        goal: goal.trim() || null,
        weeklyHoursTarget: hours,
        isPriority: priority,
      }),
    onSuccess: () => {
      setEditing(false);
      invalidate();
    },
  });

  const withdraw = useMutation({
    mutationFn: () => api.del<Enrollment>(`/enrollments/${enrollment.courseId}`),
    onSuccess: invalidate,
  });

  const claim = useMutation({
    mutationFn: () => api.post<Certificate>(`/certificates/courses/${enrollment.courseId}`),
    onSuccess: invalidate,
  });

  const remaining = Math.max(
    0,
    Math.ceil((enrollment.totalLessons * enrollment.certificateThresholdPercent) / 100) -
      enrollment.completedLessons,
  );

  return (
    <Card>
      <CardHeader
        title={enrollment.courseTitle}
        subtitle={`Phase ${enrollment.phaseNumber} · ${enrollment.careerTitle}`}
        action={
          <div className="flex items-center gap-1.5">
            {enrollment.isPriority && (
              <Badge tone="brand">
                <Star size={10} className="fill-current" />
                Focus
              </Badge>
            )}
            <Badge
              tone={
                enrollment.status === 'Completed'
                  ? 'success'
                  : enrollment.status === 'Withdrawn'
                    ? 'neutral'
                    : 'info'
              }
            >
              {enrollment.status}
            </Badge>
          </div>
        }
      />

      <div className="card-pad space-y-4">
        <div>
          <div className="flex items-center justify-between text-[11px] text-ink-faint">
            <span>
              {enrollment.completedLessons} of {enrollment.totalLessons} lessons ·{' '}
              {minutesLabel(enrollment.minutesStudied)}
            </span>
            <span className="tabular-nums">{enrollment.progressPercent}%</span>
          </div>
          <Progress value={enrollment.progressPercent} className="mt-1.5" />
          <p className="mt-1.5 text-[11px] text-ink-faint">
            {enrollment.certificateNumber ? (
              <span className="text-emerald-300">
                Certificate {enrollment.certificateNumber} issued.
              </span>
            ) : enrollment.certificateEligible ? (
              <span className="text-emerald-300">
                You have passed {enrollment.certificateThresholdPercent}% — your certificate is ready
                to claim.
              </span>
            ) : (
              `${remaining} more lesson${remaining === 1 ? '' : 's'} to reach the ${
                enrollment.certificateThresholdPercent
              }% certificate threshold.`
            )}
          </p>
        </div>

        {!editing && (
          <dl className="grid gap-2 text-[12px] sm:grid-cols-2">
            <div>
              <dt className="label">Your goal</dt>
              <dd className="mt-0.5 text-ink-muted">{enrollment.goal || 'Not set'}</dd>
            </div>
            <div>
              <dt className="label">Weekly target</dt>
              <dd className="mt-0.5 text-ink-muted">
                {enrollment.weeklyHoursTarget > 0
                  ? `${enrollment.weeklyHoursTarget} hrs/week`
                  : 'Not set'}
              </dd>
            </div>
          </dl>
        )}

        {editing && (
          <div className="space-y-3 rounded-xl border border-line bg-surface-sunken p-3">
            <Field label="What do you want out of this course?">
              <Textarea rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={500} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Hours a week" hint="0 to leave it unset.">
                <Input
                  type="number"
                  min={0}
                  max={60}
                  step={0.5}
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                />
              </Field>
              <Field label="Focus course">
                <label className="flex h-9 items-center gap-2 text-sm text-ink-muted">
                  <input
                    type="checkbox"
                    checked={priority}
                    onChange={(e) => setPriority(e.target.checked)}
                    className="accent-brand-500"
                  />
                  Pin to the top
                </label>
              </Field>
            </div>
            {save.isError && <ErrorPanel message={(save.error as Error).message} />}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
                Save
              </Button>
            </div>
          </div>
        )}

        {claim.isError && <ErrorPanel message={(claim.error as Error).message} />}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary">
            <Link to={`/courses/${enrollment.courseSlug}`} className="contents">
              Open course
            </Link>
          </Button>
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} icon={<Target size={13} />}>
              Edit goal
            </Button>
          )}
          {enrollment.certificateEligible && !enrollment.certificateNumber && (
            <Button
              size="sm"
              variant="primary"
              loading={claim.isPending}
              onClick={() => claim.mutate()}
              icon={<Award size={13} />}
            >
              Claim certificate
            </Button>
          )}
          {enrollment.status !== 'Withdrawn' && (
            <Button
              size="sm"
              variant="ghost"
              loading={withdraw.isPending}
              onClick={() => {
                if (confirm('Withdraw from this course? Your lesson progress is kept.')) withdraw.mutate();
              }}
              className="ml-auto text-ink-faint"
            >
              Withdraw
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------- certificates ----------

function Certificates({
  data,
  isLoading,
  error,
}: {
  data?: Certificate[];
  isLoading: boolean;
  error: Error | null;
}) {
  if (isLoading) return <LoadingPanel label="Loading certificates" />;
  if (error) return <ErrorPanel message={error.message} />;
  if (!data?.length) {
    return (
      <EmptyState
        icon={<Award size={22} />}
        title="No certificates yet"
        description="Finish 80% of a course's lessons and you can claim its completion certificate from the Enrolled courses tab."
      />
    );
  }

  return (
    <div className="space-y-5">
      {data.map((certificate) => (
        <CertificateSheet key={certificate.id} certificate={certificate} />
      ))}

      <Disclaimer>
        These record lesson completion on this platform. They are not accredited qualifications and do
        not certify professional competence. Anyone can check a certificate number at{' '}
        <code>/verify</code>.
      </Disclaimer>
    </div>
  );
}

function CertificateSheet({ certificate }: { certificate: Certificate }) {
  return (
    <Card className="overflow-hidden print:border-0">
      <div className="relative bg-[radial-gradient(40rem_20rem_at_20%_-20%,rgb(79_70_229/0.18),transparent)] px-8 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label">FutureTech Career Academy</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">
              Certificate of course completion
            </h2>
          </div>
          <BadgeCheck size={34} className="shrink-0 text-brand-400" />
        </div>

        <p className="mt-8 text-[11px] uppercase tracking-wider text-ink-faint">Awarded to</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{certificate.learnerName}</p>

        <p className="mt-6 text-[11px] uppercase tracking-wider text-ink-faint">For completing</p>
        <p className="mt-1 text-base font-medium text-ink">{certificate.courseTitle}</p>
        {certificate.careerTitle && (
          <p className="text-xs text-ink-muted">{certificate.careerTitle} track</p>
        )}

        <dl className="mt-8 grid gap-4 border-t border-line pt-5 text-[12px] sm:grid-cols-4">
          <div>
            <dt className="label">Completion</dt>
            <dd className="mt-0.5 text-ink">
              {certificate.percentComplete}% ({certificate.lessonsCompleted}/{certificate.totalLessons}{' '}
              lessons)
            </dd>
          </div>
          <div>
            <dt className="label">Time studied</dt>
            <dd className="mt-0.5 text-ink">{minutesLabel(certificate.minutesStudied)}</dd>
          </div>
          <div>
            <dt className="label">Issued</dt>
            <dd className="mt-0.5 text-ink">{formatDate(certificate.issuedAt)}</dd>
          </div>
          <div>
            <dt className="label">Certificate no.</dt>
            <dd className="mt-0.5 font-mono text-[11px] text-ink">{certificate.certificateNumber}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 print:hidden">
        <Button size="sm" variant="secondary" onClick={() => window.print()} icon={<Download size={13} />}>
          Print or save as PDF
        </Button>
        <Button size="sm" variant="ghost">
          <Link to={`/verify/${certificate.certificateNumber}`} className="contents">
            <ExternalLink size={13} />
            Verification page
          </Link>
        </Button>
        <span className="ml-auto text-[11px] text-ink-faint">
          The name comes from your certificate-name preference in Settings.
        </span>
      </div>
    </Card>
  );
}

// ---------- payments ----------

function Payments({
  data,
  isLoading,
  error,
}: {
  data?: PaymentRequestDto[];
  isLoading: boolean;
  error: Error | null;
}) {
  if (isLoading) return <LoadingPanel label="Loading payments" />;
  if (error) return <ErrorPanel message={error.message} />;
  if (!data?.length) {
    return (
      <EmptyState
        icon={<CreditCard size={22} />}
        title="No payments"
        description="Free courses need no payment. Advanced courses show a pay option on the course page."
      />
    );
  }

  const tone = (status: PaymentRequestDto['status']) =>
    status === 'Paid'
      ? 'success'
      : status === 'Rejected' || status === 'Cancelled'
        ? 'danger'
        : status === 'AwaitingConfirmation'
          ? 'warning'
          : 'info';

  return (
    <Card>
      <CardHeader title="Your payments" subtitle="Advanced courses you have bought or are paying for" />
      <div className="divide-y divide-line">
        {data.map((payment) => (
          <div key={payment.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-ink">{payment.courseTitle}</p>
              <p className="text-[11px] text-ink-faint">
                <span className="font-mono">{payment.reference}</span> · {payment.amountLabel} ·{' '}
                {payment.method === 'QrCode' ? 'QR' : payment.method} · {formatDate(payment.createdAt)}
              </p>
              {payment.learnerNote && (
                <p className="mt-0.5 text-[11px] text-ink-faint">Your note: {payment.learnerNote}</p>
              )}
            </div>
            <Badge tone={tone(payment.status)}>
              {payment.status === 'AwaitingConfirmation' ? 'Awaiting confirmation' : payment.status}
            </Badge>
          </div>
        ))}
      </div>
      <div className="border-t border-line px-5 py-3">
        <Disclaimer>
          This platform does not process card payments. Money moves through your own bank or wallet, and
          an administrator confirms it arrived before access opens.
        </Disclaimer>
      </div>
    </Card>
  );
}
