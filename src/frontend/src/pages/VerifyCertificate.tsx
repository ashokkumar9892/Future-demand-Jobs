import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Route as RouteIcon, Search, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, ErrorPanel, Input, LoadingPanel } from '@/components/ui';
import { formatDate } from '@/lib/format';
import type { CertificateVerification } from '@/types/api';

/**
 * Public certificate check. Deliberately outside the app shell and outside
 * authentication: the point is that someone shown a certificate — an employer,
 * say — can confirm it without an account here.
 */
export default function VerifyCertificate() {
  const { number: fromUrl } = useParams();
  const [input, setInput] = useState(fromUrl ?? '');
  const [query, setQuery] = useState(fromUrl ?? '');

  const result = useQuery({
    queryKey: ['verify', query],
    queryFn: () => api.get<CertificateVerification>(`/certificates/verify/${encodeURIComponent(query)}`),
    enabled: query.trim().length > 0,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setQuery(input.trim());
  };

  return (
    <div className="min-h-screen bg-surface-base px-6 py-12">
      <div className="mx-auto w-full max-w-xl">
        <Link to="/" className="mb-8 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500">
            <RouteIcon size={19} className="text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-ink">
            FutureTech Career Academy
          </span>
        </Link>

        <h1 className="text-xl font-semibold tracking-tight text-ink">Verify a certificate</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Enter the certificate number printed on the document, for example FTA-2026-7K4QX2.
        </p>

        <form onSubmit={submit} className="mt-6 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="FTA-0000-XXXXXX"
            className="font-mono"
            aria-label="Certificate number"
          />
          <Button type="submit" variant="primary" icon={<Search size={15} />}>
            Check
          </Button>
        </form>

        {result.isLoading && query && <LoadingPanel label="Checking" />}
        {result.error && (
          <div className="mt-6">
            <ErrorPanel message={(result.error as Error).message} />
          </div>
        )}

        {result.data && !result.data.found && (
          <Card className="card-pad mt-6">
            <p className="flex items-start gap-2 text-sm text-ink">
              <XCircle size={18} className="mt-0.5 shrink-0 text-rose-400" />
              {result.data.statement}
            </p>
          </Card>
        )}

        {result.data?.found && (
          <Card className="mt-6 overflow-hidden">
            <div className="bg-[radial-gradient(30rem_16rem_at_20%_-20%,rgb(16_185_129/0.16),transparent)] px-6 py-6">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                <BadgeCheck size={18} />
                This certificate was issued by this platform.
              </p>

              <dl className="mt-5 space-y-3 text-[13px]">
                <div>
                  <dt className="label">Awarded to</dt>
                  <dd className="mt-0.5 text-base font-medium text-ink">{result.data.learnerName}</dd>
                </div>
                <div>
                  <dt className="label">Course</dt>
                  <dd className="mt-0.5 text-ink">{result.data.courseTitle}</dd>
                </div>
                <div className="flex gap-8">
                  <div>
                    <dt className="label">Completion</dt>
                    <dd className="mt-0.5 text-ink">{result.data.percentComplete}%</dd>
                  </div>
                  <div>
                    <dt className="label">Issued</dt>
                    <dd className="mt-0.5 text-ink">
                      {result.data.issuedAt ? formatDate(result.data.issuedAt) : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="label">Number</dt>
                    <dd className="mt-0.5 font-mono text-[12px] text-ink">
                      {result.data.certificateNumber}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>

            <p className="border-t border-line px-6 py-3 text-[11px] leading-relaxed text-ink-faint">
              {result.data.statement}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
