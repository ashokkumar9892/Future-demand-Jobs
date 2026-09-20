import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Check, Copy, Mail, QrCode, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Disclaimer,
  ErrorPanel,
  Field,
  LoadingPanel,
  Textarea,
} from '@/components/ui';
import { cn } from '@/lib/format';
import type { CourseDetail, PaymentInstructions, PaymentMethod } from '@/types/api';

/**
 * How a learner pays for an advanced course.
 *
 * Nothing here takes a card number. The platform shows the operator's own QR or
 * contact address and a reference; the learner pays through their own bank or
 * wallet, then says so. Access opens when an administrator confirms receipt.
 */
export default function Checkout() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [methodId, setMethodId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const course = useQuery({
    queryKey: ['course', slug],
    queryFn: () => api.get<CourseDetail>(`/courses/${slug}`),
  });

  const courseId = course.data?.course.id;

  // Opening the page creates (or reopens) the payment. Choosing a different
  // method does not refetch: the choice is recorded when the learner declares
  // they have paid, so the reference they were shown never changes underneath
  // them.
  const payment = useQuery({
    queryKey: ['payment-start', courseId],
    queryFn: () => api.post<PaymentInstructions>(`/payments/courses/${courseId}`, {}),
    enabled: Boolean(courseId),
    staleTime: Infinity,
  });

  const declare = useMutation({
    mutationFn: async () => {
      const id = payment.data?.paymentRequestId;
      // Record which method they actually used before submitting.
      if (methodId) await api.post(`/payments/courses/${courseId}`, { methodId });
      return api.post(`/payments/${id}/declare`, { learnerNote: note.trim() || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      navigate('/my-learning');
    },
  });

  const methods = payment.data?.methods ?? [];
  const selected: PaymentMethod | undefined = methods.find((m) => m.id === methodId) ?? methods[0];

  const copy = (value: string, key: string) => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
      },
      () => setCopied(null),
    );
  };

  if (course.isLoading || payment.isLoading) return <LoadingPanel label="Preparing payment" />;

  if (course.error) return <ErrorPanel message={(course.error as Error).message} />;

  if (payment.error) {
    return (
      <>
        <PageHeader title="Payment" breadcrumb={[{ label: 'Courses', to: '/courses' }]} />
        <ErrorPanel message={(payment.error as Error).message} />
        <div className="mt-4">
          <Button variant="ghost" icon={<ArrowLeft size={14} />}>
            <Link to={`/courses/${slug}`} className="contents">
              Back to the course
            </Link>
          </Button>
        </div>
      </>
    );
  }

  if (!payment.data) return null;
  const instructions = payment.data;

  return (
    <>
      <PageHeader
        title={`Buy ${instructions.courseTitle}`}
        description="Pay from your own bank or wallet, quoting the reference below."
        breadcrumb={[
          { label: 'Courses', to: '/courses' },
          { label: instructions.courseTitle, to: `/courses/${slug}` },
          { label: 'Payment' },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Choose how to pay"
              subtitle={`${methods.length} option${methods.length === 1 ? '' : 's'} for your market`}
            />
            <div className="card-pad space-y-3">
              <div className="flex flex-wrap gap-2">
                {methods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setMethodId(method.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition',
                      method.id === selected?.id
                        ? 'border-brand-500/60 bg-brand-600/15 text-ink'
                        : 'border-line text-ink-muted hover:bg-surface-overlay',
                    )}
                  >
                    {method.kind === 'QrCode' ? <QrCode size={14} /> : <Mail size={14} />}
                    {method.label}
                  </button>
                ))}
              </div>

              {selected && (
                <div className="rounded-xl border border-line bg-surface-sunken p-4">
                  <p className="text-[13px] leading-relaxed text-ink-muted">{selected.instructions}</p>

                  {selected.kind === 'QrCode' && (selected.qrPayload || selected.qrImageUrl) && (
                    <div className="mt-4 flex flex-col items-center gap-3">
                      {selected.qrImageUrl ? (
                        <img
                          src={selected.qrImageUrl}
                          alt={`Payment QR for ${selected.label}`}
                          className="h-48 w-48 rounded-lg bg-white p-2"
                        />
                      ) : (
                        // Rendered here rather than fetched, so no payment
                        // detail is sent to a third-party QR service.
                        <div className="rounded-lg bg-white p-3">
                          <QRCodeSVG value={selected.qrPayload!} size={176} level="M" />
                        </div>
                      )}
                      <p className="text-[11px] text-ink-faint">
                        Scan with your banking or wallet app
                      </p>
                    </div>
                  )}

                  {selected.payeeEmail && (
                    <CopyRow
                      label="Email"
                      value={selected.payeeEmail}
                      copied={copied === 'email'}
                      onCopy={() => copy(selected.payeeEmail!, 'email')}
                      href={`mailto:${selected.payeeEmail}?subject=${encodeURIComponent(
                        `Payment ${instructions.reference} — ${instructions.courseTitle}`,
                      )}&body=${encodeURIComponent(
                        `Reference: ${instructions.reference}\nCourse: ${instructions.courseTitle}\nAmount: ${instructions.amountLabel}`,
                      )}`}
                    />
                  )}

                  {selected.reference && (
                    <CopyRow
                      label="Pay to"
                      value={selected.reference}
                      copied={copied === 'payee'}
                      onCopy={() => copy(selected.reference!, 'payee')}
                    />
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Tell us when you have paid"
              subtitle="Add whatever reference your bank or wallet gave you — it makes matching quicker"
            />
            <div className="card-pad space-y-3">
              <Field label="Your payment reference" hint="Optional, but it speeds up confirmation.">
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. UPI transaction 4029138877, paid this morning"
                  maxLength={1000}
                />
              </Field>

              {declare.isError && <ErrorPanel message={(declare.error as Error).message} />}

              <Button
                variant="primary"
                loading={declare.isPending}
                onClick={() => declare.mutate()}
                icon={<Check size={15} />}
              >
                I have paid — send for confirmation
              </Button>
              <p className="text-[11px] text-ink-faint">
                This does not charge you. It tells an administrator to look for your payment.
              </p>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="h-fit">
            <CardHeader title="Summary" />
            <dl className="card-pad space-y-3 text-[13px]">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-faint">Course</dt>
                <dd className="text-right text-ink">{instructions.courseTitle}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-faint">Amount</dt>
                <dd className="text-base font-semibold text-ink">{instructions.amountLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-faint">Market</dt>
                <dd className="text-ink">
                  {instructions.countryCode} · {instructions.currencyCode}
                </dd>
              </div>
              <div className="border-t border-line pt-3">
                <dt className="label">Quote this reference</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-surface-sunken px-2 py-1 font-mono text-[13px] text-ink">
                    {instructions.reference}
                  </code>
                  <button
                    onClick={() => copy(instructions.reference, 'ref')}
                    className="rounded-md p-1.5 text-ink-faint transition hover:bg-surface-overlay hover:text-ink"
                    aria-label="Copy reference"
                  >
                    {copied === 'ref' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-faint">Status</dt>
                <dd>
                  <Badge tone={instructions.status === 'Pending' ? 'info' : 'warning'}>
                    {instructions.status === 'AwaitingConfirmation'
                      ? 'Awaiting confirmation'
                      : instructions.status}
                  </Badge>
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="card-pad">
            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-muted">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand-400" />
              {instructions.notice}
            </p>
          </Card>

          <Disclaimer>
            Never enter a card number on this screen — it will never ask for one.
          </Disclaimer>
        </div>
      </div>
    </>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
  href,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  href?: string;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-base px-3 py-2">
      <div className="min-w-0">
        <p className="label">{label}</p>
        {href ? (
          <a href={href} className="link break-all font-mono text-[12px]">
            {value}
          </a>
        ) : (
          <p className="break-all font-mono text-[12px] text-ink">{value}</p>
        )}
      </div>
      <button
        onClick={onCopy}
        className="shrink-0 rounded-md p-1.5 text-ink-faint transition hover:bg-surface-overlay hover:text-ink"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
      </button>
    </div>
  );
}
