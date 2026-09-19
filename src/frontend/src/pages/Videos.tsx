import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PlayCircle, Search, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge, Card, Disclaimer, EmptyState, ErrorPanel, Input, LoadingPanel, Stat, Tabs } from '@/components/ui';
import type { VideoDto } from '@/types/api';

export default function Videos() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'linked' | 'placeholder'>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['videos'],
    queryFn: () => api.get<VideoDto[]>('/videos'),
  });

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (filter === 'linked') list = list.filter((v) => !!v.youTubeUrl);
    if (filter === 'placeholder') list = list.filter((v) => !v.youTubeUrl);
    const term = search.trim().toLowerCase();
    if (term)
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(term) || (v.lessonTitle ?? '').toLowerCase().includes(term),
      );
    return list;
  }, [data, search, filter]);

  const linked = (data ?? []).filter((v) => v.youTubeUrl).length;

  return (
    <>
      <PageHeader
        title="Video library"
        description="Each lesson carries a video slot. The platform never invents URLs — an administrator attaches a verified link and it embeds in the lesson automatically."
        actions={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter videos"
              className="w-56 pl-9"
            />
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="card-pad">
          <Stat label="Video slots" value={data?.length ?? 0} detail="one per lesson" />
        </Card>
        <Card className="card-pad">
          <Stat label="Linked" value={linked} detail="verified URLs attached" />
        </Card>
        <Card className="card-pad">
          <Stat label="Awaiting a link" value={(data?.length ?? 0) - linked} />
        </Card>
      </div>

      <div className="mb-5">
        <Tabs
          tabs={[
            { key: 'all', label: 'All' },
            { key: 'linked', label: 'Linked', count: linked },
            { key: 'placeholder', label: 'Awaiting link', count: (data?.length ?? 0) - linked },
          ]}
          active={filter}
          onChange={setFilter}
        />
      </div>

      {isLoading && <LoadingPanel label="Loading videos" />}
      {error && <ErrorPanel message={(error as Error).message} />}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={<PlayCircle size={26} />}
          title="No videos match that filter"
          description={
            filter === 'linked'
              ? 'No verified URLs have been attached yet. An administrator can add them in Admin → Videos.'
              : 'Try a different filter or clear the search.'
          }
        />
      )}

      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((video) => (
          <Card key={video.id} className="card-pad">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <PlayCircle size={15} className={video.youTubeUrl ? 'text-brand-400' : 'text-ink-faint'} />
                <Badge tone={video.youTubeUrl ? 'success' : 'neutral'}>
                  {video.youTubeUrl ? 'Linked' : 'Awaiting link'}
                </Badge>
              </div>
              {video.isVerified && (
                <Badge tone="brand">
                  <ShieldCheck size={10} />
                  Verified
                </Badge>
              )}
            </div>

            <h3 className="mt-2.5 text-sm font-medium text-ink">{video.title}</h3>

            {video.lessonSlug && (
              <Link
                to={`/learn/${video.lessonSlug}`}
                className="mt-1 block truncate text-[11px] text-brand-400 transition hover:underline"
              >
                {video.lessonTitle}
              </Link>
            )}

            <p className="mt-2 text-[11px] text-ink-faint">
              {[video.instructor, `${video.durationMinutes} min`, video.skillLevel]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </Card>
        ))}
      </div>

      <Disclaimer className="mt-6">
        No YouTube URL in this platform is fabricated. Video metadata — title, duration, level — is
        authored as part of the curriculum, and the URL stays empty until{' '}
        {user?.role === 'Admin' ? (
          <Link to="/admin" className="link">
            an administrator attaches a verified link
          </Link>
        ) : (
          'an administrator attaches a verified link'
        )}
        .
      </Disclaimer>
    </>
  );
}
