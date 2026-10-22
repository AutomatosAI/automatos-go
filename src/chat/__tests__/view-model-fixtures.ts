// Shared by the view-model tests: a receipt, thread states built with the controller's own reducer
// from frames (as a live turn builds them), and readers for the rows they come to.

import type { Frame } from '../../core/ai-sdk-stream';
import type { Receipt } from '../../core/web/types';
import {
  createThread,
  threadReducer,
  type ThreadAction,
  type ThreadState,
} from '../controller/thread';
import type { StoredMessage } from '../schemas';
import type { AutoRow, ChatRow, Notice } from '../view-model';
import { AT, CHAT_ID } from './thread-fixtures';

export const WEB = 'https://studio.example.test';

export function receipt(overrides: Partial<Receipt>): Receipt {
  return {
    action: 'update_task',
    kind: 'write',
    status: 'done',
    subject: '#0425',
    effect: 'moved to Review',
    link: null,
    reason: null,
    ...overrides,
  };
}

export function apply(state: ThreadState, ...actions: ThreadAction[]): ThreadState {
  return actions.reduce(threadReducer, state);
}

export const frames = (...list: Frame[]): ThreadAction[] =>
  list.map((frame) => ({ type: 'frame', frame, at: AT }));

/** A chat with these saved messages, idle. */
export function opened(messages: readonly StoredMessage[] = []): ThreadState {
  return apply(createThread(CHAT_ID), {
    type: 'loaded',
    chatId: CHAT_ID,
    messages,
    turnInFlight: false,
  });
}

/** The user sent 'Status?' and these frames have arrived. */
export function streaming(...list: Frame[]): ThreadState {
  return apply(
    opened(),
    { type: 'send', draft: { text: 'Status?', files: [], sentAt: AT } },
    ...frames(...list),
  );
}

export function autoRows(rows: readonly ChatRow[]): AutoRow[] {
  return rows.filter((row): row is AutoRow => row.type === 'auto');
}

export function notices(rows: readonly ChatRow[]): Notice[] {
  return rows.flatMap((row) => {
    if (row.type === 'notice') return [row.notice];
    return row.type === 'auto' ? [...row.notices] : [];
  });
}

export const allText = (rows: readonly ChatRow[]) => JSON.stringify(rows);
