// Runs a thread's turns over the foundation's stream (D-STOP): send reads one turn and dispatches
// each frame to threadReducer, then finished or failed. The turn is a detached producer on the
// server (services/chat_turns.py): closing the read only marks the client gone and the reply is
// still saved. So Stop is two things: the read is aborted AND POST /api/chat/{id}/cancel is sent.
// A draft's turn is named only by its chat-id frame: Stop before that frame keeps reading, out of
// sight, until it arrives, then aborts and cancels. release() lets go of the read without a cancel
// (leaving the screen, a new chat): the reply is saved and chat_changed announces it. Only the
// current run's frames reach the thread, so a late frame of a run let go of reaches nobody.
// No React: use-thread.ts creates one per screen.

import type { ApiClient } from '../../api/client';
import type { Frame } from '../../core/ai-sdk-stream';
import { logger } from '../../lib/logger';
import { cancelTurn, sendTurn } from '../api';
import type { ChatRequestBody } from '../request';
import type { ThreadAction, ThreadDraft } from './thread';

export type TurnRunnerOptions = {
  readonly client: ApiClient;
  readonly dispatch: (action: ThreadAction) => void;
  /** The time a frame arrives (ISO), stamped on tool calls. */
  readonly now?: () => string;
};

export type TurnRunner = {
  /** Streams one turn; resolves once it has finished, failed, stopped or been let go of. */
  readonly send: (body: ChatRequestBody, draft: ThreadDraft) => Promise<void>;
  /** Stop: the read ends and the server is told to cancel (`chatId`: the screen's, when no read runs). */
  readonly stop: (chatId: string | null) => Promise<void>;
  /** Lets go of the read without cancelling the turn. */
  readonly release: () => void;
};

/** One read; its controller is its identity. chatId: the body's, or the one its chat-id frame names. */
type Run = { readonly controller: AbortController; readonly chatId: string | null };

/** Which read is the thread's, and which stopped drafts read on until their chat-id frame. */
type Runs = {
  readonly isCurrent: (controller: AbortController) => boolean;
  readonly start: (run: Run) => boolean;
  readonly rename: (controller: AbortController, chatId: string) => void;
  /** Stop or release: the current read is no longer the thread's. */
  readonly take: () => Run | null;
  readonly park: (controller: AbortController) => void;
  /** true when this read was parked (and is no longer). */
  readonly unpark: (controller: AbortController) => boolean;
  readonly end: (controller: AbortController) => void;
};

function createRuns(): Runs {
  let current: Run | null = null;
  let stopping: readonly AbortController[] = [];
  const isCurrent = (controller: AbortController) => current?.controller === controller;
  const unpark = (controller: AbortController) => {
    const parked = stopping.includes(controller);
    stopping = stopping.filter((entry) => entry !== controller);
    return parked;
  };
  return Object.freeze({
    isCurrent,
    start: (run: Run) => {
      if (current) return false;
      current = run;
      return true;
    },
    rename: (controller: AbortController, chatId: string) => {
      if (current && isCurrent(controller)) current = { ...current, chatId };
    },
    take: () => {
      const run = current;
      current = null;
      return run;
    },
    park: (controller: AbortController) => {
      stopping = [...stopping, controller];
    },
    unpark,
    end: (controller: AbortController) => {
      if (isCurrent(controller)) current = null;
      unpark(controller);
    },
  });
}

type Deps = {
  readonly client: ApiClient;
  readonly dispatch: (action: ThreadAction) => void;
  readonly now: () => string;
  readonly runs: Runs;
};

const isoNow = (): string => new Date().toISOString();

async function cancel({ client, dispatch }: Deps, chatId: string): Promise<void> {
  try {
    await cancelTurn(client, chatId);
  } catch (error) {
    logger.warn('[chat] Stop did not reach the server; the turn is still running', error);
    dispatch({ type: 'stopFailed', error });
  }
}

/** The thread's read: every frame reaches it. A parked one: only its chat-id frame, to cancel it. */
function onFrame(deps: Deps, controller: AbortController, frame: Frame): void {
  if (deps.runs.isCurrent(controller)) {
    if (frame.kind === 'chat-id') deps.runs.rename(controller, frame.chatId);
    deps.dispatch({ type: 'frame', frame, at: deps.now() });
  } else if (frame.kind === 'chat-id' && deps.runs.unpark(controller)) {
    controller.abort();
    deps.dispatch({ type: 'named', chatId: frame.chatId });
    void cancel(deps, frame.chatId);
  }
}

async function read(deps: Deps, controller: AbortController, body: ChatRequestBody): Promise<void> {
  const { client, dispatch, runs } = deps;
  try {
    const outcome = await sendTurn(
      client,
      body,
      (f) => onFrame(deps, controller, f),
      controller.signal,
    );
    if (outcome === 'complete' && runs.isCurrent(controller)) dispatch({ type: 'finished' });
  } catch (error) {
    if (runs.isCurrent(controller)) dispatch({ type: 'failed', error });
    else logger.debug('[chat] a turn this screen let go of ended with an error', error);
  } finally {
    runs.end(controller);
  }
}

async function stop(deps: Deps, chatId: string | null): Promise<void> {
  deps.dispatch({ type: 'stopped', at: deps.now() });
  const run = deps.runs.take();
  const target = run ? run.chatId : chatId;
  if (run && !target) {
    deps.runs.park(run.controller); // onFrame cancels it once its chat-id frame names the chat
    return;
  }
  run?.controller.abort();
  if (target) await cancel(deps, target);
}

export function createTurnRunner({
  client,
  dispatch,
  now = isoNow,
}: TurnRunnerOptions): TurnRunner {
  const deps: Deps = { client, dispatch, now, runs: createRuns() };
  return Object.freeze({
    send: async (body: ChatRequestBody, draft: ThreadDraft) => {
      const controller = new AbortController();
      // one turn at a time: the thread refuses a second send as well
      if (!deps.runs.start({ controller, chatId: body.id ?? null })) return;
      dispatch({ type: 'send', draft });
      await read(deps, controller, body);
    },
    stop: (chatId: string | null) => stop(deps, chatId),
    release: () => deps.runs.take()?.controller.abort(),
  });
}
