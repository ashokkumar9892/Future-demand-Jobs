import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Copy, FileText, RefreshCw, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Button, Card, CardHeader, Disclaimer, ErrorPanel, LoadingPanel, Stat } from '@/components/ui';
import { cn } from '@/lib/format';
import type { EvidenceKind, Resume } from '@/types/api';

const EVIDENCE_TONE: Record<EvidenceKind, 'success' | 'info' | 'warning' | 'brand'> = {
  ProfessionalExperience: 'success',
  PersonalProject: 'info',
  Training: 'warning',
  Certification: 'brand',
};

const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  ProfessionalExperience: 'Professional experience',
  PersonalProject: 'Personal project',
  Training: 'Training',
  Certification: 'Certification',
};

export default function ResumeBuilder() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['resume'],
    queryFn: () => api.get<Resume>('/resume'),
  });

  const regenerate = useMutation({
    mutationFn: () => api.post<Resume>('/resume/generate'),
    onSuccess: (payload) => queryClient.setQueryData(['resume'], payload),
  });

  const sections = useMemo(() => {
    if (!data) return [];
    const grouped = new Map<string, typeof data.items>();
    for (const item of data.items) {
      const list = grouped.get(item.section) ?? [];
      list.push(item);
      grouped.set(item.section, list);
    }
    return Array.from(grouped.entries());
  }, [data]);

  const copyAll = async () => {
    if (!data) return;
    const text = [
      data.headline,
      '',
      data.summary,
      '',
      ...sections.flatMap(([section, items]) => [
        section.toUpperCase(),
        ...items.map((item) => `- ${item.text}  [${EVIDENCE_LABEL[item.evidenceKind]}]`),
        '',
      ]),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard permission can be denied; the text is on screen regardless.
    }
  };

  if (isLoading) return <LoadingPanel label="Building your resume" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  if (!data) return null;

  return (
    <>
      <PageHeader
        title="Resume builder"
        description="Generated from what you have actually completed. Every line carries its evidence type, and nothing is ever presented as professional experience unless you entered it as such."
        actions={
          <>
            <Button variant="secondary" onClick={copyAll} icon={<Copy size={14} />}>
              Copy
            </Button>
            <Button
              variant="primary"
              loading={regenerate.isPending}
              onClick={() => regenerate.mutate()}
              icon={<RefreshCw size={14} />}
            >
              Regenerate
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="card-pad">
          <Stat label="Readiness" value={`${data.readinessPercent}%`} detail="drives the headline" />
        </Card>
        <Card className="card-pad">
          <Stat label="Evidence lines" value={data.items.length} detail={`${sections.length} sections`} />
        </Card>
        <Card className="card-pad">
          <Stat label="Generated" value={data.generatedAt} />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader title="Headline" icon={<FileText size={15} />} />
            <div className="card-pad">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1 rounded-xl border border-line bg-surface-sunken px-4 py-3">
                  <p className="label">Current</p>
                  <p className="mt-1 text-sm text-ink-muted">{data.beforeHeadline}</p>
                </div>
                <ArrowRight size={16} className="mx-auto shrink-0 text-ink-faint sm:mx-0" />
                <div className="flex-1 rounded-xl border border-brand-500/40 bg-brand-600/10 px-4 py-3">
                  <p className="label text-brand-300">Suggested</p>
                  <p className="mt-1 text-sm text-ink">{data.headline}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="label mb-1.5">Summary</p>
                <p className="text-[13px] leading-relaxed text-ink-muted">{data.summary}</p>
              </div>
            </div>
          </Card>

          {sections.map(([section, items]) => (
            <Card key={section}>
              <CardHeader title={section} subtitle={`${items.length} line${items.length === 1 ? '' : 's'}`} />
              <div className="divide-y divide-line">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                    <Badge tone={EVIDENCE_TONE[item.evidenceKind]} className="mt-0.5 shrink-0">
                      {EVIDENCE_LABEL[item.evidenceKind]}
                    </Badge>
                    <p className="text-[13px] leading-relaxed text-ink-muted">{item.text}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {data.items.length === 0 && (
            <Card className="card-pad">
              <p className="text-sm text-ink-muted">
                Nothing to generate yet. Complete a course phase, finish a project or pass a
                certification and those become evidence lines here.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card className={cn('border-amber-500/30')}>
            <CardHeader title="Evidence policy" icon={<ShieldAlert size={15} />} />
            <div className="card-pad">
              <p className="text-[12px] leading-relaxed text-ink-muted">{data.evidencePolicy}</p>
              <div className="mt-4 space-y-2">
                {(Object.keys(EVIDENCE_LABEL) as EvidenceKind[]).map((kind) => (
                  <div key={kind} className="flex items-start gap-2">
                    <Badge tone={EVIDENCE_TONE[kind]} className="shrink-0">
                      {EVIDENCE_LABEL[kind]}
                    </Badge>
                    <p className="text-[11px] leading-relaxed text-ink-faint">
                      {kind === 'ProfessionalExperience'
                        ? 'Paid work with real users and consequences. Only you can add these.'
                        : kind === 'PersonalProject'
                          ? 'Built to learn. Say so — a follow-up question about on-call exposes anything else.'
                          : kind === 'Training'
                            ? 'Courses completed on this platform.'
                            : 'Exams passed.'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Suggested keywords" subtitle="Mirror the vocabulary in the job description" />
            <div className="card-pad">
              <div className="flex flex-wrap gap-1.5">
                {data.suggestedKeywords.map((keyword) => (
                  <Badge key={keyword} tone="neutral">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>

          <Disclaimer>
            The headline only changes once there is measured evidence behind it. Below that bar the
            platform keeps your current, accurate title — overclaiming fails on the first follow-up
            question, and it is easy to check.
          </Disclaimer>
        </div>
      </div>
    </>
  );
}
