import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Clock, Gauge, Rocket, Target, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { Button, Card, Disclaimer, ErrorPanel, Field, Input, LoadingPanel } from '@/components/ui';
import { cn, money } from '@/lib/format';
import type { CareerSummary, StudyCalculation, TrackMode } from '@/types/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TRACKS: { key: TrackMode; title: string; hours: string; description: string }[] = [
  {
    key: 'FastTrack',
    title: 'Fast Track',
    hours: '≈150–180 hours',
    description: 'Job-critical topics only. Skips optional depth and secondary cloud coverage.',
  },
  {
    key: 'Balanced',
    title: 'Balanced',
    hours: '≈250–310 hours',
    description: 'The full programme as designed. Recommended for most transitions.',
  },
  {
    key: 'Deep',
    title: 'Deep Learning',
    hours: '400+ hours',
    description: 'Everything, including optional depth and the second cloud platform in full.',
  },
];

const STEPS = [
  { key: 'hours', title: 'Study time', icon: <Clock size={15} /> },
  { key: 'days', title: 'Study days', icon: <Clock size={15} /> },
  { key: 'target', title: 'Target role', icon: <Target size={15} /> },
  { key: 'salary', title: 'Salary & level', icon: <Wallet size={15} /> },
  { key: 'track', title: 'Depth', icon: <Gauge size={15} /> },
  { key: 'date', title: 'Completion date', icon: <Rocket size={15} /> },
  { key: 'review', title: 'Review', icon: <Check size={15} /> },
] as const;

export default function Onboarding() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [step, setStep] = useState(0);

  const [weekdayHours, setWeekdayHours] = useState(1.5);
  const [saturdayHours, setSaturdayHours] = useState(3);
  const [sundayHours, setSundayHours] = useState(3);
  const [studyDays, setStudyDays] = useState<string[]>(DAYS);
  const [careerId, setCareerId] = useState<string>('');
  const [desiredSalary, setDesiredSalary] = useState(200_000);
  const [skillLevel, setSkillLevel] = useState(70);
  const [years, setYears] = useState(20);
  const [trackMode, setTrackMode] = useState<TrackMode>('Balanced');
  const [targetDate, setTargetDate] = useState('');

  const careers = useQuery({
    queryKey: ['careers'],
    queryFn: () => api.get<CareerSummary[]>('/careers'),
  });

  const primary = careers.data?.find((c) => c.isPrimaryRecommended) ?? careers.data?.[0];
  const selectedCareer = careers.data?.find((c) => c.id === (careerId || primary?.id));

  const weeklyHours = useMemo(() => {
    const weekdayCount = studyDays.filter((d) => d !== 'Saturday' && d !== 'Sunday').length;
    return (
      weekdayHours * weekdayCount +
      (studyDays.includes('Saturday') ? saturdayHours : 0) +
      (studyDays.includes('Sunday') ? sundayHours : 0)
    );
  }, [weekdayHours, saturdayHours, sundayHours, studyDays]);

  const estimate = useQuery({
    queryKey: ['calc', weeklyHours, trackMode, selectedCareer?.id],
    queryFn: () =>
      api.post<StudyCalculation>('/study/calculate', {
        weeklyHours,
        trackMode,
        careerPathId: selectedCareer?.id,
      }),
    enabled: weeklyHours > 0 && !!selectedCareer,
  });

  const save = useMutation({
    mutationFn: () =>
      api.put('/study/profile', {
        weekdayHours,
        saturdayHours,
        sundayHours,
        studyDays,
        targetCompletionDate: targetDate || null,
        targetCareerPathId: selectedCareer?.id,
        desiredSalaryUsd: desiredSalary,
        currentSkillLevel: skillLevel,
        yearsExperience: years,
        trackMode,
        completeOnboarding: true,
      }),
    onSuccess: async () => {
      await refresh();
      navigate('/', { replace: true });
    },
  });

  const toggleDay = (day: string) =>
    setStudyDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    );

  if (careers.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base">
        <LoadingPanel label="Preparing your setup" />
      </div>
    );
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-surface-base px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8">
          <p className="label">Setup wizard</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            Let's build your plan around the time you actually have
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Everything here can be changed later in Settings. Nothing is locked in.
          </p>
        </header>

        <ol className="mb-6 flex flex-wrap gap-1.5">
          {STEPS.map((s, index) => (
            <li key={s.key}>
              <button
                onClick={() => setStep(index)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition',
                  index === step
                    ? 'border-brand-500/60 bg-brand-600/15 text-ink'
                    : index < step
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-line text-ink-faint hover:text-ink-muted',
                )}
              >
                {index < step ? <Check size={12} /> : s.icon}
                {s.title}
              </button>
            </li>
          ))}
        </ol>

        <Card className="card-pad">
          {current.key === 'hours' && (
            <Step
              title="How many hours can you study?"
              hint="The default reflects a working professional with a family: 1.5 hours on weeknights and 3 hours at the weekend."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Monday – Friday" hint="hours per day">
                  <Input
                    type="number"
                    min={0}
                    max={12}
                    step={0.5}
                    value={weekdayHours}
                    onChange={(e) => setWeekdayHours(Number(e.target.value))}
                  />
                </Field>
                <Field label="Saturday" hint="hours">
                  <Input
                    type="number"
                    min={0}
                    max={16}
                    step={0.5}
                    value={saturdayHours}
                    onChange={(e) => setSaturdayHours(Number(e.target.value))}
                  />
                </Field>
                <Field label="Sunday" hint="hours">
                  <Input
                    type="number"
                    min={0}
                    max={16}
                    step={0.5}
                    value={sundayHours}
                    onChange={(e) => setSundayHours(Number(e.target.value))}
                  />
                </Field>
              </div>

              <div className="mt-5 rounded-xl border border-brand-500/30 bg-brand-600/10 px-4 py-3">
                <p className="text-sm text-ink">
                  <span className="text-lg font-semibold">{weeklyHours.toFixed(1)}</span> hours per week
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {estimate.data
                    ? `${estimate.data.weeksRemaining} weeks (~${estimate.data.monthsRemaining} months) for the ${estimate.data.trackMode} track`
                    : 'Calculating…'}
                </p>
              </div>
            </Step>
          )}

          {current.key === 'days' && (
            <Step
              title="Which days will you study?"
              hint="Deselect a day and the planner will not schedule anything on it. Your weekly total updates accordingly."
            >
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => {
                  const on = studyDays.includes(day);
                  return (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-xs font-medium transition',
                        on
                          ? 'border-brand-500/60 bg-brand-600/15 text-ink'
                          : 'border-line text-ink-faint hover:text-ink-muted',
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-sm text-ink-muted">
                {studyDays.length} day{studyDays.length === 1 ? '' : 's'} per week ·{' '}
                <span className="text-ink">{weeklyHours.toFixed(1)} hours</span>
              </p>
            </Step>
          )}

          {current.key === 'target' && (
            <Step
              title="Which role are you aiming at?"
              hint="Ranked by realistic USA compensation. The first is recommended for a .NET/Angular/Azure background."
            >
              <div className="space-y-2">
                {careers.data?.slice(0, 6).map((career) => {
                  const active = (careerId || primary?.id) === career.id;
                  return (
                    <button
                      key={career.id}
                      onClick={() => setCareerId(career.id)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition',
                        active
                          ? 'border-brand-500/60 bg-brand-600/10'
                          : 'border-line hover:border-line-strong hover:bg-surface-overlay',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                          active ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-ink-faint',
                        )}
                      >
                        {career.rank}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink">{career.title}</span>
                          {career.isPrimaryRecommended && (
                            <span className="rounded border border-brand-500/40 bg-brand-500/10 px-1.5 py-0.5 text-[10px] text-brand-300">
                              Recommended
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-faint">
                          {money(career.salaryMinUsd)}–{money(career.salaryMaxUsd)} ·{' '}
                          {career.estimatedHours} hrs · {career.demandOutlook} demand
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-ink-faint">
                All thirteen paths stay browsable — this only sets what the dashboard plans against.
              </p>
            </Step>
          )}

          {current.key === 'salary' && (
            <Step
              title="Target salary and current level"
              hint="Used to frame progress, never to make a claim on your behalf."
            >
              <div className="mb-4">
                <Field
                  label="Years of engineering experience"
                  hint="Frames the resume summary and the roadmap. Never used to inflate a claim."
                >
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={years}
                    onChange={(e) => setYears(Number(e.target.value))}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Desired salary (USD)">
                  <Input
                    type="number"
                    min={50_000}
                    max={600_000}
                    step={5_000}
                    value={desiredSalary}
                    onChange={(e) => setDesiredSalary(Number(e.target.value))}
                  />
                </Field>
                <Field
                  label={`Current skill level — ${skillLevel}`}
                  hint="Your own assessment across the target role's skills."
                >
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(Number(e.target.value))}
                    className="w-full accent-brand-500"
                  />
                </Field>
              </div>

              {selectedCareer && (
                <div className="mt-5 rounded-xl border border-line bg-surface-sunken px-4 py-3 text-sm">
                  <p className="text-ink-muted">
                    {selectedCareer.title} pays{' '}
                    <span className="text-ink">
                      {money(selectedCareer.salaryMinUsd)}–{money(selectedCareer.salaryMaxUsd)}
                    </span>
                    , reaching{' '}
                    <span className="text-ink">
                      {money(selectedCareer.seniorSalaryMinUsd)}–{money(selectedCareer.seniorSalaryMaxUsd)}
                    </span>{' '}
                    at senior level.
                  </p>
                  <p className="mt-1.5 text-[11px] text-ink-faint">{selectedCareer.salarySource}</p>
                </div>
              )}
            </Step>
          )}

          {current.key === 'track' && (
            <Step title="How much depth do you want?" hint="This changes which lessons get scheduled, and the total hours.">
              <div className="space-y-2">
                {TRACKS.map((track) => {
                  const active = trackMode === track.key;
                  return (
                    <button
                      key={track.key}
                      onClick={() => setTrackMode(track.key)}
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-left transition',
                        active
                          ? 'border-brand-500/60 bg-brand-600/10'
                          : 'border-line hover:border-line-strong hover:bg-surface-overlay',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-ink">{track.title}</span>
                        <span className="text-xs text-ink-faint">{track.hours}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">{track.description}</p>
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {current.key === 'date' && (
            <Step
              title="Do you have a date in mind?"
              hint="Optional. If you set one, the calendar will show whether your current pace reaches it."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Desired completion date">
                  <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                </Field>
                <div className="rounded-xl border border-line bg-surface-sunken px-4 py-3">
                  <p className="label">At your current pace</p>
                  {estimate.data ? (
                    <>
                      <p className="mt-1 text-sm text-ink">
                        {estimate.data.estimatedCompletionMonth}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {estimate.data.weeksRemaining} weeks · {estimate.data.hoursRemaining} hours
                        remaining
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-ink-faint">Calculating…</p>
                  )}
                </div>
              </div>

              {estimate.data && (
                <div className="mt-5">
                  <p className="label mb-2">If you changed pace</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {estimate.data.paceScenarios.map((scenario) => (
                      <div
                        key={scenario.label}
                        className={cn(
                          'rounded-lg border px-3 py-2',
                          Math.abs(scenario.weeklyHours - weeklyHours) < 0.6
                            ? 'border-brand-500/50 bg-brand-600/10'
                            : 'border-line',
                        )}
                      >
                        <p className="text-xs text-ink">{scenario.label}</p>
                        <p className="text-[11px] text-ink-faint">
                          {scenario.weeks} weeks · ~{scenario.months} months
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Step>
          )}

          {current.key === 'review' && (
            <Step title="Your plan" hint="Confirm and the platform will generate your study calendar.">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Row label="Target role" value={selectedCareer?.title ?? '—'} />
                <Row label="Track" value={TRACKS.find((t) => t.key === trackMode)?.title ?? trackMode} />
                <Row label="Weekly hours" value={`${weeklyHours.toFixed(1)} hrs`} />
                <Row label="Study days" value={`${studyDays.length} per week`} />
                <Row label="Total training" value={estimate.data ? `${estimate.data.totalCourseHours} hrs` : '—'} />
                <Row
                  label="Estimated completion"
                  value={estimate.data?.estimatedCompletionMonth ?? '—'}
                />
                <Row label="Target salary" value={money(desiredSalary)} />
                <Row label="Experience" value={`${years} years`} />
                <Row label="Daily requirement" value={estimate.data ? `${estimate.data.dailyHoursRequired} hrs` : '—'} />
              </dl>

              {save.isError && (
                <div className="mt-4">
                  <ErrorPanel message={(save.error as Error).message} />
                </div>
              )}

              <Disclaimer className="mt-5">
                {estimate.data?.disclaimer ??
                  'These are learning-time estimates based on your stated study hours. They are not guarantees of employment, salary or hiring outcomes.'}
              </Disclaimer>
            </Step>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              icon={<ArrowLeft size={15} />}
            >
              Back
            </Button>

            {isLast ? (
              <Button
                variant="primary"
                loading={save.isPending}
                onClick={() => save.mutate()}
                icon={<Rocket size={15} />}
              >
                Start my programme
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
                Continue
                <ArrowRight size={15} />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Step({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
      <p className="mt-1 text-xs text-ink-faint">{hint}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}
