export const cn = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ');

export function money(amount: number): string {
  if (amount >= 1000) return `$${Math.round(amount / 1000)}K`;
  return `$${amount}`;
}

export const salaryRange = (min: number, max: number) => `${money(min)}–${money(max)}+`;

export function hours(value: number): string {
  return `${value.toLocaleString()} hr${value === 1 ? '' : 's'}`;
}

export function minutesLabel(value: number): string {
  if (value < 60) return `${value}m`;
  const h = Math.floor(value / 60);
  const m = value % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** "VeryStrong" -> "Very Strong". The API already humanises most enums; this covers the rest. */
export function humanise(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export const DEMAND_TONE: Record<string, string> = {
  Explosive: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  'Very Strong': 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  Strong: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
  Moderate: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
};

export const RISK_TONE: Record<string, string> = {
  'Very Low': 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  Low: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
  Moderate: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  High: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
};

export const STATUS_TONE: Record<string, string> = {
  NotStarted: 'text-ink-faint bg-surface-sunken border-line',
  Scheduled: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
  InProgress: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  Completed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  Late: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
};

export function scoreTone(score: number): string {
  if (score >= 80) return 'text-emerald-300';
  if (score >= 60) return 'text-amber-300';
  return 'text-rose-300';
}

export function scoreBar(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-rose-500';
}
