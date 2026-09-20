import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  MessagesSquare,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Badge,
  Card,
  CardHeader,
  Disclaimer,
  ErrorPanel,
  LoadingPanel,
  Pill,
  Progress,
  Stat,
} from '@/components/ui';
import { CompProgression } from '@/components/charts';
import { cn, DEMAND_TONE, money, RISK_TONE } from '@/lib/format';
import type { CareerDetail as CareerDetailDto, SkillGapEntry } from '@/types/api';

export default function CareerDetail() {
  const { slug = '' } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ['career', slug],
    queryFn: () => api.get<CareerDetailDto>(`/careers/${slug}`),
  });

  if (isLoading) return <LoadingPanel label="Loading career" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  if (!data) return null;

  const c = data.summary;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Career paths', to: '/careers' }, { label: c.title }]}
        title={c.title}
        description={c.summary}
        actions={
          <>
            <Pill className={DEMAND_TONE[c.demandOutlook] ?? DEMAND_TONE.Strong}>
              <TrendingUp size={10} />
              {c.demandOutlook} demand
            </Pill>
            <Pill className={RISK_TONE[c.aiReplacementRisk] ?? RISK_TONE.Low}>
              <ShieldCheck size={10} />
              {c.aiReplacementRisk} AI risk
            </Pill>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="card-pad">
          <Stat
            label={`Salary range · ${c.salary?.countryName ?? 'USA'}`}
            value={
              c.salary && !c.salary.hasData
                ? 'Not published'
                : (c.salary?.range ?? `${money(c.salaryMinUsd)}–${money(c.salaryMaxUsd)}`)
            }
            detail={
              c.salary && !c.salary.hasData
                ? c.salary.message
                : `Senior ${
                    c.salary?.seniorRange ??
                    `${money(c.seniorSalaryMinUsd)}–${money(c.seniorSalaryMaxUsd)}`
                  }`
            }
          />
        </Card>
        <Card className="card-pad">
          <Stat
            label="Training required"
            value={`${data.totalTrainingHours} hrs`}
            detail={`${data.estimate.trackMode} track`}
          />
        </Card>
        <Card className="card-pad">
          <Stat
            label="At your pace"
            value={`${data.estimate.weeks} weeks`}
            detail={`${data.estimate.weeklyHours} hrs/week · ~${data.estimate.months} months`}
          />
        </Card>
        <Card className="card-pad">
          <Stat
            label="Estimated completion"
            value={data.estimate.estimatedCompletionMonth}
            detail={`${data.estimate.dailyHoursRequired} hrs on each study day`}
          />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader title="Skill gap" subtitle="Your current levels against this role's targets" icon={<Target size={15} />} />
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <SkillColumn
                title={`Already at target (${data.skillsYouHave.length})`}
                tone="emerald"
                skills={data.skillsYouHave}
              />
              <SkillColumn
                title={`To develop (${data.skillsToLearn.length})`}
                tone="amber"
                skills={data.skillsToLearn}
              />
            </div>
            <div className="border-t border-line px-5 py-3">
              <Link to="/skills" className="text-xs text-brand-400 transition hover:underline">
                Edit your current levels in the skill matrix →
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Career ladder"
              subtitle="Stage by stage, with the compensation each rung typically commands"
            />
            <div className="p-5">
              <div className="space-y-3">
                {data.ladder.map((stage, index) => (
                  <div key={stage.stageOrder} className="relative pl-7">
                    {index < data.ladder.length - 1 && (
                      <span className="absolute left-[9px] top-6 h-[calc(100%-0.5rem)] w-px bg-line" />
                    )}
                    <span
                      className={cn(
                        'absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2',
                        stage.isCurrentPosition
                          ? 'border-ink-faint bg-surface-base'
                          : 'border-brand-500 bg-brand-600/30',
                      )}
                    />
                    <div className="rounded-xl border border-line bg-surface-sunken px-4 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <p className="text-xs text-ink-faint">{stage.title}</p>
                          <p className="text-sm font-medium text-ink">{stage.roleTitle}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm tabular-nums text-ink">
                            {money(stage.salaryMinUsd)}–{money(stage.salaryMaxUsd)}
                          </p>
                          {stage.durationMonths > 0 && (
                            <p className="text-[11px] text-ink-faint">~{stage.durationMonths} months</p>
                          )}
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-ink-muted">{stage.description}</p>
                      {stage.milestones.length > 0 && (
                        <ul className="mt-2.5 space-y-1">
                          {stage.milestones.map((milestone) => (
                            <li key={milestone} className="flex gap-2 text-[11px] text-ink-faint">
                              <CheckCircle2 size={11} className="mt-0.5 shrink-0" />
                              {milestone}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-line pt-5">
                <p className="label mb-3">Compensation progression</p>
                <CompProgression
                  stages={data.ladder.map((stage) => ({
                    title: stage.title,
                    min: stage.salaryMinUsd,
                    max: stage.salaryMaxUsd,
                    current: stage.isCurrentPosition,
                  }))}
                />
              </div>
            </div>
          </Card>

          {data.courses.length > 0 ? (
            <Card>
              <CardHeader
                title="Curriculum"
                subtitle={`${data.courses.length} phases`}
                icon={<BookOpen size={15} />}
                action={
                  <Link to="/courses" className="text-xs text-ink-faint transition hover:text-ink">
                    All courses
                  </Link>
                }
              />
              <div className="divide-y divide-line">
                {data.courses.map((course) => {
                  const percent =
                    course.lessonCount > 0
                      ? Math.round((course.completedLessons / course.lessonCount) * 100)
                      : 0;
                  return (
                    <Link
                      key={course.id}
                      to={`/courses/${course.slug}`}
                      className="block px-5 py-3 transition hover:bg-surface-overlay"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">{course.title}</p>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-faint">{course.summary}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs tabular-nums text-ink-muted">{course.estimatedHours} hrs</p>
                          <p className="text-[11px] text-ink-faint">
                            {course.completedLessons}/{course.lessonCount} lessons
                          </p>
                        </div>
                      </div>
                      <Progress value={percent} className="mt-2" />
                    </Link>
                  );
                })}
              </div>
            </Card>
          ) : (
            <Card className="card-pad">
              <p className="text-sm text-ink-muted">
                A full lesson-by-lesson curriculum is published for the AI Solutions Architect track.
                For this role the platform provides the skill gap, ladder, certifications, projects
                and interview focus below — the detailed course content is not yet written.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Market notes" />
            <div className="space-y-4 card-pad">
              <div>
                <p className="label">Demand</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{c.demandNotes}</p>
              </div>
              <div>
                <p className="label">AI replacement risk</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{c.aiRiskNotes}</p>
              </div>
              <div>
                <p className="label">$200K+ potential</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{c.twoHundredKPotential}</p>
              </div>
              <div className="border-t border-line pt-3">
                <p className="text-[11px] text-ink-faint">
                  Salary data as of {c.salaryAsOf}. {c.salarySource}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Resume keywords" subtitle="What recruiters and ATS filters look for" />
            <div className="card-pad">
              <div className="flex flex-wrap gap-1.5">
                {data.resumeKeywords.map((keyword) => (
                  <Pill key={keyword} className="border-line bg-surface-sunken text-ink-muted">
                    {keyword}
                  </Pill>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Example responsibilities" />
            <ul className="space-y-2 card-pad">
              {data.responsibilities.map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-relaxed text-ink-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Interview focus" icon={<MessagesSquare size={15} />} />
            <ul className="space-y-2 card-pad">
              {data.interviewFocus.map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-relaxed text-ink-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-400" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-5 py-3">
              <Link to="/interview-prep" className="text-xs text-brand-400 transition hover:underline">
                Practise these in Interview Prep →
              </Link>
            </div>
          </Card>

          {data.certifications.length > 0 && (
            <Card>
              <CardHeader title="Recommended certifications" icon={<Award size={15} />} />
              <div className="divide-y divide-line">
                {data.certifications.map((cert) => (
                  <div key={cert.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-ink">{cert.code}</p>
                        <p className="mt-0.5 text-[11px] text-ink-faint">{cert.name}</p>
                      </div>
                      <a
                        href={cert.officialUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-ink-faint transition hover:text-ink"
                        aria-label={`Official page for ${cert.code}`}
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                    <p className="mt-1.5 text-[11px] text-ink-faint">
                      {cert.estimatedPrepHours} hrs prep · ${cert.examCostUsd} · {cert.vendor}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {data.projects.length > 0 && (
            <Card>
              <CardHeader title="Practice projects" icon={<GraduationCap size={15} />} />
              <div className="divide-y divide-line">
                {data.projects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.slug}`}
                    className="block px-5 py-3 transition hover:bg-surface-overlay"
                  >
                    <p className="text-sm text-ink">{project.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-faint">{project.techStack}</p>
                    <Badge tone="neutral" className="mt-1.5">
                      {project.estimatedHours} hrs
                    </Badge>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <Disclaimer className="mt-6">{data.estimate.disclaimer}</Disclaimer>
    </>
  );
}

function SkillColumn({
  title,
  skills,
  tone,
}: {
  title: string;
  skills: SkillGapEntry[];
  tone: 'emerald' | 'amber';
}) {
  return (
    <div>
      <p className={cn('label mb-2', tone === 'emerald' ? 'text-emerald-300' : 'text-amber-300')}>
        {title}
      </p>
      {skills.length === 0 && <p className="text-xs text-ink-faint">Nothing in this column yet.</p>}
      <div className="space-y-2.5">
        {skills.slice(0, 12).map((skill) => (
          <div key={skill.skillId}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
              <span className="truncate text-ink-muted">
                {skill.name}
                {skill.importance === 'Core' && <span className="ml-1.5 text-brand-400">core</span>}
              </span>
              <span className="shrink-0 tabular-nums text-ink-faint">
                {skill.currentLevel} → {skill.targetLevel}
              </span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-brand-500"
                style={{ width: `${skill.currentLevel}%` }}
              />
              <div
                className="absolute inset-y-0 w-0.5 bg-accent-400"
                style={{ left: `${skill.targetLevel}%` }}
                title={`Target ${skill.targetLevel}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
