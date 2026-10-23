// Fixtures for the chat controller's tests: saved messages, stream lines, a client over a fake
// transport that answers by route, a body whose chunks the test hands over one at a time, a
// store that folds dispatched actions through threadReducer, and the saved list's answers as
// use-thread.ts opens a chat on them. Nothing touches the network.

import {
  SERVER,
  fakeTransport,
  reply,
  type FakeTransport,
} from '../../api/__tests__/fake-transport';
import { createApiClient } from '../../api/client';
import type { StreamingResponse, TransportRequest } from '../../api/transport-types';
import {
  loadedAction,
  openingList,
  threadReducer,
  type ThreadAction,
  type ThreadState,
} from '../controller/thread';
import type { ChatThread, StoredMessage } from '../schemas';

export const CHAT_ID = '0c5a9e1e-0000-4000-8000-00000000c001';
export const OTHER_CHAT_ID = '0c5a9e1e-0000-4000-8000-00000000c002';
export const WORKSPACE_ID = '7f1c2a54-0000-4000-8000-000000000001';
export const API = 'https://api.example.test';
export const AT = '2026-10-21T08:30:00.000Z';

export function saved(id: string, role: 'user' | 'assistant', text: string): StoredMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text }],
    attachments: [],
    source: null,
    createdAt: AT,
  };
}

/** One line of the AI SDK v1 data stream each. */
export const line = Object.freeze({
  chatId: (chatId: string) =>
    `d:${JSON.stringify({ type: 'chat-id', chatId, ai_generated: true })}\n`,
  text: (text: string) => `0:${JSON.stringify(text)}\n`,
  toolStart: (toolCallId: string, toolName: string) =>
    `d:${JSON.stringify({ type: 'tool-start', data: { toolCallId, toolName } })}\n`,
  error: (message: string, code?: string) => `e:${JSON.stringify({ message, code })}\n`,
  finish: `d:${JSON.stringify({ type: 'finish', finishReason: 'stop', ai_generated: true })}\n`,
});

type Answer = (request: TransportRequest) => StreamingResponse | Promise<StreamingResponse>;

/** Answers `METHOD /path` from the table; anything else is a 404. */
export function routedTransport(table: Readonly<Record<string, Answer>>): FakeTransport {
  return fakeTransport((request) => {
    const answer = table[`${request.method} ${new URL(request.url).pathname}`];
    return answer ? answer(request) : reply(404, JSON.stringify({ detail: 'Not Found' }));
  });
}

export function clientWith(transport: FakeTransport) {
  return createApiClient({
    server: SERVER,
    getToken: async () => 'jwt.token.value',
    getWorkspaceId: () => WORKSPACE_ID,
    transport,
  });
}

export function callsTo(transport: FakeTransport, method: string, path: string) {
  return transport.calls.filter(
    (call) => call.method === method && new URL(call.url).pathname === path,
  );
}

export type GatedReply = StreamingResponse & {
  readonly push: (chunk: string) => void;
  readonly end: () => void;
};

/** A streaming body that yields each chunk only when the test pushes it. */
export function gatedReply(): GatedReply {
  const queue: string[] = [];
  let ended = false;
  let wake: (() => void) | null = null;
  const nudge = () => {
    wake?.();
    wake = null;
  };
  async function* chunks(): AsyncGenerator<string> {
    for (;;) {
      const next = queue.shift();
      if (next !== undefined) yield next;
      else if (ended) return;
      else await new Promise<void>((resolve) => (wake = resolve));
    }
  }
  return {
    status: 200,
    text: async () => '',
    chunks,
    push: (chunk) => {
      queue.push(chunk);
      nudge();
    },
    end: () => {
      ended = true;
      nudge();
    },
  };
}

/** Folds every dispatched action through threadReducer, keeping each action for the test. */
export function store(initial: ThreadState) {
  let state = initial;
  const actions: ThreadAction[] = [];
  return {
    dispatch: (action: ThreadAction) => {
      actions.push(action);
      state = threadReducer(state, action);
    },
    state: () => state,
    actions,
    types: () => actions.map((action) => action.type),
  };
}

/** GET /api/chat/{CHAT_ID}'s answer this visit: a turn is running on the server. */
export const IN_FLIGHT: ChatThread = {
  id: CHAT_ID,
  title: null,
  createdAt: AT,
  updatedAt: AT,
  kind: 'user',
  turnInFlight: true,
};

/** The saved-list query as useQuery reports it: fetched this visit, or still only the cached one. */
export function savedList(isFetchedAfterMount: boolean, data: readonly StoredMessage[]) {
  return { isFetchedAfterMount, isSuccess: true, data };
}

/** use-thread.ts with one answer of the saved list: `loaded` while loading, then `refetched`. */
export function answerSaved(state: ThreadState, list: ReturnType<typeof savedList>): ThreadState {
  const opening = state.status === 'loading' ? loadedAction(IN_FLIGHT, openingList(list)) : null;
  const refetched: ThreadAction = { type: 'refetched', messages: list.data };
  return [...(opening ? [opening] : []), refetched].reduce(threadReducer, state);
}

/** Lets pending reads, writes and timers run (a few turns of the event loop). */
export async function settle(rounds = 5): Promise<void> {
  for (let round = 0; round < rounds; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** Freezes the value and everything it holds, so any mutation throws (ES modules are strict). */
export function deepFreeze<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    Object.freeze(value);
    Object.values(value).forEach((nested) => deepFreeze(nested, seen));
  }
  return value;
}
