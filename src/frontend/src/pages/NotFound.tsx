import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { SUPPORT_EMAIL, supportMailto } from '@/lib/support';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={<Compass size={28} />}
        title="That page does not exist"
        description="The link may be out of date, or the content may have been renamed."
        action={
          <div className="flex flex-col items-center gap-2">
            <Link
              to="/"
              className="inline-flex h-9 items-center rounded-lg border border-brand-500/60 bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-500"
            >
              Back to dashboard
            </Link>
            {/* A link that should have worked is a support matter, not just a
                wrong turn — offer the address rather than only the way back. */}
            <p className="text-[11px] text-ink-faint">
              Followed a link that should work?{' '}
              <a
                href={supportMailto(
                  'FutureTech Academy — broken link',
                  `The link that failed:
${window.location.href}
`,
                )}
                className="link"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        }
      />
    </div>
  );
}
