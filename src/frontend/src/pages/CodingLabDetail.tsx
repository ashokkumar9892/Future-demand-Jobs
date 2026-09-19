import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Editor from '@monaco-editor/react';
import { ArrowLeft, Bookmark, CheckCircle2, Play, RotateCcw, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Button, Card, CardHeader, Disclaimer, ErrorPanel, LoadingPanel } from '@/components/ui';
import { CodeBlock, Markdown } from '@/components/content';
import { useTheme } from '@/app/providers';
import { cn, scoreTone } from '@/lib/format';
import type { CodingExerciseDetail, CodingResult } from '@/types/api';

const MONACO_LANGUAGE: Record<string, string> = {
  csharp: 'csharp',
  typescript: 'typescript',
  javascript: 'javascript',
  python: 'python',
  sql: 'sql',
  json: 'json',
  yaml: 'yaml',
  hcl: 'hcl',
  dockerfile: 'dockerfile',
};

export default function CodingLabDetail() {
  const { slug = '' } = useParams();
  const queryClient = useQueryClient();
  const { theme } = useTheme();

  const [code, setCode] = useState('');
  const [result, setResult] = useState<CodingResult | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['coding-exercise', slug],
    queryFn: () => api.get<CodingExerciseDetail>(`/coding-exercises/${slug}`),
  });

  useEffect(() => {
    if (data) setCode(data.lastSubmission || data.starterCode);
    setResult(null);
  }, [data]);

  const run = useMutation({
    mutationFn: () => api.post<CodingResult>(`/coding-exercises/${data!.id}/attempt`, { code }),
    onSuccess: (payload) => {
      setResult(payload);
      queryClient.invalidateQueries({ queryKey: ['coding-exercises'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const toggleBookmark = useMutation({
    mutationFn: () =>
      api.post('/bookmarks/toggle', {
        itemType: 'CodingExercise',
        refId: data!.id,
        title: data!.title,
        subtitle: data!.category,
        deepLink: `/coding-labs/${data!.slug}`,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coding-exercise', slug] }),
  });

  if (isLoading) return <LoadingPanel label="Loading exercise" />;
  if (error) return <ErrorPanel message={(error as Error).message} />;
  if (!data) return null;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Coding labs', to: '/coding-labs' }, { label: data.category }]}
        title={data.title}
        description={`${data.difficulty} · ${data.language} · ~${data.estimatedMinutes} minutes`}
        actions={
          <>
            <Link
              to="/coding-labs"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs text-ink-muted transition hover:bg-surface-overlay hover:text-ink"
            >
              <ArrowLeft size={14} />
              All labs
            </Link>
            <Button
              size="sm"
              variant={data.isBookmarked ? 'primary' : 'secondary'}
              onClick={() => toggleBookmark.mutate()}
              icon={<Bookmark size={14} />}
            >
              {data.isBookmarked ? 'Saved' : 'Bookmark'}
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Problem" />
            <div className="card-pad">
              <Markdown>{data.problemMarkdown}</Markdown>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Checks"
              subtitle={`${data.testNames.length} checks must pass`}
            />
            <div className="divide-y divide-line">
              {data.testNames.map((name, index) => {
                const outcome = result?.tests[index];
                return (
                  <div key={name} className="flex items-start gap-2.5 px-5 py-3">
                    <span className="mt-0.5 shrink-0">
                      {!outcome ? (
                        <span className="block h-3.5 w-3.5 rounded-full border border-line" />
                      ) : outcome.passed ? (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      ) : (
                        <XCircle size={14} className="text-rose-400" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-[13px]',
                          outcome?.passed ? 'text-emerald-200' : outcome ? 'text-rose-200' : 'text-ink-muted',
                        )}
                      >
                        {name}
                      </p>
                      {outcome && !outcome.passed && outcome.hint && (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">{outcome.hint}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {result?.solutionCode && (
            <Card>
              <CardHeader title="Worked solution" subtitle="Unlocked because every check passed" />
              <div className="card-pad">
                <CodeBlock code={result.solutionCode} language={data.language} />
                {result.explanation && (
                  <div className="mt-4">
                    <p className="label mb-1.5">Why it is written this way</p>
                    <p className="text-[13px] leading-relaxed text-ink-muted">{result.explanation}</p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Editor"
              subtitle={data.language}
              action={
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCode(data.starterCode);
                      setResult(null);
                    }}
                    icon={<RotateCcw size={13} />}
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    loading={run.isPending}
                    onClick={() => run.mutate()}
                    icon={<Play size={13} />}
                  >
                    Run checks
                  </Button>
                </div>
              }
            />
            <div className="h-[560px] overflow-hidden rounded-b-2xl">
              <Editor
                height="100%"
                language={MONACO_LANGUAGE[data.language] ?? 'plaintext'}
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                value={code}
                onChange={(value) => setCode(value ?? '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, monospace',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  tabSize: 4,
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                }}
              />
            </div>
          </Card>

          {result && (
            <Card>
              <CardHeader
                title={result.passed ? 'All checks passed' : 'Checks failed'}
                subtitle={result.evaluationMethod}
                action={
                  <span className={cn('text-xl font-semibold tabular-nums', scoreTone(result.score))}>
                    {result.score}%
                  </span>
                }
              />
              <div className="card-pad">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={result.passed ? 'success' : 'warning'}>
                    {result.tests.filter((t) => t.passed).length} of {result.tests.length} checks
                  </Badge>
                  <Badge tone="brand">+{result.xpAwarded} XP</Badge>
                </div>
                {!result.passed && (
                  <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
                    Work through the hints on the failing checks. The worked solution unlocks once
                    every check passes — the point is to wrestle with it first.
                  </p>
                )}
              </div>
            </Card>
          )}

          {run.isError && <ErrorPanel message={(run.error as Error).message} />}

          <Disclaimer>
            Checks are static: they assert that the required constructs are present, not that the
            code compiles and runs. Treat a pass as "the shape is right", then run it locally.
          </Disclaimer>
        </div>
      </div>
    </>
  );
}
