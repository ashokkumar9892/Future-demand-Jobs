import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleDot, GraduationCap } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Card, Disclaimer, ErrorPanel, LoadingPanel, Progress, Stat } from '@/components/ui';
import type { ProjectListItem } from '@/types/api';

export default function Projects() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<ProjectListItem[]>('/projects'),
  });

  const completed = (data ?? []).filter((p) => p.status === 'Completed').length;
  const inProgress = (data ?? []).filter((p) => p.status === 'InProgress').length;
  const totalHours = (data ?? []).reduce((sum, p) => sum + p.estimatedHours, 0);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Ten portfolio projects in a deliberate order — each introduces one new concept and reuses everything before it. Three finished properly beat eight half-built."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <Card className="card-pad">
          <Stat label="Projects" value={data?.length ?? 0} detail={`${totalHours} hours total`} />
        </Card>
        <Card className="card-pad">
          <Stat label="Completed" value={completed} />
        </Card>
        <Card className="card-pad">
          <Stat label="In progress" value={inProgress} />
        </Card>
        <Card className="card-pad">
          <Stat
            label="Portfolio coverage"
            value={`${data?.length ? Math.round((completed / data.length) * 100) : 0}%`}
          />
          <Progress
            value={data?.length ? (completed / data.length) * 100 : 0}
            className="mt-3"
            barClassName="bg-emerald-500"
          />
        </Card>
      </div>

      {isLoading && <LoadingPanel label="Loading projects" />}
      {error && <ErrorPanel message={(error as Error).message} />}

      <div className="space-y-3">
        {(data ?? []).map((project) => (
          <Link
            key={project.id}
            to={`/projects/${project.slug}`}
            className="group flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-card transition hover:border-line-strong hover:shadow-lift sm:flex-row sm:items-center"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600/25 to-accent-500/15 text-sm font-semibold text-brand-300">
              {project.order}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight text-ink transition group-hover:text-brand-300">
                  {project.title}
                </h3>
                {project.status === 'Completed' && (
                  <Badge tone="success">
                    <CheckCircle2 size={10} />
                    Completed
                  </Badge>
                )}
                {project.status === 'InProgress' && (
                  <Badge tone="warning">
                    <CircleDot size={10} />
                    In progress
                  </Badge>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">{project.summary}</p>
              <p className="mt-1.5 line-clamp-1 font-mono text-[11px] text-ink-faint">{project.techStack}</p>
            </div>

            <div className="w-full shrink-0 sm:w-48">
              <div className="mb-1.5 flex items-baseline justify-between text-[11px]">
                <span className="text-ink-faint">
                  {project.difficulty} · {project.estimatedHours} hrs
                </span>
                <span className="tabular-nums text-ink">{project.percentComplete}%</span>
              </div>
              <Progress
                value={project.percentComplete}
                barClassName={project.percentComplete === 100 ? 'bg-emerald-500' : 'bg-brand-500'}
              />
            </div>
          </Link>
        ))}
      </div>

      <Disclaimer className="mt-6">
        <span className="inline-flex items-center gap-1.5">
          <GraduationCap size={12} />
          These are personal portfolio projects. When they reach your CV, label them as such — the
          Resume Builder does this automatically, and the distinction survives the first follow-up
          question in an interview.
        </span>
      </Disclaimer>
    </>
  );
}
