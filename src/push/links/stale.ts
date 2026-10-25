// The stale check before a push's screen opens (PRD-001 §4.8, KP9, D-STALE-CHAT). A signed link is
// authentic (KP6) but can be old: the question answered, the ticket deleted, the post approved, the
// chat gone. Each record is asked for again with the person's own credentials: gone → a plain
// notice and a fallback screen; there → its own screen. Only an answer that the record is gone
// decides: a network failure, a timeout (STALE_CHECK_TIMEOUT_MS) or any other refusal (a 403 on the
// questions list: owner/admin only until W1 US-006a deploys) opens the target with no notice, and
// its screen shows its own state. A chat's 403 is the one decisive refusal: another person's chat
// id would silently start a new chat (D-STALE-CHAT). The checks are a port (staleChecksFor binds
// the push API); nothing here retries or caches, and the log carries kinds only.

import type { ApiClient } from '../../api/client';
import { isApiError } from '../../api/errors';
import { logger } from '../../lib/logger';
import { routes } from '../../navigation/routes';
import { getChat, getSocialPost, getTicket, pendingQuestionIds } from '../api';
import { SOCIAL_NEEDS_APPROVAL_STATUS, STALE_CHECK_TIMEOUT_MS } from '../config';
import type { SocialPostCheck } from '../schemas/server';
import { PUSH_LINK_COPY } from '../strings';
import { routeFor, type LinkTarget, type RecordKind } from './targets';

/** One question per record kind, each given the signal the timeout aborts. */
export type StaleChecks = Readonly<{
  pendingQuestionIds: (signal: AbortSignal) => Promise<readonly string[]>;
  getTicket: (taskId: string, signal: AbortSignal) => Promise<unknown>;
  getSocialPost: (postId: string, signal: AbortSignal) => Promise<Pick<SocialPostCheck, 'status'>>;
  getChat: (chatId: string, signal: AbortSignal) => Promise<unknown>;
}>;

/** Where to go, and the line to show there when the push's record has moved on. */
export type ResolvedLink = Readonly<{ route: string; notice?: string }>;

type Failure = 'not_found' | 'forbidden' | 'unknown';

type Probe<T> = Readonly<{ found: T }> | Readonly<{ failed: Failure }>;

type Resolver = (id: string, route: string, check: Checker) => Promise<ResolvedLink>;

type Checker = <T>(run: (signal: AbortSignal) => Promise<T>) => Promise<Probe<T>>;

const UNANSWERED: Probe<never> = Object.freeze({ failed: 'unknown' });

function failureOf(error: unknown): Failure {
  if (isApiError(error) && (error.kind === 'not_found' || error.kind === 'forbidden')) {
    return error.kind;
  }
  return 'unknown';
}

/** The check's answer, or 'unknown' when it fails otherwise or does not answer in time. */
async function probe<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<Probe<T>> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<Probe<T>>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(UNANSWERED);
    }, timeoutMs);
  });
  const answered = Promise.resolve()
    .then(() => run(controller.signal))
    .then(
      (found): Probe<T> => Object.freeze({ found }),
      (error: unknown): Probe<T> => Object.freeze({ failed: failureOf(error) }),
    );
  try {
    return await Promise.race([answered, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

function opened(route: string): ResolvedLink {
  return Object.freeze({ route });
}

function moved(route: string, notice: string): ResolvedLink {
  return Object.freeze({ route, notice });
}

function failed(probed: Probe<unknown>): Failure | null {
  return 'failed' in probed ? probed.failed : null;
}

function resolvers(checks: StaleChecks): Readonly<Record<RecordKind, Resolver>> {
  return {
    question: async (id, route, check) => {
      const probed = await check((signal) => checks.pendingQuestionIds(signal));
      if (!('found' in probed) || probed.found.includes(id)) return opened(route);
      return moved(route, PUSH_LINK_COPY.questionGone);
    },
    ticket: async (id, route, check) => {
      const probed = await check((signal) => checks.getTicket(id, signal));
      if (failed(probed) === 'not_found') return moved(routes.cc.board, PUSH_LINK_COPY.ticketGone);
      return opened(route);
    },
    social: async (id, route, check) => {
      const probed = await check((signal) => checks.getSocialPost(id, signal));
      const waiting = 'found' in probed && probed.found.status === SOCIAL_NEEDS_APPROVAL_STATUS;
      const gone = 'found' in probed ? !waiting : probed.failed === 'not_found';
      return gone ? moved(routes.home, PUSH_LINK_COPY.postGone) : opened(route);
    },
    chat: async (id, route, check) => {
      const failure = failed(await check((signal) => checks.getChat(id, signal)));
      if (failure === 'not_found' || failure === 'forbidden') {
        return moved(routes.home, PUSH_LINK_COPY.chatGone);
      }
      return opened(route);
    },
  };
}

/** The screen a push's target opens on now, checked first; home needs no check. */
export async function resolveTarget(
  target: LinkTarget,
  checks: StaleChecks,
  timeoutMs: number = STALE_CHECK_TIMEOUT_MS,
): Promise<ResolvedLink> {
  const route = routeFor(target);
  if (target.kind === 'home') return opened(route);
  const check: Checker = async (run) => {
    const probed = await probe(run, timeoutMs);
    const failure = failed(probed);
    if (failure) logger.debug('[push] link check', target.kind, failure);
    return probed;
  };
  return resolvers(checks)[target.kind](target.id, route, check);
}

/** The stale checks over the push API and the one client. */
export function staleChecksFor(client: ApiClient): StaleChecks {
  return Object.freeze({
    pendingQuestionIds: (signal: AbortSignal) => pendingQuestionIds(client, signal),
    getTicket: (taskId: string, signal: AbortSignal) => getTicket(client, taskId, signal),
    getSocialPost: (postId: string, signal: AbortSignal) => getSocialPost(client, postId, signal),
    getChat: (chatId: string, signal: AbortSignal) => getChat(client, chatId, signal),
  });
}
