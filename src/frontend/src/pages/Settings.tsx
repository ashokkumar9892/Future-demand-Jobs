import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Moon, Save, Sun, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth, useTheme } from '@/app/providers';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Disclaimer,
  ErrorPanel,
  Field,
  Input,
  LoadingPanel,
  Select,
  Stat,
} from '@/components/ui';
import { cn, money } from '@/lib/format';
import type { CareerSummary, StudyCalculation, StudyProfileDto, TrackMode } from '@/types/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Settings() {
  const { user, refresh } = useAuth();
  const { theme, toggle } = useTheme();
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: ['study-profile'],
    queryFn: () => api.get<StudyProfileDto>('/study/profile'),
  });

  const careers = useQuery({
    queryKey: ['careers'],
    queryFn: () => api.get<CareerSummary[]>('/careers'),
  });

  const [weekday, setWeekday] = useState(1.5);
  const [saturday, setSaturday] = useState(3);
  const [sunday, setSunday] = useState(3);
  const [days, setDays] = useState<string[]>(DAYS);
  const [careerId, setCareerId] = useState('');
  const [salary, setSalary] = useState(200_000);
  const [level, setLevel] = useState(70);
  const [track, setTrack] = useState<TrackMode>('Balanced');
  const [targetDate, setTargetDate] = useState('');

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    setWeekday(p.weekdayHours);
    setSaturday(p.saturdayHours);
    setSunday(p.sundayHours);
    setDays(p.studyDays.length ? p.studyDays : DAYS);
    setCareerId(p.targetCareerPathId ?? '');
    setSalary(p.desiredSalaryUsd);
    setLevel(p.currentSkillLevel);
    setTrack(p.trackMode);
    setTargetDate(p.targetCompletionDate ?? '');
  }, [profile.data]);

  const weeklyHours = useMemo(() => {
    const weekdayCount = days.filter((d) => d !== 'Saturday' && d !== 'Sunday').length;
    return (
      weekday * weekdayCount +
      (days.includes('Saturday') ? saturday : 0) +
      (days.includes('Sunday') ? sunday : 0)
    );
  }, [weekday, saturday, sunday, days]);

  const estimate = useQuery({
    queryKey: ['calc', weeklyHours, track, careerId],
    queryFn: () =>
      api.post<StudyCalculation>('/study/calculate', {
        weeklyHours,
        trackMode: track,
        careerPathId: careerId || null,
      }),
    enabled: weeklyHours > 0,
  });

  const save = useMutation({
    mutationFn: () =>
      api.put('/study/profile', {
        weekdayHours: weekday,
        saturdayHours: saturday,
        sundayHours: sunday,
        studyDays: days,
        targetCompletionDate: targetDate || null,
        targetCareerPathId: careerId || null,
        desiredSalaryUsd: salary,
        currentSkillLevel: level,
        trackMode: track,
        completeOnboarding: true,
      }),
    onSuccess: async () => {
      await refresh();
      queryClient.invalidateQueries();
    },
  });

  const setTheme = useMutation({
    mutationFn: (next: string) => api.put('/auth/theme', { theme: next }),
  });

  if (profile.isLoading) return <LoadingPanel label="Loading settings" />;
  if (profile.error) return <ErrorPanel message={(profile.error as Error).message} />;

  const toggleDay = (day: string) =>
    setDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    );

  return (
    <>
      <PageHeader
        title="Settings"
        description="Change your study capacity, target role or depth and the whole plan recalculates — including the calendar ahead of you."
        actions={
          <Button
            variant="primary"
            loading={save.isPending}
            onClick={() => save.mutate()}
            icon={<Save size={15} />}
          >
            Save and regenerate plan
          </Button>
        }
      />

      {save.isSuccess && (
        <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Saved. Your study calendar has been regenerated from today forward.
        </div>
      )}
      {save.isError && (
        <div className="mb-5">
          <ErrorPanel message={(save.error as Error).message} />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader title="Study time" subtitle={`${weeklyHours.toFixed(1)} hours per week`} icon={<Clock size={15} />} />
            <div className="card-pad">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Monday – Friday" hint="hours per day">
                  <Input
                    type="number"
                    min={0}
                    max={12}
                    step={0.5}
                    value={weekday}
                    onChange={(e) => setWeekday(Number(e.target.value))}
                  />
                </Field>
                <Field label="Saturday" hint="hours">
                  <Input
                    type="number"
                    min={0}
                    max={16}
                    step={0.5}
                    value={saturday}
                    onChange={(e) => setSaturday(Number(e.target.value))}
                  />
                </Field>
                <Field label="Sunday" hint="hours">
                  <Input
                    type="number"
                    min={0}
                    max={16}
                    step={0.5}
                    value={sunday}
                    onChange={(e) => setSunday(Number(e.target.value))}
                  />
                </Field>
              </div>

              <div className="mt-5">
                <p className="label mb-2">Study days</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                        days.includes(day)
                          ? 'border-brand-500/60 bg-brand-600/15 text-ink'
                          : 'border-line text-ink-faint hover:text-ink-muted',
                      )}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Target and depth" />
            <div className="card-pad">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Target career">
                  <Select value={careerId} onChange={(e) => setCareerId(e.target.value)}>
                    <option value="">Not set</option>
                    {(careers.data ?? []).map((career) => (
                      <option key={career.id} value={career.id}>
                        {career.rank}. {career.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Track depth">
                  <Select value={track} onChange={(e) => setTrack(e.target.value as TrackMode)}>
                    <option value="FastTrack">Fast Track — job-critical only</option>
                    <option value="Balanced">Balanced — the full programme</option>
                    <option value="Deep">Deep Learning — everything</option>
                  </Select>
                </Field>
                <Field label="Desired salary (USD)">
                  <Input
                    type="number"
                    min={50_000}
                    max={600_000}
                    step={5_000}
                    value={salary}
                    onChange={(e) => setSalary(Number(e.target.value))}
                  />
                </Field>
                <Field label="Desired completion date" hint="Optional.">
                  <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                </Field>
              </div>

              <div className="mt-4">
                <Field label={`Current skill level — ${level}`}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={level}
                    onChange={(e) => setLevel(Number(e.target.value))}
                    className="w-full accent-brand-500"
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Account" icon={<User size={15} />} />
            <div className="card-pad">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Row label="Name" value={user?.displayName ?? '—'} />
                <Row label="Email" value={user?.email ?? '—'} />
                <Row label="Role" value={user?.role ?? '—'} />
                <Row label="Years of experience" value={String(user?.yearsExperience ?? 0)} />
              </dl>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
                <div>
                  <p className="text-sm text-ink">Appearance</p>
                  <p className="text-[11px] text-ink-faint">
                    Dark is the default — this is a tool for long evening sessions.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    toggle();
                    setTheme.mutate(theme === 'dark' ? 'light' : 'dark');
                  }}
                  icon={theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                >
                  {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="What this changes" subtitle="Recalculated live" />
            <div className="card-pad">
              {estimate.data ? (
                <div className="space-y-4">
                  <Stat
                    label="Total training"
                    value={`${estimate.data.totalCourseHours} hrs`}
                    detail={`${estimate.data.trackMode} track`}
                  />
                  <Stat
                    label="Remaining"
                    value={`${estimate.data.hoursRemaining} hrs`}
                    detail={`${estimate.data.hoursCompleted} hrs completed`}
                  />
                  <Stat
                    label="Duration"
                    value={`${estimate.data.weeksRemaining} weeks`}
                    detail={`~${estimate.data.monthsRemaining} months · ${estimate.data.daysRemaining} days`}
                  />
                  <Stat
                    label="Estimated completion"
                    value={estimate.data.estimatedCompletionMonth}
                    detail={estimate.data.estimatedCompletionDate}
                  />
                  <Stat
                    label="Daily requirement"
                    value={`${estimate.data.dailyHoursRequired} hrs`}
                    detail="on each study day"
                  />
                </div>
              ) : (
                <p className="text-sm text-ink-faint">Adjust your hours to see the effect.</p>
              )}
            </div>
          </Card>

          {estimate.data && (
            <Card>
              <CardHeader title="If you changed pace" />
              <div className="divide-y divide-line">
                {estimate.data.paceScenarios.map((scenario) => (
                  <div
                    key={scenario.label}
                    className={cn(
                      'flex items-center justify-between gap-3 px-5 py-2.5',
                      Math.abs(scenario.weeklyHours - weeklyHours) < 0.6 && 'bg-brand-600/10',
                    )}
                  >
                    <span className="text-[12px] text-ink-muted">{scenario.label}</span>
                    <span className="text-[12px] tabular-nums text-ink">
                      {scenario.weeks} weeks · ~{scenario.months} months
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {estimate.data && estimate.data.breakdown.length > 0 && (
            <Card>
              <CardHeader title="Hours by phase" />
              <div className="divide-y divide-line">
                {estimate.data.breakdown.map((area) => (
                  <div key={area.area} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="truncate text-[12px] text-ink-muted">{area.area}</span>
                    <span className="shrink-0 text-[12px] tabular-nums text-ink-faint">
                      {area.completedHours}/{area.hours} hrs
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="card-pad">
            <p className="label">Target salary</p>
            <p className="stat-value mt-1">{money(salary)}</p>
            {careers.data && careerId && (
              <p className="mt-1 text-[11px] text-ink-faint">
                {careers.data.find((c) => c.id === careerId)?.title} pays{' '}
                {money(careers.data.find((c) => c.id === careerId)?.salaryMinUsd ?? 0)}–
                {money(careers.data.find((c) => c.id === careerId)?.salaryMaxUsd ?? 0)}
              </p>
            )}
            <Badge tone="neutral" className="mt-3">
              {weeklyHours.toFixed(1)} hrs/week
            </Badge>
          </Card>

          <Disclaimer>{estimate.data?.disclaimer}</Disclaimer>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="truncate text-sm text-ink">{value}</dd>
    </div>
  );
}
