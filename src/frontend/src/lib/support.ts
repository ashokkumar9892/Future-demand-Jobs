/**
 * Where a learner writes when the platform cannot answer them itself.
 *
 * One address, defined once, so every screen that offers help points at the
 * same inbox — a support line that differs between the sign-in page and the
 * checkout is a support line nobody trusts. Set VITE_SUPPORT_EMAIL at build
 * time to route an operator's own deployment somewhere else.
 */
export const SUPPORT_EMAIL: string =
  import.meta.env.VITE_SUPPORT_EMAIL ?? 'infosession2015@gmail.com';

/** Roughly how long an answer takes, stated in one place so it stays honest. */
export const SUPPORT_RESPONSE_TIME = 'within 1–2 working days';

/**
 * A `mailto:` for the support inbox, pre-filled.
 *
 * The subject is what the learner was doing when they asked; the body is the
 * context they would otherwise be asked for in a reply. Both are optional —
 * plain `supportMailto()` is a bare address.
 */
export function supportMailto(subject?: string, body?: string): string {
  const params = [
    subject && `subject=${encodeURIComponent(subject)}`,
    body && `body=${encodeURIComponent(body)}`,
  ].filter(Boolean);

  return `mailto:${SUPPORT_EMAIL}${params.length ? `?${params.join('&')}` : ''}`;
}
