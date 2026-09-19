import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SkillRadarPoint, WeeklyHoursPoint } from '@/types/api';
import { cn, scoreBar } from '@/lib/format';

const AXIS = { fontSize: 11, fill: 'rgb(107 114 133)' };
const GRID = 'rgb(39 44 62)';

const tooltipStyle = {
  backgroundColor: 'rgb(24 28 42)',
  border: '1px solid rgb(56 62 84)',
  borderRadius: 10,
  fontSize: 12,
  color: 'rgb(237 240 248)',
};

/** Circular progress. Used for readiness and completion figures. */
export function ProgressRing({
  value,
  label,
  detail,
  size = 92,
  stroke = 7,
}: {
  value: number;
  label?: string;
  detail?: string;
  size?: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  const colour =
    clamped >= 80 ? 'rgb(16 185 129)' : clamped >= 60 ? 'rgb(245 158 11)' : 'rgb(99 102 241)';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(39 44 62)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colour}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums text-ink">{Math.round(clamped)}%</span>
        </div>
      </div>
      {label && (
        <div className="text-center">
          <p className="text-xs font-medium text-ink">{label}</p>
          {detail && <p className="text-[11px] text-ink-faint">{detail}</p>}
        </div>
      )}
    </div>
  );
}

export function SkillRadar({ data }: { data: SkillRadarPoint[] }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={GRID} />
        <PolarAngleAxis dataKey="skill" tick={AXIS} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Target"
          dataKey="target"
          stroke="rgb(168 85 247)"
          fill="rgb(168 85 247)"
          fillOpacity={0.12}
        />
        <Radar
          name="Current"
          dataKey="current"
          stroke="rgb(99 102 241)"
          fill="rgb(99 102 241)"
          fillOpacity={0.35}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: 'rgb(156 163 185)' }} />
        <Tooltip contentStyle={tooltipStyle} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function WeeklyHoursChart({ data }: { data: WeeklyHoursPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="weekLabel" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${value as number} hrs`} />
        <Area
          type="monotone"
          dataKey="plannedHours"
          name="Planned"
          stroke="rgb(107 114 133)"
          strokeDasharray="4 4"
          fill="none"
        />
        <Area
          type="monotone"
          dataKey="actualHours"
          name="Actual"
          stroke="rgb(99 102 241)"
          strokeWidth={2}
          fill="url(#actualFill)"
        />
        <Legend wrapperStyle={{ fontSize: 11, color: 'rgb(156 163 185)' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Horizontal weighted bars — the readiness breakdown per dimension. */
export function ReadinessBars({
  data,
  showWeight = true,
}: {
  data: { name: string; score: number; weight?: number }[];
  showWeight?: boolean;
}) {
  return (
    <div className="space-y-3">
      {data.map((row) => (
        <div key={row.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-ink-muted">{row.name}</span>
            <span className="shrink-0 tabular-nums text-ink">
              {row.score}%
              {showWeight && row.weight !== undefined && (
                <span className="ml-1.5 text-ink-faint">w {Math.round(row.weight * 100)}%</span>
              )}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className={cn('h-full rounded-full transition-[width]', scoreBar(row.score))}
              style={{ width: `${row.score}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Compensation progression alongside the career ladder. */
export function CompProgression({
  stages,
}: {
  stages: { title: string; min: number; max: number; current: boolean }[];
}) {
  const ceiling = Math.max(...stages.map((s) => s.max), 1);

  return (
    <div className="space-y-2.5">
      {stages.map((stage) => (
        <div key={stage.title} className="flex items-center gap-3">
          <div className="w-28 shrink-0 truncate text-[11px] text-ink-faint">{stage.title}</div>
          <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-surface-sunken">
            <div
              className={cn(
                'absolute inset-y-0 rounded-md',
                stage.current
                  ? 'bg-gradient-to-r from-ink-faint/40 to-ink-faint/20'
                  : 'bg-gradient-to-r from-brand-600 to-accent-500',
              )}
              style={{
                left: `${(stage.min / ceiling) * 100}%`,
                width: `${((stage.max - stage.min) / ceiling) * 100}%`,
              }}
            />
          </div>
          <div className="w-28 shrink-0 text-right text-[11px] tabular-nums text-ink-muted">
            ${Math.round(stage.min / 1000)}K–${Math.round(stage.max / 1000)}K
          </div>
        </div>
      ))}
    </div>
  );
}

export function DonutStat({
  segments,
  centreLabel,
  centreValue,
}: {
  segments: { name: string; value: number; colour: string }[];
  centreLabel?: string;
  centreValue?: string;
}) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={segments}
            dataKey="value"
            innerRadius="66%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
          >
            {segments.map((segment) => (
              <Cell key={segment.name} fill={segment.colour} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      {centreValue && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-ink">{centreValue}</span>
          {centreLabel && <span className="text-[11px] text-ink-faint">{centreLabel}</span>}
        </div>
      )}
    </div>
  );
}

/** Compact streak strip — one cell per day, most recent on the right. */
export function StreakStrip({ days }: { days: { date: string; minutes: number }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {days.map((day) => (
        <div
          key={day.date}
          title={`${day.date}: ${day.minutes} min`}
          className={cn(
            'h-3.5 w-3.5 rounded-sm',
            day.minutes === 0
              ? 'bg-surface-sunken'
              : day.minutes < 45
                ? 'bg-brand-900'
                : day.minutes < 90
                  ? 'bg-brand-700'
                  : day.minutes < 150
                    ? 'bg-brand-500'
                    : 'bg-brand-400',
          )}
        />
      ))}
    </div>
  );
}
