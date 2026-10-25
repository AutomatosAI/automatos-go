// The action handler (PRD-001 §4.8, PRD-266 §4.4, D-LOCK-SCREEN, D-SIGNATURE, KP6, KP7, KP8): one
// notification response → exactly one honest outcome. parse (parse.ts) → handled once
// (handled-store.ts) → the push record's key (registration/key-store.ts) → verifyPushSignature →
// intentFor → act. A reply posts its answer once (answer.ts) and lands on Questions with the
// server's result; Open and a tap open the link's screen after its stale check (links/stale.ts);
// anything else opens home, or the question, with nothing done. Only a verified push of the current
// workspace posts, follows its link or marks its bell notification read. The outcome is shown
// first (the screen, then its line); marking read and dismissing follow, and a failure of either is
// ignored. The key is the record's when the record is this server's: a push from another workspace
// on it still verifies and says so, and acts on nothing. Returns where it went and what it said;
// null for a response already handled. Never throws. Logs carry kinds only: never the
// notification's text, the reply, the sig, the key or the token.

import type { ApiClient } from '../../api/client';
import { isApiError } from '../../api/errors';
import type { WorkspaceRole } from '../../api/workspace';
import { ROLE_COPY } from '../../auth/strings';
import { logger } from '../../lib/logger';
import { routes } from '../../navigation/routes';
import { markNotificationRead } from '../api';
import { resolveTarget, type StaleChecks } from '../links/stale';
import { routeFor, targetFor } from '../links/targets';
import type { NotificationsPort } from '../platform/expo';
import type { PushKeyStore } from '../registration/key-store';
import type { PushRecord } from '../registration/record';
import { parsePushData, type PushPayload } from '../schemas/payload';
import type { Sha256 } from '../signature/hmac';
import { verifyPushSignature } from '../signature/verify';
import { PUSH_ACTION_COPY } from '../strings';
import { sendAnswer, settlesQuestion } from './answer';
import { responseKey } from './dedupe';
import type { HandledStore } from './handled-store';
import { intentFor, type PushIntent, type PushLink } from './intent';
import { fromResponse, type InboundEvent } from './parse';

/** Where the response took the person, and the line shown there. */
export type HandledOutcome = Readonly<{ route: string; toast?: string }>;

/** The session a response is handled in, read when it arrives. */
export type ResponseSession = Readonly<{
  /** The server this phone is signed in to or paired with (the push record's serverOrigin). */
  serverOrigin: string;
  /** The workspace the app acts in now (the foundation's workspaceIdStore.get). */
  workspaceId: () => string | null;
  /** The person's role there; null until the workspace is read. */
  role: () => WorkspaceRole | null;
}>;

export type HandlerDeps = Readonly<{
  session: ResponseSession;
  client: ApiClient;
  store: Pick<PushKeyStore, 'load'>;
  handled: Pick<HandledStore, 'claim'>;
  checks: StaleChecks;
  port: Pick<NotificationsPort, 'dismissNotificationAsync'>;
  sha256: Sha256;
  /** The phone's clock in epoch seconds (the signature's freshness window). */
  nowSeconds: () => number;
  /** Opens a route (expo-router's router.push, past an open sheet route: navigate.ts). */
  navigate: (route: string) => void;
  /** Shows a line (the foundation's Toast). */
  notify: (message: string) => void;
  /** After a reply settles its question: the caller refreshes needs-you and Questions. */
  refresh?: () => void;
}>;

/** What a signature check reads: this server's push record, the hash and the clock. */
export type VerifyDeps = Readonly<{
  session: Pick<ResponseSession, 'serverOrigin'>;
  store: Pick<PushKeyStore, 'load'>;
  sha256: Sha256;
  nowSeconds: () => number;
}>;

type Intent<K extends PushIntent['kind']> = Extract<PushIntent, { kind: K }>;

type ReadableEvent = Extract<InboundEvent, { kind: 'readable' }>;

const HOME: HandledOutcome = Object.freeze({ route: routes.home });

function kindOf(error: unknown): string {
  return isApiError(error) ? error.kind : 'unknown';
}

/** Navigates, then shows the line; neither failing stops the other or throws. */
function show(deps: HandlerDeps, outcome: HandledOutcome): HandledOutcome {
  try {
    deps.navigate(outcome.route);
  } catch {
    logger.warn('[push] could not open the screen of a notification');
  }
  try {
    if (outcome.toast) deps.notify(outcome.toast);
  } catch {
    logger.warn('[push] could not show the line of a notification');
  }
  return Object.freeze({ ...outcome });
}

function outcome(route: string, toast?: string): HandledOutcome {
  return Object.freeze(toast ? { route, toast } : { route });
}

/** Marked once now; false when it was handled before. A store that throws lets it through. */
function firstTime(handled: HandlerDeps['handled'], key: string): boolean {
  try {
    return handled.claim(key);
  } catch {
    logger.warn('[push] could not check whether a notification was handled');
    return true;
  }
}

/** The record's key when the record is this server's, else null (nothing verifies). */
async function pushKeyFor(deps: VerifyDeps): Promise<string | null> {
  let record: PushRecord | null;
  try {
    record = await deps.store.load();
  } catch {
    logger.warn('[push] the keychain refused the push record; the notification is unverified');
    return null;
  }
  return record && record.serverOrigin === deps.session.serverOrigin ? record.pushKey : null;
}

/** The payload's sig checks out with this server's push key, and it is fresh (also receive.ts's). */
export async function isVerified(payload: PushPayload | null, deps: VerifyDeps): Promise<boolean> {
  if (!payload) return false;
  const pushKey = await pushKeyFor(deps);
  return verifyPushSignature(payload, pushKey, deps.sha256, deps.nowSeconds());
}

async function markRead(deps: HandlerDeps, notificationId: string | undefined): Promise<void> {
  if (!notificationId) return;
  try {
    await markNotificationRead(deps.client, notificationId);
  } catch (error) {
    logger.debug('[push] could not mark a notification read', kindOf(error));
  }
}

async function dismiss(deps: HandlerDeps, identifier: string): Promise<void> {
  try {
    await deps.port.dismissNotificationAsync(identifier);
  } catch {
    logger.debug('[push] could not dismiss a notification');
  }
}

async function answer(
  intent: Intent<'answer'>,
  event: ReadableEvent,
  deps: HandlerDeps,
): Promise<HandledOutcome> {
  const verdict = await sendAnswer(deps.client, intent);
  const settled = settlesQuestion(verdict);
  if (settled) refreshAfterReply(deps);
  const shown = show(deps, outcome(routes.cc.questions, verdict.toast));
  if (settled) {
    await markRead(deps, intent.notificationId);
    await dismiss(deps, event.id);
  }
  return shown;
}

function refreshAfterReply(deps: HandlerDeps): void {
  try {
    deps.refresh?.();
  } catch {
    logger.warn('[push] could not refresh after a reply');
  }
}

async function open(intent: Intent<'open'>, deps: HandlerDeps): Promise<HandledOutcome> {
  const resolved = await resolveTarget(targetFor(intent.link), deps.checks);
  const shown = show(deps, outcome(resolved.route, resolved.notice));
  await markRead(deps, intent.notificationId);
  return shown;
}

/** The question's own screen (the Questions list), or home when the link names none. */
function questionRoute(link: PushLink | undefined): string {
  return link ? routeFor(targetFor(link)) : routes.cc.questions;
}

/** Nothing is sent: home, or the question with where to answer it, and a line that says why. */
export function neutralOutcome(
  intent: Intent<'neutral'>,
  role: WorkspaceRole | null,
): HandledOutcome {
  switch (intent.reason) {
    case 'unverified':
      return outcome(routes.home, PUSH_ACTION_COPY.unverified);
    case 'other_workspace':
      return outcome(routes.home, PUSH_ACTION_COPY.otherWorkspace);
    case 'cannot_answer':
      // a known role that may not answer is a viewer's; an unknown one may still answer there
      return outcome(
        questionRoute(intent.link),
        role ? ROLE_COPY.viewerReadOnly : PUSH_ACTION_COPY.answerHere,
      );
    case 'blank_reply':
      return outcome(questionRoute(intent.link), PUSH_ACTION_COPY.answerHere);
    case 'unknown':
      return HOME;
  }
}

async function act(event: ReadableEvent, deps: HandlerDeps): Promise<HandledOutcome> {
  const payload = parsePushData(event.data);
  const verified = await isVerified(payload, deps);
  const role = deps.session.role();
  const intent = intentFor({
    event,
    verified,
    payload,
    currentWorkspaceId: deps.session.workspaceId(),
    role,
  });
  logger.debug(
    '[push] notification action',
    intent.kind === 'neutral' ? intent.reason : intent.kind,
  );
  switch (intent.kind) {
    case 'answer':
      return answer(intent, event, deps);
    case 'open':
      return open(intent, deps);
    case 'neutral':
      return show(deps, neutralOutcome(intent, role));
  }
}

/** One response (a tap or an action on a notification) → its one outcome; null when seen before. */
export async function handleResponse(
  response: unknown,
  deps: HandlerDeps,
): Promise<HandledOutcome | null> {
  // read and claimed before the first await: a second delivery of it, however soon, finds the claim
  const event = fromResponse(response);
  if (event.kind === 'readable' && !firstTime(deps.handled, responseKey(event))) return null;
  try {
    if (event.kind !== 'readable') {
      logger.debug('[push] notification action', 'unreadable');
      return show(deps, outcome(routes.home, PUSH_ACTION_COPY.unverified));
    }
    return await act(event, deps);
  } catch (error) {
    logger.warn('[push] a notification action failed', kindOf(error));
    return show(deps, HOME);
  }
}
