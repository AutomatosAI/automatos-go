// A push received while the app is open (PRD-001 §4.8, KP14, KP15): the foreground handler PushRoot
// sets. It reads the notification (parse.ts), verifies its v2 payload with this server's push key
// within FOREGROUND_VERIFY_TIMEOUT_MS (a timeout counts as unverified), and answers US-014b's
// presentationFor: an unverified, timed-out or unreadable push shows nothing; a verified one shows
// its banner and list entry, without the banner when the person is already on its target, and
// refreshes the needs-you number and the open questions (the foundation's needsYou and questions
// families, src/api/query-keys.ts). Pure over its deps; never throws. Logs carry the kind only:
// never the notification's title, body, question, options or sig.

import type { QueryClient } from '@tanstack/react-query';

import { invalidateFamilies } from '../../api/live-events';
import type { KeyFamilyName } from '../../api/query-keys';
import { logger } from '../../lib/logger';
import { routeFor, targetFor } from '../links/targets';
import { SHOW_NOTHING, presentationFor, verifiedWithin } from '../platform/foreground';
import type { Presentation } from '../platform/port';
import { parsePushData, type PushPayload } from '../schemas/payload';
import { isVerified, type VerifyDeps } from './handler';
import { fromNotification } from './parse';

/** What a verified push refreshes: the badge's number and the Questions list (KP15). */
export const PUSH_REFRESH_FAMILIES: readonly KeyFamilyName[] = Object.freeze([
  'needsYou',
  'questions',
]);

export type IncomingDeps = VerifyDeps &
  Readonly<{
    /** The path on screen now (expo-router's pathname), or null before the first screen. */
    currentRoute: () => string | null;
    /** Refreshes PUSH_REFRESH_FAMILIES (refreshAfterPush over the app's query client). */
    refresh: () => void;
  }>;

type Shown = Readonly<{ kind: 'verified' | 'unverified' | 'unreadable'; shown: Presentation }>;

/** Marks the needs-you and questions families stale; the ones on screen refetch. */
export function refreshAfterPush(queryClient: Pick<QueryClient, 'invalidateQueries'>): void {
  void invalidateFamilies(queryClient, PUSH_REFRESH_FAMILIES);
}

/**
 * The person is on the screen of the record the push's signed link names. A push that names no
 * record the phone has a screen for (an approval, a Mission plan, no link at all) is never "on
 * screen": home is where it would have fallen back to, not its screen, so it keeps its banner there.
 */
function onTarget(payload: PushPayload, currentRoute: string | null): boolean {
  const target = targetFor(payload);
  return currentRoute !== null && target.kind !== 'home' && routeFor(target) === currentRoute;
}

function refreshed(deps: IncomingDeps): void {
  try {
    deps.refresh();
  } catch {
    logger.warn('[push] could not refresh after a notification');
  }
}

function currentRouteOf(deps: IncomingDeps): string | null {
  try {
    return deps.currentRoute();
  } catch {
    return null;
  }
}

async function presentationOf(notification: unknown, deps: IncomingDeps): Promise<Shown> {
  const event = fromNotification(notification);
  if (event.kind !== 'readable') return { kind: 'unreadable', shown: SHOW_NOTHING };
  const payload = parsePushData(event.data);
  const verified = await verifiedWithin(() => isVerified(payload, deps));
  if (!verified || !payload) return { kind: 'unverified', shown: SHOW_NOTHING };
  refreshed(deps);
  const onScreen = onTarget(payload, currentRouteOf(deps));
  return {
    kind: 'verified',
    shown: presentationFor({ verified, category: event.category, onScreen }),
  };
}

/** The foreground handler: what the system shows for this push. */
export async function handleIncoming(
  notification: unknown,
  deps: IncomingDeps,
): Promise<Presentation> {
  try {
    const { kind, shown } = await presentationOf(notification, deps);
    logger.debug('[push] notification received', kind);
    return shown;
  } catch {
    logger.warn('[push] a received notification could not be handled');
    return SHOW_NOTHING;
  }
}
