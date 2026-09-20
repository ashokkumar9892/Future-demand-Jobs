import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Search, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Card, Disclaimer, ErrorPanel, Input, LoadingPanel, Pill, Progress, Tabs } from '@/components/ui';
import { cn, DEMAND_TONE, money, RISK_TONE } from '@/lib/format';
import type { CareerSummary } from '@/types/api';

type SortKey = 'rank' | 'salary' | 'hours';

export default function Careers() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('rank');

  const { data, isLoading, error } = useQuery({
    queryKey: ['careers', sort],
    queryFn: () => api.get<CareerSummary[]>(`/careers?sort=${sort}`),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (career) =>
        career.title.toLowerCase().includes(term) || career.summary.toLowerCase().includes(term),
    );
  }, [data, search]);

  return (
    <>
      <PageHeader
        title="Career paths"
        description="Ranked by realistic USA compensation for an experienced enterprise engineer. Salary figures are aggregated public estimates and are updatable through Admin."
        actions={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter roles"
              className="w-56 pl-9"
            />
          </div>
        }
      />

      <div className="mb-5">
        <Tabs
          tabs={[
            { key: 'rank', label: 'By rank' },
            { key: 'salary', label: 'By salary' },
            { key: 'hours', label: 'By training hours' },
          ]}
          active={sort}
          onChange={(key) => setSort(key as SortKey)}
        />
      </div>

      {isLoading && <LoadingPanel label="Loading career paths" />}
      {error && <ErrorPanel message={(error as Error).message} />}

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((career) => (
          <CareerCard key={career.id} career={career} />
        ))}
      </div>

      <Disclaimer className="mt-6">
        Salary bands are aggregated public estimates for the United States, reviewed against the
        date shown on each card. They are indicative only and vary substantially by location,
        industry and company size.
      </Disclaimer>
    </>
  );
}

function CareerCard({ career }: { career: CareerSummary }) {
  const totalSkills = career.skillsYouHave + career.skillsToLearn;
  const coverage = totalSkills > 0 ? Math.round((career.skillsYouHave / totalSkills) * 100) : 0;

  return (
    <Card className="flex flex-col transition hover:border-line-strong hover:shadow-lift">
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold',
            career.isPrimaryRecommended
              ? 'border-brand-400/60 bg-brand-600/20 text-brand-300'
              : 'border-line bg-surface-sunken text-ink-faint',
          )}
        >
          {career.rank}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/careers/${career.slug}`}
              className="text-sm font-semibold tracking-tight text-ink transition hover:text-brand-300"
            >
              {career.title}
            </Link>
            {career.isPrimaryRecommended && (
              <Badge tone="brand">
                <Sparkles size={10} />
                Recommended
              </Badge>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">{career.summary}</p>
        </div>

        <Link
          to={`/careers/${career.slug}`}
          className="shrink-0 rounded-md p-1.5 text-ink-faint transition hover:bg-surface-overlay hover:text-ink"
          aria-label={`Open ${career.title}`}
        >
          <ArrowUpRight size={15} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 px-5 py-4">
        <div>
          <p className="label">Salary range · {career.salary?.countryName ?? 'USA'}</p>
          {career.salary && !career.salary.hasData ? (
            <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">{career.salary.message}</p>
          ) : (
            <>
              <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-ink">
                {career.salary?.range ?? `${money(career.salaryMinUsd)}–${money(career.salaryMaxUsd)}`}
              </p>
              <p className="text-[11px] text-ink-faint">
                Senior{' '}
                {career.salary?.seniorRange ??
                  `${money(career.seniorSalaryMinUsd)}–${money(career.seniorSalaryMaxUsd)}`}
              </p>
            </>
          )}
        </div>
        <div>
          <p className="label">Training</p>
          <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-ink">
            {career.estimatedHours} hrs
          </p>
          <p className="text-[11px] text-ink-faint">
            ~{career.estimatedWeeksAt12Hours} weeks at 12 hrs/week
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-5 pb-4">
        <Pill className={DEMAND_TONE[career.demandOutlook] ?? DEMAND_TONE.Strong}>
          <TrendingUp size={10} />
          {career.demandOutlook} demand
        </Pill>
        <Pill className={RISK_TONE[career.aiReplacementRisk] ?? RISK_TONE.Low}>
          <ShieldCheck size={10} />
          {career.aiReplacementRisk} AI risk
        </Pill>
        <Pill className="border-line bg-surface-sunken text-ink-muted">{career.difficulty}</Pill>
      </div>

      <div className="mt-auto border-t border-line px-5 py-4">
        <div className="mb-1.5 flex items-baseline justify-between text-[11px]">
          <span className="text-ink-faint">Skill coverage</span>
          <span className="text-ink">
            <span className="text-emerald-300">{career.skillsYouHave} have</span>
            {' · '}
            <span className="text-amber-300">{career.skillsToLearn} to learn</span>
          </span>
        </div>
        <Progress value={coverage} barClassName="bg-emerald-500" />

        <p className="mt-3 line-clamp-2 text-[11px] leading-relaxed text-ink-faint">
          <span className="text-ink-muted">$200K+:</span> {career.twoHundredKPotential}
        </p>
      </div>
    </Card>
  );
}
