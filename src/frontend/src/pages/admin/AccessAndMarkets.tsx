import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Globe2, Save, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Disclaimer,
  Field,
  Input,
  LoadingPanel,
  Select,
  Textarea,
} from '@/components/ui';
import type { AccessPolicy, AdminSalaryBand, Country } from '@/types/api';

/**
 * Two operator controls that belong together: how much of the platform is free,
 * and what each market is told it pays.
 */

// ---------- free access ----------

export function AccessPolicyPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AccessPolicy | null>(null);

  const policy = useQuery({
    queryKey: ['admin-access-policy'],
    queryFn: () => api.get<AccessPolicy>('/admin/access-policy'),
  });

  useEffect(() => {
    if (policy.data) setForm(policy.data);
  }, [policy.data]);

  const save = useMutation({
    mutationFn: (payload: AccessPolicy) => api.put<AccessPolicy>('/admin/access-policy', payload),
    onSuccess: (saved) => {
      setForm(saved);
      // The public copy drives every visitor's gate, so drop it too.
      queryClient.invalidateQueries({ queryKey: ['access-policy'] });
      queryClient.invalidateQueries({ queryKey: ['admin-access-policy'] });
    },
  });

  if (policy.isLoading || !form) return <LoadingPanel label="Loading access policy" />;

  const set = <K extends keyof AccessPolicy>(key: K, value: AccessPolicy[K]) =>
    setForm({ ...form, [key]: value });

  const nudgeAtMinutes = Math.round((form.freeMinutesBeforeSignup * form.signupNudgeAtPercent) / 100);

  return (
    <Card className="mb-5">
      <CardHeader
        title="Free access"
        subtitle="When a visitor is asked to create an account, and when a learner is asked to pay"
        icon={<ShieldCheck size={15} />}
        action={save.isSuccess && <Badge tone="success">Saved</Badge>}
      />

      <div className="card-pad space-y-5">
        <section className="space-y-3">
          <h3 className="text-[13px] font-medium text-ink">Before an account</h3>

          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={form.allowAnonymousBrowsing}
              onChange={(e) => set('allowAnonymousBrowsing', e.target.checked)}
              className="size-4 rounded border-line"
            />
            Let visitors browse courses and lessons without signing in
          </label>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Free minutes" hint={`${formatMinutes(form.freeMinutesBeforeSignup)} of reading`}>
              <Input
                type="number"
                min={1}
                max={1440}
                value={form.freeMinutesBeforeSignup}
                onChange={(e) => set('freeMinutesBeforeSignup', Number(e.target.value))}
                disabled={!form.allowAnonymousBrowsing}
              />
            </Field>
            <Field
              label="Nudge at %"
              hint={
                form.signupNudgeAtPercent >= 100
                  ? 'No nudge — the wall is the first prompt'
                  : `Reminder at ${formatMinutes(nudgeAtMinutes)}`
              }
            >
              <Input
                type="number"
                min={0}
                max={100}
                value={form.signupNudgeAtPercent}
                onChange={(e) => set('signupNudgeAtPercent', Number(e.target.value))}
                disabled={!form.allowAnonymousBrowsing}
              />
            </Field>
          </div>

          <Field label="Wall heading">
            <Input
              value={form.signupPromptTitle}
              onChange={(e) => set('signupPromptTitle', e.target.value)}
            />
          </Field>
          <Field label="Wall message">
            <Textarea
              rows={2}
              value={form.signupPromptBody}
              onChange={(e) => set('signupPromptBody', e.target.value)}
            />
          </Field>
        </section>

        <section className="space-y-3 border-t border-line pt-5">
          <h3 className="text-[13px] font-medium text-ink">Before paying</h3>
          <p className="text-xs text-ink-faint">
            Applies to signed-in learners with no enrolment. Either trigger fires the prompt; set one
            to zero to turn it off.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Free minutes"
              hint={
                form.freeMinutesBeforePayment === 0
                  ? 'Off — time never triggers it'
                  : formatMinutes(form.freeMinutesBeforePayment)
              }
            >
              <Input
                type="number"
                min={0}
                max={1440}
                value={form.freeMinutesBeforePayment}
                onChange={(e) => set('freeMinutesBeforePayment', Number(e.target.value))}
              />
            </Field>
            <Field
              label="Free courses"
              hint={form.freeCoursesBeforePayment === 0 ? 'Off — count never triggers it' : 'Courses opened'}
            >
              <Input
                type="number"
                min={0}
                max={500}
                value={form.freeCoursesBeforePayment}
                onChange={(e) => set('freeCoursesBeforePayment', Number(e.target.value))}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={form.paymentPromptBlocks}
              onChange={(e) => set('paymentPromptBlocks', e.target.checked)}
              className="size-4 rounded border-line"
            />
            Block reading until they enrol
          </label>

          {form.paymentPromptBlocks && (
            <Disclaimer>
              Learners cannot read past this point until they enrol. Check a payment method is
              configured for every market you sell in, or they will meet a wall with no way through.
            </Disclaimer>
          )}

          <Field label="Prompt heading">
            <Input
              value={form.paymentPromptTitle}
              onChange={(e) => set('paymentPromptTitle', e.target.value)}
            />
          </Field>
          <Field label="Prompt message">
            <Textarea
              rows={2}
              value={form.paymentPromptBody}
              onChange={(e) => set('paymentPromptBody', e.target.value)}
            />
          </Field>
        </section>

        {save.isError && (
          <p className="text-xs text-rose-400">{(save.error as Error).message}</p>
        )}

        <Button
          variant="primary"
          icon={<Save size={15} />}
          loading={save.isPending}
          onClick={() => save.mutate(form)}
        >
          Save access policy
        </Button>

        <p className="text-xs text-ink-faint">
          Time is measured in the reader's browser and only while the tab is visible. Clearing site
          data resets it, so treat these as prompts at a sensible moment rather than as protection
          for paid content — that is enforced by enrolment on the server.
        </p>
      </div>
    </Card>
  );
}

// ---------- per-market salary bands ----------

export function MarketSalaryPanel() {
  const queryClient = useQueryClient();
  const [countryCode, setCountryCode] = useState('IN');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<AdminSalaryBand>>({});

  const countries = useQuery({
    queryKey: ['countries'],
    queryFn: () => api.get<Country[]>('/countries'),
    staleTime: 60 * 60 * 1000,
  });

  const bands = useQuery({
    queryKey: ['admin-salary-bands', countryCode],
    queryFn: () => api.get<AdminSalaryBand[]>(`/admin/salary-bands/${countryCode}`),
  });

  const save = useMutation({
    mutationFn: (band: AdminSalaryBand) =>
      api.put<AdminSalaryBand>(`/admin/salary-bands/${countryCode}/${band.careerPathId}`, {
        salaryMin: draft.salaryMin ?? band.salaryMin,
        salaryMax: draft.salaryMax ?? band.salaryMax,
        seniorSalaryMin: draft.seniorSalaryMin ?? band.seniorSalaryMin,
        seniorSalaryMax: draft.seniorSalaryMax ?? band.seniorSalaryMax,
        source: draft.source ?? band.source,
        asOf: draft.asOf ?? band.asOf,
      }),
    onSuccess: () => {
      setEditing(null);
      setDraft({});
      queryClient.invalidateQueries({ queryKey: ['admin-salary-bands', countryCode] });
      queryClient.invalidateQueries({ queryKey: ['careers'] });
    },
  });

  const remove = useMutation({
    mutationFn: (careerPathId: string) =>
      api.del(`/admin/salary-bands/${countryCode}/${careerPathId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-salary-bands', countryCode] }),
  });

  const country = countries.data?.find((c) => c.code === countryCode);
  const published = (bands.data ?? []).filter((b) => b.hasData).length;

  return (
    <Card className="mb-5">
      <CardHeader
        title="Salary by market"
        subtitle="Figures are per market and never converted — a country with no band shows as unpublished"
        icon={<Globe2 size={15} />}
        action={
          <Select
            value={countryCode}
            onChange={(e) => {
              setCountryCode(e.target.value);
              setEditing(null);
            }}
            className="w-44"
          >
            {(countries.data ?? []).map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        }
      />

      <div className="card-pad space-y-3">
        <p className="text-xs text-ink-faint">
          {published} of {bands.data?.length ?? 0} careers published for {country?.name ?? countryCode}
          {country && ` · amounts in ${country.currencyCode} (${country.currencySymbol})`}
        </p>

        {bands.isLoading && <LoadingPanel label="Loading bands" />}

        <div className="space-y-2">
          {(bands.data ?? []).map((band) => {
            const isEditing = editing === band.careerPathId;
            return (
              <div key={band.careerPathId} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{band.careerTitle}</p>
                    <p className="text-xs text-ink-faint">
                      {band.hasData
                        ? `${band.salaryMin.toLocaleString()}–${band.salaryMax.toLocaleString()} · senior ${band.seniorSalaryMin.toLocaleString()}–${band.seniorSalaryMax.toLocaleString()}`
                        : 'No figures published'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {band.hasData ? (
                      <Badge tone="success">Published</Badge>
                    ) : (
                      <Badge tone="warning">Empty</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(isEditing ? null : band.careerPathId);
                        setDraft(isEditing ? {} : band);
                      }}
                    >
                      {isEditing ? 'Cancel' : 'Edit'}
                    </Button>
                    {band.hasData && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove.mutate(band.careerPathId)}
                      >
                        Withdraw
                      </Button>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-3 space-y-3 border-t border-line pt-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label="Min">
                        <Input
                          type="number"
                          value={draft.salaryMin ?? band.salaryMin}
                          onChange={(e) => setDraft({ ...draft, salaryMin: Number(e.target.value) })}
                        />
                      </Field>
                      <Field label="Max">
                        <Input
                          type="number"
                          value={draft.salaryMax ?? band.salaryMax}
                          onChange={(e) => setDraft({ ...draft, salaryMax: Number(e.target.value) })}
                        />
                      </Field>
                      <Field label="Senior min">
                        <Input
                          type="number"
                          value={draft.seniorSalaryMin ?? band.seniorSalaryMin}
                          onChange={(e) =>
                            setDraft({ ...draft, seniorSalaryMin: Number(e.target.value) })
                          }
                        />
                      </Field>
                      <Field label="Senior max">
                        <Input
                          type="number"
                          value={draft.seniorSalaryMax ?? band.seniorSalaryMax}
                          onChange={(e) =>
                            setDraft({ ...draft, seniorSalaryMax: Number(e.target.value) })
                          }
                        />
                      </Field>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                      <Field label="Source" hint="Required — it is what makes the figures publishable">
                        <Input
                          value={draft.source ?? band.source}
                          onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                          placeholder="e.g. AmbitionBox / Glassdoor India, Sep 2026"
                        />
                      </Field>
                      <Field label="As of">
                        <Input
                          type="date"
                          value={(draft.asOf ?? band.asOf ?? '').slice(0, 10)}
                          onChange={(e) => setDraft({ ...draft, asOf: e.target.value })}
                        />
                      </Field>
                    </div>

                    {save.isError && (
                      <p className="text-xs text-rose-400">{(save.error as Error).message}</p>
                    )}

                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Coins size={14} />}
                      loading={save.isPending}
                      onClick={() => save.mutate(band)}
                    >
                      Publish
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function formatMinutes(total: number) {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
