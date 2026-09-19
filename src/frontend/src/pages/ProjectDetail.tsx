import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bookmark, CheckCircle2, Circle, ExternalLink, Save, Target } from 'lucide-react';
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
  Progress,
  Stat,
  Textarea,
} from '@/components/ui';
import { Markdown, MermaidDiagram } from '@/components/content';
import { cn } from '@/lib/format';
import type { ProjectDetail as ProjectDetailDto } from '@/types/api';

export default function ProjectDetail() {
  const { slug = '' } = useParams();
  const queryClient = useQueryClient();

  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['project', slug],
    queryFn: () => api.get<ProjectDetailDto>(`/projects/${slug}`),
  });

  useEffect(() => {
    if (!data) return;
    setRepoUrl(data.repoUrl ?? '');
    setDemoUrl(data.demoUrl ?? '');
    setNotes(data.notes ?? '');
  }, [data]);

  const apply = (updated: ProjectDetailDto) => {
    queryClient.setQueryData(['project', slug], updated);
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const saveProgress = useMutation({
    mutationFn: (status?: string) =>
      api.post<ProjectDetailDto>(`/projects/${data!.project.id}/progress`, {
        status: status ?? data!.project.status,
        repoUrl,
        demoUrl,
        notes,
      }),
    onSuccess: apply,
  });

  const toggleMilestone = useMutation({
    mutationFn: (milestoneId: string) =>
      api.post<ProjectDetailDto>(
        `/projects/${data!.project.id}/milestones/${milestoneId}/toggle`,
      ),
    onSuccess: apply,
  });

  const toggleBookmark = useMutation({
    mutationFn: () =>
      api.post('/bookmarks/toggle', {
        itemType: 'Project',
        refId: data!.project.id,
        title: data!.project.title,
        subtitle: data!.project.techStack,
        deepLink: `/projects/${slug}`,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', slug] }),
  });

  if (isLoading) return <LoadingPanel label="Loading project" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  if (!data) return null;

  const { project, milestones } = data;
  const done = milestones.filter((m) => m.completed).length;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Projects', to: '/projects' }, { label: `Project ${project.order}` }]}
        title={project.title}
        description={project.summary}
        actions={
          <>
            <Link
              to="/projects"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs text-ink-muted transition hover:bg-surface-overlay hover:text-ink"
            >
              <ArrowLeft size={14} />
              All projects
            </Link>
            <Button
              size="sm"
              variant={data.isBookmarked ? 'primary' : 'secondary'}
              onClick={() => toggleBookmark.mutate()}
              icon={<Bookmark size={14} />}
            >
              {data.isBookmarked ? 'Saved' : 'Bookmark'}
            </Button>
            {project.status !== 'Completed' && (
              <Button
                size="sm"
                variant="primary"
                loading={saveProgress.isPending}
                onClick={() => saveProgress.mutate('Completed')}
                icon={<CheckCircle2 size={14} />}
              >
                Mark complete
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <Card className="card-pad">
          <Stat label="Progress" value={`${project.percentComplete}%`} detail={`${done} of ${milestones.length} milestones`} />
          <Progress
            value={project.percentComplete}
            className="mt-3"
            barClassName={project.percentComplete === 100 ? 'bg-emerald-500' : 'bg-brand-500'}
          />
        </Card>
        <Card className="card-pad">
          <Stat label="Estimated effort" value={`${project.estimatedHours} hrs`} detail={project.difficulty} />
        </Card>
        <Card className="card-pad">
          <Stat label="Status" value={project.status} />
        </Card>
        <Card className="card-pad">
          <Stat label="Skills exercised" value={data.skills.length} detail={data.skills.slice(0, 3).join(', ')} />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader title="Brief" />
            <div className="card-pad">
              <Markdown>{data.briefMarkdown}</Markdown>
            </div>
          </Card>

          {data.architectureMermaid && (
            <Card>
              <CardHeader title="Reference architecture" />
              <div className="card-pad">
                <MermaidDiagram chart={data.architectureMermaid} />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Milestones"
              subtitle={`${done} of ${milestones.length} complete`}
            />
            <div className="divide-y divide-line">
              {milestones.map((milestone) => (
                <button
                  key={milestone.id}
                  onClick={() => toggleMilestone.mutate(milestone.id)}
                  disabled={toggleMilestone.isPending}
                  className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-surface-overlay disabled:opacity-60"
                >
                  <span className="mt-0.5 shrink-0">
                    {milestone.completed ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : (
                      <Circle size={16} className="text-ink-faint" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm',
                        milestone.completed ? 'text-ink-faint line-through' : 'text-ink',
                      )}
                    >
                      {milestone.title}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
                      {milestone.description}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-faint">
                    {milestone.estimatedHours} hrs
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Acceptance criteria" subtitle="What 'done' means for this project" />
            <ul className="space-y-2 card-pad">
              {data.acceptanceCriteria.map((criterion) => (
                <li key={criterion} className="flex gap-2 text-[13px] leading-relaxed text-ink-muted">
                  <Target size={13} className="mt-0.5 shrink-0 text-brand-400" />
                  {criterion}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Your work" />
            <div className="space-y-3 card-pad">
              <Field label="Repository URL">
                <Input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/…"
                />
              </Field>
              <Field label="Deployed demo URL">
                <Input
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Notes" hint="Decisions, blockers, measured results.">
                <Textarea
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-[12px]"
                />
              </Field>
              <Button
                variant="primary"
                className="w-full"
                loading={saveProgress.isPending}
                onClick={() => saveProgress.mutate(undefined)}
                icon={<Save size={14} />}
              >
                Save
              </Button>

              {(data.repoUrl || data.demoUrl) && (
                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  {data.repoUrl && (
                    <a
                      href={data.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] text-brand-400 hover:underline"
                    >
                      <ExternalLink size={11} />
                      Repository
                    </a>
                  )}
                  {data.demoUrl && (
                    <a
                      href={data.demoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] text-brand-400 hover:underline"
                    >
                      <ExternalLink size={11} />
                      Live demo
                    </a>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Skills exercised" />
            <div className="card-pad">
              <div className="flex flex-wrap gap-1.5">
                {data.skills.map((skill) => (
                  <Badge key={skill} tone="neutral">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Resume bullets" subtitle="Available once the project is complete" />
            <div className="card-pad">
              <ul className="space-y-2">
                {data.resumeBullets.map((bullet) => (
                  <li key={bullet} className="text-[12px] leading-relaxed text-ink-muted">
                    {bullet}
                  </li>
                ))}
              </ul>
              <Disclaimer className="mt-3">
                These describe a personal portfolio project. The Resume Builder tags them as such —
                never as professional experience.
              </Disclaimer>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
