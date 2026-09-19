import { useEffect, useId, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/format';

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('prose-lesson', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

export function CodeBlock({
  code,
  language = 'csharp',
  title,
  maxHeight = 'max-h-[32rem]',
}: {
  code: string;
  language?: string;
  title?: string;
  maxHeight?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; the code is still selectable.
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-sunken">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
          {title ?? language}
        </span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-ink-faint transition hover:bg-surface-overlay hover:text-ink"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className={cn('overflow-auto p-4', maxHeight)}>
        <code className="font-mono text-[12.5px] leading-relaxed text-ink-muted">{code}</code>
      </pre>
    </div>
  );
}

/**
 * Renders a Mermaid diagram. Mermaid is imported lazily because it is large and
 * only a handful of screens need it, and a render failure falls back to the
 * source text rather than blanking the panel.
 */
export function MermaidDiagram({ chart, className }: { chart: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          securityLevel: 'strict',
          fontFamily: 'Inter, sans-serif',
          themeVariables: {
            background: 'transparent',
            primaryColor: '#1e1b4b',
            primaryTextColor: '#e6e9f2',
            primaryBorderColor: '#4f46e5',
            lineColor: '#6b7285',
            secondaryColor: '#18223a',
            tertiaryColor: '#111423',
            fontSize: '13px',
          },
        });

        const { svg } = await mermaid.render(`mmd-${id}`, chart);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (failed) {
    return (
      <pre className="overflow-auto rounded-xl border border-line bg-surface-sunken p-4 font-mono text-[12px] text-ink-muted">
        {chart}
      </pre>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        'flex justify-center overflow-auto rounded-xl border border-line bg-surface-sunken p-4 [&_svg]:max-w-full',
        className,
      )}
    />
  );
}
