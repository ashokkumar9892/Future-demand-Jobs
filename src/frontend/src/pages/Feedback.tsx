import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MessageSquarePlus, Star } from 'lucide-react';
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
  Select,
  Textarea,
} from '@/components/ui';
import { cn, formatDate } from '@/lib/format';
import type { Feedback, FeedbackCategory, FeedbackStatus } from '@/types/api';

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'Course', label: 'A course' },
  { value: 'Lesson', label: 'A lesson' },
  { value: 'Video', label: 'A video' },
  { value: 'Practice', label: 'Practice or interview questions' },
  { value: 'Project', label: 'A project' },
  { value: 'Content', label: 'Content accuracy' },
  { value: 'Bug', label: 'Something is broken' },
  { value: 'FeatureRequest', label: 'A feature request' },
  { value: 'General', label: 'General' },
];

/** Shared with the admin console so one status never reads two ways. */
export const STATUS_TONE: Record<FeedbackStatus, 'neutral' | 'brand' | 'success' | 'warning' | 'info'> = {
  New: 'info',
  UnderReview: 'warning',
  Planned: 'brand',
  InProgress: 'brand',
  Implemented: 'success',
  Declined: 'neutral',
};

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  New: 'New',
  UnderReview: 'Under review',
  Planned: 'Planned',
  InProgress: 'In progress',
  Implemented: 'Implemented',
  Declined: 'Not planned',
};

export default function FeedbackPage() {
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<FeedbackCategory>('Course');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [area, setArea] = useState('');
  const [rating, setRating] = useState(0);
  const [sent, setSent] = useState(false);

  const mine = useQuery({
    queryKey: ['feedback-mine'],
    queryFn: () => api.get<Feedback[]>('/feedback/mine'),
    enabled: !DEMO_MODE,
  });

  const submit = useMutation({
    mutationFn: () =>
      api.post<Feedback>('/feedback', {
        category,
        subject: subject.trim(),
        message: message.trim(),
        rating,
        area: area.trim() || null,
      }),
    onSuccess: () => {
      setSubject('');
      setMessage('');
      setArea('');
      setRating(0);
      setSent(true);
      queryClient.invalidateQueries({ queryKey: ['feedback-mine'] });
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSent(false);
    submit.mutate();
  };

  if (DEMO_MODE) {
    return (
      <>
        <PageHeader title="Feedback" description="Tell us what to fix, add or explain better." />
        <EmptyState
          icon={<MessageSquarePlus size={22} />}
          title="Feedback needs the API"
          description="This build runs entirely in your browser, so there is nowhere to store feedback. Run the platform against the .NET API to use this screen."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Feedback"
        description="Tell us what to fix, add or explain better. Every item is read, and you will see here what was decided."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Send feedback" icon={<MessageSquarePlus size={15} />} />
          <form onSubmit={onSubmit} className="card-pad space-y-4">
            <Field label="What is this about?">
              <Select value={category} onChange={(e) => setCategory(e.target.value as FeedbackCategory)}>
                {CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Subject">
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="One line that sums it up"
                maxLength={200}
                required
              />
            </Field>

            <Field
              label="Which part of the platform?"
              hint="Optional — a course, phase or page name helps us find it."
            >
              <Input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. Phase 3 — AWS, retrieval lesson"
                maxLength={200}
              />
            </Field>

            <Field label="Details" hint="At least 10 characters.">
              <Textarea
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What happened, what you expected, or what would make this better."
                maxLength={4000}
                required
              />
            </Field>

            <Field label="How is the platform working for you?" hint="Optional.">
              <RatingPicker value={rating} onChange={setRating} />
            </Field>

            {submit.isError && <ErrorPanel message={(submit.error as Error).message} />}

            {sent && (
              <p className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                <CheckCircle2 size={14} />
                Thanks — it is in the queue and will show below.
              </p>
            )}

            <Button type="submit" variant="primary" loading={submit.isPending} className="w-full">
              Send feedback
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Your feedback"
              subtitle={`${mine.data?.length ?? 0} item${mine.data?.length === 1 ? '' : 's'}`}
            />
            {mine.isLoading && <LoadingPanel label="Loading your feedback" />}
            {mine.error && (
              <div className="p-4">
                <ErrorPanel message={(mine.error as Error).message} />
              </div>
            )}
            {mine.data?.length === 0 && (
              <div className="p-4">
                <EmptyState
                  title="Nothing sent yet"
                  description="Anything you send appears here with its status and any reply."
                />
              </div>
            )}
            <div className="divide-y divide-line">
              {(mine.data ?? []).map((item) => (
                <FeedbackCard key={item.id} item={item} />
              ))}
            </div>
          </Card>

          <Disclaimer>
            Feedback is stored with your account so a reply can reach you. It is visible to platform
            administrators.
          </Disclaimer>
        </div>
      </div>
    </>
  );
}

function FeedbackCard({ item }: { item: Feedback }) {
  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{item.subject}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            {item.category.replace(/([a-z])([A-Z])/g, '$1 $2')}
            {item.area ? ` · ${item.area}` : ''} · {formatDate(item.submittedAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.rating > 0 && <RatingStars value={item.rating} />}
          <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
        </div>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-muted">{item.message}</p>

      {item.adminResponse && (
        <div className="mt-3 rounded-lg border border-line bg-surface-sunken px-3 py-2.5">
          <p className="label">Reply{item.handledByName ? ` from ${item.handledByName}` : ''}</p>
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-muted">
            {item.adminResponse}
          </p>
        </div>
      )}

      {item.implementationNote && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-emerald-300">
          <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
          <span>
            {item.implementationNote}
            {item.implementedAt ? ` · ${formatDate(item.implementedAt)}` : ''}
          </span>
        </p>
      )}
    </div>
  );
}

function RatingPicker({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          // Clicking the active score clears it, so a rating stays optional.
          onClick={() => onChange(value === score ? 0 : score)}
          aria-label={`${score} out of 5`}
          aria-pressed={value === score}
          className="rounded-md p-1 transition hover:bg-surface-overlay"
        >
          <Star
            size={18}
            className={cn(
              'transition',
              score <= value ? 'fill-amber-400 text-amber-400' : 'text-ink-faint',
            )}
          />
        </button>
      ))}
      {value > 0 && <span className="ml-1 text-xs text-ink-faint">{value} / 5</span>}
    </div>
  );
}

export function RatingStars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((score) => (
        <Star
          key={score}
          size={12}
          className={score <= value ? 'fill-amber-400 text-amber-400' : 'text-ink-faint/40'}
        />
      ))}
    </span>
  );
}
