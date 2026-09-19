import { Star } from 'lucide-react';
import type { FeedbackStatus } from '@/types/api';

/** Shared by the learner page and the admin queue so one status never reads two ways. */
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
