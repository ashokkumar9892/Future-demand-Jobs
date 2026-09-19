import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, ExternalLink, Sparkles } from 'lucide-react';
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
  Input,
  LoadingPanel,
  Select,
  Stat,
} from '@/components/ui';
import { cn } from '@/lib/format';
import type { CertificationDto } from '@/types/api';

const STATUSES = ['NotStarted', 'Planned', 'Studying', 'Scheduled', 'Passed', 'Failed'];

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  NotStarted: 'neutral',
  Planned: 'info',
  Studying: 'warning',
  Scheduled: 'info',
  Passed: 'success',
  Failed: 'danger',
};

export default function Certifications() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['certifications'],
    queryFn: () => api.get<CertificationDto[]>('/certifications'),
  });

  const passed = (data ?? []).filter((c) => c.status === 'Passed');
  const active = (data ?? []).filter((c) => ['Studying', 'Scheduled', 'Planned'].includes(c.status));
  const prepHours = (data ?? [])
    .filter((c) => c.recommendedForTarget)
    .reduce((sum, c) => sum + c.estimatedPrepHours, 0);

  return (
    <>
      <PageHeader
        title="Certifications"
        description="Track preparation, exam dates and results. Certifications are evidence of training — the Resume Builder records them as exactly that."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <Card className="card-pad">
          <Stat label="Tracked" value={data?.length ?? 0} />
        </Card>
        <Card className="card-pad">
          <Stat label="Passed" value={passed.length} detail={passed.map((c) => c.code).join(', ') || '—'} />
        </Card>
        <Card className="card-pad">
          <Stat label="In progress" value={active.length} />
        </Card>
        <Card className="card-pad">
          <Stat label="Recommended prep" value={`${prepHours} hrs`} detail="for your target role" />
        </Card>
      </div>

      {isLoading && <LoadingPanel label="Loading certifications" />}
      {error && <ErrorPanel message={(error as Error).message} />}

      <div className="grid gap-4 lg:grid-cols-2">
        {(data ?? []).map((cert) => (
          <Card key={cert.id} className={cn(cert.recommendedForTarget && 'border-brand-500/30')}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  {cert.code}
                  {cert.recommendedForTarget && (
                    <Badge tone="brand">
                      <Sparkles size={10} />
                      Recommended
                    </Badge>
                  )}
                </span>
              }
              subtitle={`${cert.name} · ${cert.vendor} · ${cert.level}`}
              icon={<Award size={15} />}
              action={<Badge tone={STATUS_TONE[cert.status] ?? 'neutral'}>{cert.status}</Badge>}
            />

            <div className="card-pad">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="label">Prep</p>
                  <p className="mt-0.5 text-sm tabular-nums text-ink">{cert.estimatedPrepHours} hrs</p>
                </div>
                <div>
                  <p className="label">Logged</p>
                  <p className="mt-0.5 text-sm tabular-nums text-ink">{cert.prepHoursLogged} hrs</p>
                </div>
                <div>
                  <p className="label">Exam cost</p>
                  <p className="mt-0.5 text-sm tabular-nums text-ink">${cert.examCostUsd}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {cert.topics.slice(0, 5).map((topic) => (
                  <Badge key={topic} tone="neutral">
                    {topic}
                  </Badge>
                ))}
              </div>

              {(cert.targetDate || cert.completedDate) && (
                <p className="mt-3 text-[11px] text-ink-faint">
                  {cert.completedDate
                    ? `Passed ${cert.completedDate}${cert.scorePercent ? ` · ${cert.scorePercent}%` : ''}`
                    : `Target ${cert.targetDate}`}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                <a
                  href={cert.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] text-brand-400 hover:underline"
                >
                  <ExternalLink size={11} />
                  Official page
                </a>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditing(editing === cert.id ? null : cert.id)}
                >
                  {editing === cert.id ? 'Close' : 'Update'}
                </Button>
              </div>

              {editing === cert.id && (
                <EditForm
                  cert={cert}
                  onSaved={() => {
                    setEditing(null);
                    queryClient.invalidateQueries({ queryKey: ['certifications'] });
                    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                  }}
                />
              )}
            </div>
          </Card>
        ))}
      </div>

      <Disclaimer className="mt-6">
        A passed certification is recorded as a certification, never as professional experience.
        Exam costs and preparation hours are indicative and change; check the official page.
      </Disclaimer>
    </>
  );
}

function EditForm({ cert, onSaved }: { cert: CertificationDto; onSaved: () => void }) {
  const [status, setStatus] = useState(cert.status);
  const [targetDate, setTargetDate] = useState(cert.targetDate ?? '');
  const [completedDate, setCompletedDate] = useState(cert.completedDate ?? '');
  const [score, setScore] = useState(cert.scorePercent?.toString() ?? '');
  const [prepHours, setPrepHours] = useState(cert.prepHoursLogged.toString());

  const save = useMutation({
    mutationFn: () =>
      api.put(`/certifications/mine/${cert.id}`, {
        status,
        targetDate: targetDate || null,
        completedDate: completedDate || null,
        scorePercent: score ? Number(score) : null,
        prepHoursLogged: Number(prepHours) || 0,
      }),
    onSuccess: onSaved,
  });

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-line bg-surface-sunken p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prep hours logged">
          <Input type="number" min={0} value={prepHours} onChange={(e) => setPrepHours(e.target.value)} />
        </Field>
        <Field label="Target date">
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </Field>
        <Field label="Completed date">
          <Input type="date" value={completedDate} onChange={(e) => setCompletedDate(e.target.value)} />
        </Field>
        <Field label="Score %">
          <Input
            type="number"
            min={0}
            max={1000}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="e.g. 880 scaled or 88"
          />
        </Field>
      </div>

      <Button variant="primary" size="sm" loading={save.isPending} onClick={() => save.mutate()}>
        Save
      </Button>
      {save.isError && <ErrorPanel message={(save.error as Error).message} />}
    </div>
  );
}
