import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark as BookmarkIcon, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Card, EmptyState, ErrorPanel, LoadingPanel, Stat, Tabs } from '@/components/ui';
import type { Bookmark } from '@/types/api';

export default function Bookmarks() {
  const queryClient = useQueryClient();
  const [type, setType] = useState('All');

  const { data, isLoading, error } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => api.get<Bookmark[]>('/bookmarks'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/bookmarks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] }),
  });

  const types = useMemo(() => {
    const set = new Set((data ?? []).map((b) => b.itemType));
    return ['All', ...Array.from(set).sort()];
  }, [data]);

  const filtered = (data ?? []).filter((b) => type === 'All' || b.itemType === type);

  return (
    <>
      <PageHeader
        title="Bookmarks"
        description="Everything you saved across lessons, practice questions, projects, labs and interview questions."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="card-pad">
          <Stat label="Saved items" value={data?.length ?? 0} />
        </Card>
        <Card className="card-pad">
          <Stat label="Types" value={types.length - 1} />
        </Card>
        <Card className="card-pad">
          <Stat label="Showing" value={filtered.length} detail={type} />
        </Card>
      </div>

      <div className="mb-5">
        <Tabs tabs={types.map((t) => ({ key: t, label: t }))} active={type} onChange={setType} />
      </div>

      {isLoading && <LoadingPanel label="Loading bookmarks" />}
      {error && <ErrorPanel message={(error as Error).message} />}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={<BookmarkIcon size={26} />}
          title="Nothing saved yet"
          description="Use the Bookmark button on a lesson, project, practice question or lab and it will appear here."
        />
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((bookmark) => (
          <Card key={bookmark.id} className="flex items-start gap-3 card-pad">
            <BookmarkIcon size={15} className="mt-0.5 shrink-0 text-brand-400" />
            <div className="min-w-0 flex-1">
              {bookmark.deepLink ? (
                <Link
                  to={bookmark.deepLink}
                  className="block truncate text-sm text-ink transition hover:text-brand-300"
                >
                  {bookmark.title}
                </Link>
              ) : (
                <p className="truncate text-sm text-ink">{bookmark.title}</p>
              )}
              <p className="mt-0.5 truncate text-[11px] text-ink-faint">{bookmark.subtitle}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone="neutral">{bookmark.itemType}</Badge>
                <span className="text-[10px] text-ink-faint">{bookmark.createdAt}</span>
              </div>
            </div>
            <button
              onClick={() => remove.mutate(bookmark.id)}
              className="shrink-0 rounded-md p-1.5 text-ink-faint transition hover:bg-surface-overlay hover:text-rose-300"
              aria-label="Remove bookmark"
            >
              <Trash2 size={14} />
            </button>
          </Card>
        ))}
      </div>
    </>
  );
}
