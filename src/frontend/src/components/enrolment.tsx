import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Lock, Sparkles, Target } from 'lucide-react';
import { useAuth } from '@/app/providers';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorPanel,
  Field,
  Input,
  Textarea,
} from '@/components/ui';
import type { CourseListItem, Enrollment } from '@/types/api';

/**
 * Enrolment, access state and the certificate claim for one course.
 *
 * An advanced course shows what it costs and links to payment. The module
 * outline on the page around it stays visible either way, so a learner can see
 * what they would be buying before they buy it.
 */
export function EnrolmentPanel({ course }: { course: CourseListItem }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [hours, setHours] = useState(4);

  // An enrolment belongs to an account. Asking for one anonymously 401s on
  // every course a visitor opens, so the panel invites them to sign up instead.
  const enrollments = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => api.get<Enrollment[]>('/enrollments'),
    enabled: Boolean(user),
  });

  const mine = enrollments.data?.find((e) => e.courseId === course.id && e.status !== 'Withdrawn');
  const access = course.access;
  const locked = Boolean(access && !access.hasAccess);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    queryClient.invalidateQueries({ queryKey: ['courses'] });
    queryClient.invalidateQueries({ queryKey: ['course', course.slug] });
    queryClient.invalidateQueries({ queryKey: ['certificates'] });
  };

  const enroll = useMutation({
    mutationFn: () =>
      api.post<Enrollment>(`/enrollments/${course.id}`, {
        goal: goal.trim() || null,
        weeklyHoursTarget: hours,
        isPriority: false,
      }),
    onSuccess: () => {
      setOpen(false);
      invalidate();
    },
  });

  const claim = useMutation({
    mutationFn: () => api.post(`/certificates/courses/${course.id}`),
    onSuccess: invalidate,
  });

  // Placed after the hooks above, not before them: an early return ahead of a
  // hook changes the hook order between renders.
  //
  // A guest previously got the full enrolment form, filled it in, pressed
  // Confirm and was told "Request failed (401)". The API is right to refuse —
  // an enrolment has to belong to someone — so the fix is to stop offering it.
  // The badge stays: what the course costs is exactly what someone deciding
  // whether to sign up wants to know.
  if (!user) {
    return (
      <Card className="mb-5">
        <CardHeader
          title="Enrol in this course"
          subtitle="Enrolment records your goal and tracks progress towards the certificate."
          icon={<Target size={15} />}
          action={
            access && (
              <Badge tone={access.isFree ? 'success' : 'warning'}>
                {access.isFree ? (
                  'Free'
                ) : (
                  <>
                    <Lock size={10} />
                    {access.priceLabel ?? 'Advanced'}
                  </>
                )}
              </Badge>
            )
          }
        />
        <div className="card-pad">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            <Link to="/register" className="text-brand-400 transition hover:underline">
              Create a free account
            </Link>{' '}
            to enrol, or{' '}
            <Link to="/login" className="text-brand-400 transition hover:underline">
              sign in
            </Link>
            .{' '}
            {locked
              ? 'This one is paid, so the lessons open once you have an account and have bought it.'
              : 'The lessons below are readable without one — an account is what saves your progress and issues the certificate.'}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-5">
      <CardHeader
        title={locked ? 'Advanced course' : mine ? 'You are enrolled' : 'Enrol in this course'}
        subtitle={
          locked
            ? access?.message
            : mine
              ? mine.goal || 'Your progress and certificate are tracked here.'
              : 'Records what you want from it and how much time you mean to give it.'
        }
        icon={locked ? <Lock size={15} /> : <Target size={15} />}
        action={
          access && (
            <Badge tone={access.isFree || access.hasAccess ? 'success' : 'warning'}>
              {access.isFree ? (
                'Free'
              ) : access.hasAccess ? (
                <>
                  <Sparkles size={10} />
                  Advanced · yours
                </>
              ) : (
                <>
                  <Lock size={10} />
                  {access.priceLabel ?? 'Advanced'}
                </>
              )}
            </Badge>
          )
        }
      />

      <div className="card-pad space-y-3">
        {locked && access?.state === 'PaymentRequired' && (
          <Button variant="primary">
            <Link to={`/courses/${course.slug}/buy`} className="contents">
              Buy for {access.priceLabel}
            </Link>
          </Button>
        )}

        {locked && access?.state === 'AwaitingConfirmation' && (
          <p className="text-[13px] text-amber-300">
            Payment {access.paymentReference} is waiting to be confirmed. Access opens as soon as an
            administrator checks it.
          </p>
        )}

        {locked && access?.state === 'NotSoldHere' && (
          <p className="text-[13px] text-ink-muted">
            If you buy from another country, change your market in the header.
          </p>
        )}

        {!locked && !mine && !open && (
          <Button variant="primary" onClick={() => setOpen(true)} icon={<Target size={14} />}>
            Enrol
          </Button>
        )}

        {!locked && !mine && open && (
          <div className="space-y-3">
            <Field label="What do you want out of this course?" hint="Optional.">
              <Textarea
                rows={2}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Be able to defend an event-driven design in an interview"
                maxLength={500}
              />
            </Field>
            <Field label="Hours a week you can give it">
              <Input
                type="number"
                min={0}
                max={60}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-32"
              />
            </Field>
            {enroll.isError && <ErrorPanel message={(enroll.error as Error).message} />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={enroll.isPending} onClick={() => enroll.mutate()}>
                Confirm enrolment
              </Button>
            </div>
          </div>
        )}

        {mine && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[12px] text-ink-muted">
              {mine.certificateNumber ? (
                <span className="text-emerald-300">Certificate {mine.certificateNumber} issued.</span>
              ) : mine.certificateEligible ? (
                <span className="text-emerald-300">
                  You have passed {mine.certificateThresholdPercent}% — claim your certificate.
                </span>
              ) : (
                `Certificate unlocks at ${mine.certificateThresholdPercent}% complete. You are at ${mine.progressPercent}%.`
              )}
            </p>
            {mine.certificateEligible && !mine.certificateNumber && (
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
            <Button size="sm" variant="ghost" className="ml-auto">
              <Link to="/my-learning" className="contents">
                My learning
              </Link>
            </Button>
          </div>
        )}

        {claim.isError && <ErrorPanel message={(claim.error as Error).message} />}
      </div>
    </Card>
  );
}
