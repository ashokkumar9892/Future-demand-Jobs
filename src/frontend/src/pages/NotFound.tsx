import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={<Compass size={28} />}
        title="That page does not exist"
        description="The link may be out of date, or the content may have been renamed."
        action={
          <Link
            to="/"
            className="inline-flex h-9 items-center rounded-lg border border-brand-500/60 bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-500"
          >
            Back to dashboard
          </Link>
        }
      />
    </div>
  );
}
