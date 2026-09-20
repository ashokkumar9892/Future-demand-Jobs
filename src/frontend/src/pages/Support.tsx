import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  CreditCard,
  LifeBuoy,
  Mail,
  MessageSquarePlus,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardHeader, Disclaimer } from '@/components/ui';
import { useAuth } from '@/app/providers';
import { DEMO_MODE } from '@/lib/api';
import { SUPPORT_EMAIL, SUPPORT_RESPONSE_TIME, supportMailto } from '@/lib/support';

/**
 * One page that answers "who do I write to?".
 *
 * The platform already collects product feedback in its own screen, but that
 * queue is for what to build next — it is not a reply channel, and a guest
 * cannot reach it at all. Anything that needs an answer from a person, from a
 * payment that never opened to an account someone is locked out of, belongs in
 * an inbox, so this page is public and says which one.
 */
export default function Support() {
  const { user } = useAuth();

  // What support would otherwise have to ask for in a first reply.
  const context = [
    user ? `Account: ${user.email}` : 'Account: browsing as a guest',
    `Page: ${window.location.href}`,
    '',
    'What I was doing:',
    '',
    'What I expected:',
    '',
    'What happened instead:',
    '',
  ].join('\n');

  const TOPICS: { icon: typeof Mail; title: string; body: string; subject: string }[] = [
    {
      icon: CreditCard,
      title: 'A payment or enrolment',
      body: 'You paid for a course and it has not opened, or you want a receipt or a refund. Quote the reference shown on the checkout screen — it is how a payment is matched.',
      subject: 'Payment or enrolment question',
    },
    {
      icon: UserRound,
      title: 'Your account',
      body: 'You cannot sign in, need the email on the account changed, or want the account and its data removed.',
      subject: 'Account question',
    },
    {
      icon: BadgeCheck,
      title: 'A certificate',
      body: 'Checking whether a certificate is genuine, or a certificate you earned that has not appeared.',
      subject: 'Certificate question',
    },
    {
      icon: ShieldAlert,
      title: 'Something is broken or unsafe',
      body: 'A page that fails, content that is wrong, or a security problem you have found. Security reports are read first.',
      subject: 'Problem report',
    },
  ];

  return (
    <>
      <PageHeader
        title="Help & support"
        description="Anything the platform cannot answer for you, a person will. Write to us and we will come back to you."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Contact support"
              subtitle={`We aim to reply ${SUPPORT_RESPONSE_TIME}`}
              icon={<LifeBuoy size={15} />}
            />
            <div className="card-pad space-y-4">
              <div className="rounded-xl border border-brand-500/30 bg-brand-600/10 px-4 py-4">
                <p className="label">Email</p>
                <a
                  href={supportMailto('FutureTech Academy — support request', context)}
                  className="mt-1 flex items-center gap-2 break-all text-base font-semibold tracking-tight text-ink transition hover:text-brand-300"
                >
                  <Mail size={17} className="shrink-0 text-brand-400" />
                  {SUPPORT_EMAIL}
                </a>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                  Opening this fills in your account and the page you came from. Written to
                  directly it works just the same — nothing here is tracked to a ticket number.
                </p>
              </div>

              <div>
                <p className="label">What to include</p>
                <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-ink-muted">
                  <li>· The email your account uses, if you have one.</li>
                  <li>· The page or course it concerns, and what you expected to happen.</li>
                  <li>· For a payment, the reference from the checkout screen.</li>
                  <li>· A screenshot, where the screen says something you cannot act on.</li>
                </ul>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="What to write about" subtitle="All of it goes to the same inbox" />
            <div className="divide-y divide-line">
              {TOPICS.map((topic) => {
                const Icon = topic.icon;
                return (
                  <div key={topic.title} className="flex items-start gap-3 px-5 py-4">
                    <Icon size={16} className="mt-0.5 shrink-0 text-brand-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink">{topic.title}</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{topic.body}</p>
                      <a
                        href={supportMailto(
                          `FutureTech Academy — ${topic.subject}`,
                          context,
                        )}
                        className="link mt-1.5 inline-block text-[12px]"
                      >
                        Write about this
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="card-pad">
            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-muted">
              <MessageSquarePlus size={15} className="mt-0.5 shrink-0 text-brand-400" />
              <span>
                Suggesting what to build, fix or explain better is a different thing, and it has
                its own screen where you can see what was decided.{' '}
                {user ? (
                  <Link to="/feedback" className="link">
                    Send feedback
                  </Link>
                ) : (
                  <Link to="/login" className="link">
                    Sign in to send feedback
                  </Link>
                )}
                .
              </span>
            </p>
          </Card>

          <Card className="card-pad">
            <p className="label">Checking a certificate</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
              An employer can verify a certificate number without an account or an email to us.
            </p>
            <Link to="/verify" className="link mt-2 inline-block text-[12px]">
              Verify a certificate
            </Link>
          </Card>

          {DEMO_MODE && (
            <Disclaimer>
              This build runs in your browser with no API behind it, so nothing you do here is
              stored on a server. Email still reaches us.
            </Disclaimer>
          )}

          <Disclaimer>
            Support will never ask you for a password or a card number. Nothing on this platform
            takes a card number.
          </Disclaimer>
        </div>
      </div>
    </>
  );
}
