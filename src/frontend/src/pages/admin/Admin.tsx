import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Pencil, Plus, Save, Trash2, TrendingUp, Video, X } from 'lucide-react';
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
  Textarea,
} from '@/components/ui';
import { cn } from '@/lib/format';
import type { AdminPage, AdminResource, AdminStats, CareerSummary } from '@/types/api';

export default function Admin() {
  const [resource, setResource] = useState('careers');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);

  const queryClient = useQueryClient();

  const resources = useQuery({
    queryKey: ['admin-resources'],
    queryFn: () => api.get<AdminResource[]>('/admin/resources'),
  });

  const stats = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<AdminStats>('/admin/stats'),
  });

  const rows = useQuery({
    queryKey: ['admin-rows', resource, search],
    queryFn: () =>
      api.get<AdminPage>(
        `/admin/${resource}?pageSize=100${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  const current = resources.data?.find((r) => r.key === resource);

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/admin/${resource}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rows'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  const columns = useMemo(() => {
    const first = rows.data?.items[0];
    if (!first) return [];
    const preferred = ['code', 'title', 'name', 'question', 'prompt', 'slug', 'rank', 'order', 'category'];
    const keys = Object.keys(first).filter((k) => k !== 'id' && k !== 'createdAt' && k !== 'updatedAt');
    return [
      ...preferred.filter((k) => keys.includes(k)),
      ...keys.filter((k) => !preferred.includes(k)),
    ].slice(0, 5);
  }, [rows.data]);

  return (
    <>
      <PageHeader
        title="Admin"
        description="Content management for every table the platform reads. Changes take effect immediately — there is no separate publish step."
      />

      {stats.data && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Card className="card-pad">
            <Stat label="Careers" value={stats.data.careers} />
          </Card>
          <Card className="card-pad">
            <Stat label="Courses" value={stats.data.courses} detail={`${stats.data.modules} modules`} />
          </Card>
          <Card className="card-pad">
            <Stat label="Lessons" value={stats.data.lessons} />
          </Card>
          <Card className="card-pad">
            <Stat
              label="Videos"
              value={`${stats.data.videosWithUrl} / ${stats.data.videos}`}
              detail="with a verified URL"
            />
          </Card>
          <Card className="card-pad">
            <Stat
              label="Questions"
              value={stats.data.practiceQuestions + stats.data.interviewQuestions}
              detail={`${stats.data.practiceQuestions} practice · ${stats.data.interviewQuestions} interview`}
            />
          </Card>
          <Card className="card-pad">
            <Stat label="Learners" value={stats.data.learners} />
          </Card>
        </div>
      )}

      <SalaryPanel />

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Resources" icon={<Database size={15} />} />
          <div className="max-h-[70vh] overflow-y-auto py-1">
            {(resources.data ?? []).map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setResource(item.key);
                  setEditing(null);
                  setCreating(false);
                  setSearch('');
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[13px] transition',
                  resource === item.key
                    ? 'bg-brand-600/15 text-ink'
                    : 'text-ink-muted hover:bg-surface-overlay hover:text-ink',
                )}
              >
                <span className="truncate">{item.label}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-ink-faint">{item.count}</span>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title={current?.label ?? resource}
              subtitle={`${rows.data?.total ?? 0} rows · ${current?.entityName ?? ''}`}
              action={
                <div className="flex items-center gap-2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search"
                    className="h-8 w-40 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setCreating(true);
                      setEditing(null);
                    }}
                    icon={<Plus size={13} />}
                  >
                    New
                  </Button>
                </div>
              }
            />

            {rows.isLoading && <LoadingPanel label="Loading rows" />}
            {rows.error && (
              <div className="p-4">
                <ErrorPanel message={(rows.error as Error).message} />
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-line">
                    {columns.map((column) => (
                      <th key={column} className="px-4 py-2 font-medium text-ink-faint">
                        {column}
                      </th>
                    ))}
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(rows.data?.items ?? []).map((row) => (
                    <tr key={String(row.id)} className="border-b border-line/60 hover:bg-surface-overlay">
                      {columns.map((column) => (
                        <td key={column} className="max-w-[18rem] truncate px-4 py-2 text-ink-muted">
                          {formatCell(row[column])}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        <button
                          onClick={() => {
                            setEditing(row);
                            setCreating(false);
                          }}
                          className="rounded-md p-1.5 text-ink-faint transition hover:bg-surface-sunken hover:text-ink"
                          aria-label="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this row? This cannot be undone.')) {
                              remove.mutate(String(row.id));
                            }
                          }}
                          className="rounded-md p-1.5 text-ink-faint transition hover:bg-surface-sunken hover:text-rose-300"
                          aria-label="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {(editing || creating) && current && (
            <RowEditor
              resource={resource}
              fields={current.fields}
              row={editing}
              onClose={() => {
                setEditing(null);
                setCreating(false);
              }}
              onSaved={() => {
                setEditing(null);
                setCreating(false);
                queryClient.invalidateQueries({ queryKey: ['admin-rows'] });
                queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
                queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
              }}
            />
          )}
        </div>
      </div>

      <Disclaimer className="mt-6">
        <span className="inline-flex items-center gap-1.5">
          <Video size={12} />
          Video rows ship with an empty URL by design. Attaching a link here is the only way a video
          appears in a lesson — the platform never generates one.
        </span>
      </Disclaimer>
    </>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function RowEditor({
  resource,
  fields,
  row,
  onClose,
  onSaved,
}: {
  resource: string;
  fields: AdminResource['fields'];
  row: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setValues(row ? { ...row } : {});
  }, [row]);

  const save = useMutation({
    mutationFn: () => {
      const payload = { ...values };
      delete payload.id;
      delete payload.createdAt;
      delete payload.updatedAt;
      return row
        ? api.put(`/admin/${resource}/${String(row.id)}`, payload)
        : api.post(`/admin/${resource}`, payload);
    },
    onSuccess: onSaved,
  });

  const editable = fields.filter((f) => f.name !== 'id');

  return (
    <Card>
      <CardHeader
        title={row ? 'Edit row' : 'New row'}
        subtitle={resource}
        action={
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-faint hover:text-ink" aria-label="Close">
            <X size={15} />
          </button>
        }
      />
      <div className="card-pad">
        <div className="grid gap-3 lg:grid-cols-2">
          {editable.map((field) => {
            const value = values[field.name];

            if (field.type === 'enum' && field.options) {
              return (
                <Field key={field.name} label={field.name}>
                  <Select
                    value={String(value ?? field.options[0])}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  >
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </Field>
              );
            }

            if (field.type === 'boolean') {
              return (
                <Field key={field.name} label={field.name}>
                  <label className="flex h-9 items-center gap-2 text-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.checked }))}
                      className="accent-brand-500"
                    />
                    {String(Boolean(value))}
                  </label>
                </Field>
              );
            }

            // Long-form content gets a textarea; everything else a single line.
            const isLong = /markdown|content|summary|description|json|answer|brief|criteria|keywords|responsibilities|focus|code|tips|scenario|rationale/i.test(
              field.name,
            );

            return (
              <Field key={field.name} label={field.name} hint={field.required ? 'required' : undefined}>
                {isLong ? (
                  <Textarea
                    rows={4}
                    value={String(value ?? '')}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                    className="font-mono text-[11px]"
                  />
                ) : (
                  <Input
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    value={String(value ?? '')}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [field.name]: field.type === 'number' ? Number(e.target.value) : e.target.value,
                      }))
                    }
                  />
                )}
              </Field>
            );
          })}
        </div>

        {save.isError && (
          <div className="mt-4">
            <ErrorPanel message={(save.error as Error).message} />
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()} icon={<Save size={14} />}>
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Salary has its own endpoint so every change writes an audit row. */
function SalaryPanel() {
  const queryClient = useQueryClient();
  const [careerId, setCareerId] = useState('');
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(0);
  const [seniorMin, setSeniorMin] = useState(0);
  const [seniorMax, setSeniorMax] = useState(0);
  const [source, setSource] = useState('');

  const careers = useQuery({
    queryKey: ['careers'],
    queryFn: () => api.get<CareerSummary[]>('/careers'),
  });

  useEffect(() => {
    const career = careers.data?.find((c) => c.id === careerId);
    if (!career) return;
    setMin(career.salaryMinUsd);
    setMax(career.salaryMaxUsd);
    setSeniorMin(career.seniorSalaryMinUsd);
    setSeniorMax(career.seniorSalaryMaxUsd);
    setSource(career.salarySource);
  }, [careerId, careers.data]);

  const save = useMutation({
    mutationFn: () =>
      api.put(`/admin/careers/${careerId}/salary`, {
        salaryMinUsd: min,
        salaryMaxUsd: max,
        seniorSalaryMinUsd: seniorMin,
        seniorSalaryMaxUsd: seniorMax,
        source,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['careers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-rows'] });
    },
  });

  return (
    <Card className="mb-5">
      <CardHeader
        title="Salary data"
        subtitle="Every change writes an audited revision with its source"
        icon={<TrendingUp size={15} />}
        action={save.isSuccess && <Badge tone="success">Saved</Badge>}
      />
      <div className="card-pad">
        <div className="grid gap-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Field label="Career">
              <Select value={careerId} onChange={(e) => setCareerId(e.target.value)}>
                <option value="">Select a career</option>
                {(careers.data ?? []).map((career) => (
                  <option key={career.id} value={career.id}>
                    {career.rank}. {career.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Min">
            <Input type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} />
          </Field>
          <Field label="Max">
            <Input type="number" value={max} onChange={(e) => setMax(Number(e.target.value))} />
          </Field>
          <Field label="Senior min">
            <Input type="number" value={seniorMin} onChange={(e) => setSeniorMin(Number(e.target.value))} />
          </Field>
          <Field label="Senior max">
            <Input type="number" value={seniorMax} onChange={(e) => setSeniorMax(Number(e.target.value))} />
          </Field>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <Field label="Source" hint="Recorded on the revision so the figure can be traced.">
            <Input value={source} onChange={(e) => setSource(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button
              variant="primary"
              disabled={!careerId || max < min}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              Update salary
            </Button>
          </div>
        </div>

        {save.isError && (
          <div className="mt-3">
            <ErrorPanel message={(save.error as Error).message} />
          </div>
        )}
      </div>
    </Card>
  );
}
