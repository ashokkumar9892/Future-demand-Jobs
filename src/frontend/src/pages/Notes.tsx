import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, NotebookPen, Search, Star, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorPanel,
  Field,
  Input,
  LoadingPanel,
  Select,
  Stat,
  Textarea,
} from '@/components/ui';
import { CodeBlock } from '@/components/content';
import type { Note } from '@/types/api';

const SCOPES = ['General', 'Lesson', 'Course', 'Project', 'PracticeQuestion', 'InterviewQuestion'];

export default function Notes() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [importantOnly, setImportantOnly] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scope, setScope] = useState('General');
  const [tags, setTags] = useState('');
  const [code, setCode] = useState('');
  const [important, setImportant] = useState(false);
  const [isQuestion, setIsQuestion] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['notes', importantOnly],
    queryFn: () => api.get<Note[]>(`/notes${importantOnly ? '?importantOnly=true' : ''}`),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<Note>('/notes', {
        scope,
        refTitle: '',
        title: title || body.split('\n')[0].slice(0, 60),
        body,
        isImportant: important,
        isQuestion,
        codeSnippet: code || null,
        tags,
      }),
    onSuccess: () => {
      setTitle('');
      setBody('');
      setTags('');
      setCode('');
      setImportant(false);
      setIsQuestion(false);
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/notes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter(
      (note) =>
        note.title.toLowerCase().includes(term) ||
        note.body.toLowerCase().includes(term) ||
        note.tags.toLowerCase().includes(term),
    );
  }, [data, search]);

  return (
    <>
      <PageHeader
        title="Notes"
        description="Everything you captured while studying. Notes made inside a lesson appear here alongside the ones you write directly."
        actions={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes"
              className="w-56 pl-9"
            />
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="card-pad">
          <Stat label="Notes" value={data?.length ?? 0} />
        </Card>
        <Card className="card-pad">
          <Stat label="Important" value={(data ?? []).filter((n) => n.isImportant).length} />
        </Card>
        <Card className="card-pad">
          <Stat label="Open questions" value={(data ?? []).filter((n) => n.isQuestion).length} />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Button
              size="sm"
              variant={importantOnly ? 'primary' : 'secondary'}
              onClick={() => setImportantOnly((v) => !v)}
              icon={<Star size={13} />}
            >
              Important only
            </Button>
          </div>

          {isLoading && <LoadingPanel label="Loading notes" />}
          {error && <ErrorPanel message={(error as Error).message} />}

          {!isLoading && filtered.length === 0 && (
            <EmptyState
              icon={<NotebookPen size={26} />}
              title="No notes yet"
              description="Capture what you want to remember — the form on the right, or the notes panel inside any lesson."
            />
          )}

          <div className="space-y-3">
            {filtered.map((note) => (
              <Card key={note.id} className="card-pad">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium text-ink">{note.title || 'Untitled'}</h3>
                      {note.isImportant && (
                        <Badge tone="warning">
                          <Star size={10} />
                          Important
                        </Badge>
                      )}
                      {note.isQuestion && (
                        <Badge tone="info">
                          <HelpCircle size={10} />
                          Question
                        </Badge>
                      )}
                      <Badge tone="neutral">{note.scope}</Badge>
                    </div>

                    {note.refTitle && (
                      <p className="mt-0.5 text-[11px] text-ink-faint">on {note.refTitle}</p>
                    )}

                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-muted">
                      {note.body}
                    </p>

                    {note.codeSnippet && (
                      <div className="mt-3">
                        <CodeBlock code={note.codeSnippet} language="text" maxHeight="max-h-64" />
                      </div>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {note.tags
                        .split(',')
                        .filter(Boolean)
                        .map((tag) => (
                          <Badge key={tag} tone="neutral">
                            {tag.trim()}
                          </Badge>
                        ))}
                      <span className="text-[10px] text-ink-faint">
                        {note.updatedAt ?? note.createdAt}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => remove.mutate(note.id)}
                    className="shrink-0 rounded-md p-1.5 text-ink-faint transition hover:bg-surface-overlay hover:text-rose-300"
                    aria-label="Delete note"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card className="h-fit">
          <CardHeader title="New note" icon={<NotebookPen size={15} />} />
          <div className="space-y-3 card-pad">
            <Field label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Scope">
              <Select value={scope} onChange={(e) => setScope(e.target.value)}>
                {SCOPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Note">
              <Textarea
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What do you want to remember?"
                className="text-[12px]"
              />
            </Field>
            <Field label="Code snippet" hint="Optional.">
              <Textarea
                rows={4}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono text-[11px]"
              />
            </Field>
            <Field label="Tags" hint="Comma separated.">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="rag, azure" />
            </Field>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <input
                  type="checkbox"
                  checked={important}
                  onChange={(e) => setImportant(e.target.checked)}
                  className="accent-brand-500"
                />
                Important
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <input
                  type="checkbox"
                  checked={isQuestion}
                  onChange={(e) => setIsQuestion(e.target.checked)}
                  className="accent-brand-500"
                />
                Open question
              </label>
            </div>

            <Button
              variant="primary"
              className="w-full"
              loading={create.isPending}
              disabled={body.trim().length === 0}
              onClick={() => create.mutate()}
            >
              Save note
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
