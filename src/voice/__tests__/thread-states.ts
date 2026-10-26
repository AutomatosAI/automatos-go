// A2's thread states for quick-ask's tests (US-019g): real stream lines parsed by the vendored
// parseLine and folded by A2's own threadReducer, so every state is one the chat controller really
// produces. Nothing touches the network.

import {
  createThread,
  threadReducer,
  type ThreadAction,
  type ThreadDraft,
  type ThreadState,
} from '../../chat/controller/thread';
import type { StoredMessage } from '../../chat/schemas';
import { parseLine } from '../../core/ai-sdk-stream';
import type { Receipt } from '../../core/web/types';

export const CHAT_ID = '0c5a9e1e-0000-4000-8000-00000000c0a6';
export const AT = '2026-10-24T08:30:00.000Z';

const data = (type: string, body: Record<string, unknown>) =>
  `d:${JSON.stringify({ type, ...body })}`;

/** One line of the AI SDK v1 data stream each, as the server writes them. */
export const wire = Object.freeze({
  chatId: (chatId: string) => data('chat-id', { chatId, ai_generated: true }),
  text: (text: string) => `0:${JSON.stringify(text)}`,
  narration: (text: string, retracted = false) => data('narration', { data: { text, retracted } }),
  toolStart: (toolCallId: string, toolName: string, input?: unknown) =>
    data('tool-start', { data: { toolCallId, toolName, input } }),
  toolEnd: (toolCallId: string, toolName: string, extra: Record<string, unknown> = {}) =>
    data('tool-end', { data: { toolCallId, toolName, success: true, ...extra } }),
  receipts: (receipts: readonly Receipt[], above?: readonly string[]) =>
    data('receipts', { data: above ? { receipts, above } : { receipts } }),
  agent: (name: string) => data('agent-info', { agent: { id: 7, name } }),
  withdraw: () =>
    data('withdraw_offer', {
      data: { message: 'Shall I give back the grant?', requests: [{ grant_id: 4 }] },
    }),
  taskCard: () =>
    data('tool-data', {
      data: {
        task_card: {
          id: 431,
          number: '#0431',
          title: 'Renew the domain',
          status: 'inbox',
          assigned_agent: 'Auto',
        },
      },
    }),
  error: (message: string, code?: string) => `e:${JSON.stringify({ message, code })}`,
  finish: data('finish', { finishReason: 'stop', ai_generated: true }),
});

export const RECEIPT: Receipt = Object.freeze({
  action: 'update_card',
  kind: 'write',
  status: 'done',
  subject: '#0422',
  effect: 'moved to Done',
  link: null,
  reason: null,
}) as Receipt;

export function frames(...lines: readonly string[]): ThreadAction[] {
  return lines.map((line) => ({ type: 'frame', frame: parseLine(line), at: AT }));
}

export function run(state: ThreadState, ...actions: readonly ThreadAction[]): ThreadState {
  return actions.reduce(threadReducer, state);
}

export function saved(
  id: string,
  role: 'user' | 'assistant',
  text: string,
  extra: Partial<StoredMessage> = {},
): StoredMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text }],
    attachments: [],
    source: null,
    createdAt: AT,
    ...extra,
  };
}

/** The voice screen's conversation, opened on its saved messages. */
export function opened(messages: readonly StoredMessage[] = []): ThreadState {
  return run(createThread(CHAT_ID), {
    type: 'loaded',
    chatId: CHAT_ID,
    messages,
    turnInFlight: false,
  });
}

export function draft(text: string): ThreadDraft {
  return { text, files: [], sentAt: AT };
}

/** use-thread.ts's send: the runner dispatches 'send' with the draft it built. */
export function sent(state: ThreadState, turn: ThreadDraft): ThreadState {
  return run(state, { type: 'send', draft: turn });
}
