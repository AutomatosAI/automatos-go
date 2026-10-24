// Shared fixtures of the action handler's tests (handler.test.ts, handler-logging.test.ts): v2
// payloads signed here with node:crypto under this phone's push key, the response expo-notifications
// hands over for each, the push record, a server that answers each route from a script over the
// foundation's fake transport, and fakes for the port, the router, the Toast and MMKV.

import { createHash, createHmac } from 'node:crypto';

import type { StreamingResponse } from '../../api/transport-types';
import { jsonReply } from '../../api/__tests__/fake-transport';
import type { WorkspaceRole } from '../../api/workspace';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { handledStoreOver } from '../inbound/handled-store';
import type { HandlerDeps } from '../inbound/handler';
import type { ResponsesPort } from '../inbound/responses';
import type { StaleChecks } from '../links/stale';
import type { PushRecord } from '../registration/record';
import { signedMessage, type SignedFields } from '../signature/canonical';
import type { Sha256 } from '../signature/hmac';
import { DEVICE_ID, NOTIFICATION_ID, WS, harness, sent } from './data-fixtures';
import { IOS_ID } from './inbound-fixtures';

export const ORIGIN = 'https://api.example.test';
export const PHONE_KEY = `minted-${'p'.repeat(36)}`;
export const OTHER_KEY = `minted-${'q'.repeat(36)}`;
export const EXPO_TOKEN = 'ExponentPushToken[handlertesttoken0000001]';
export const NOW_S = 1_792_540_800;
export const ANSWER_PATH = '/api/v1/approval-grants/42/answer';
export const READ_PATH = `/api/notifications/${NOTIFICATION_ID}/read`;
export const REPLY_TEXT = 'Yes, ship it';

type Fields = SignedFields & { readonly v: number };

export const QUESTION_FIELDS: Fields = Object.freeze({
  v: 2,
  type: 'needs_answer',
  workspace_id: WS,
  notification_id: NOTIFICATION_ID,
  grant_id: '42',
  link_type: 'question',
  link_id: '42',
  ticket_number: '#0419',
  question: 'Ship the Lisbon deck?',
  options: ['Yes', 'No', 'Later'],
  iat: NOW_S,
});

export const REVIEW_FIELDS: Fields = Object.freeze({
  v: 2,
  type: 'review',
  workspace_id: WS,
  notification_id: NOTIFICATION_ID,
  link_type: 'task',
  link_id: '8812',
  ticket_number: '#0419',
  iat: NOW_S,
});

export const nodeSha256: Sha256 = async (bytes) =>
  new Uint8Array(createHash('sha256').update(bytes).digest());

/** The fields with their sig: HMAC-SHA256 of the canonical v2 message under key, as W2 signs. */
export function signed(fields: Fields, key: string = PHONE_KEY) {
  const sig = createHmac('sha256', Buffer.from(key, 'utf8'))
    .update(signedMessage(fields), 'utf8')
    .digest('hex');
  return { ...fields, sig };
}

export type ResponseOptions = {
  readonly userText?: string;
  readonly identifier?: string;
  readonly title?: string;
  readonly body?: string;
};

/** A response as expo-notifications 0.32.17 hands it over on iOS. */
export function response(data: unknown, actionIdentifier: string, options: ResponseOptions = {}) {
  return {
    notification: {
      date: 1792540800.5,
      request: {
        identifier: options.identifier ?? IOS_ID,
        content: {
          title: options.title ?? 'Auto needs an answer',
          body: options.body ?? 'Ship the Lisbon deck?',
          data,
          categoryIdentifier: 'automatos.question.3',
        },
        trigger: { type: 'push' },
      },
    },
    actionIdentifier,
    ...(options.userText === undefined ? {} : { userText: options.userText }),
  };
}

export function phoneRecord(overrides: Partial<PushRecord> = {}): PushRecord {
  return {
    serverOrigin: ORIGIN,
    workspaceId: WS,
    deviceId: DEVICE_ID,
    pushKey: PHONE_KEY,
    expoToken: EXPO_TOKEN,
    fingerprint: '["fingerprint"]',
    registeredAt: NOW_S * 1000,
    switchedOff: false,
    ...overrides,
  };
}

export function grantAnswer(status: string, answerText: string | null) {
  return {
    grant: {
      id: 42,
      workspace_id: WS,
      status,
      kind: 'question',
      question_md: 'Ship the Lisbon deck?',
      options: ['Yes', 'No', 'Later'],
      answer_text: answerText,
    },
  };
}

type Answer = () => StreamingResponse | Promise<StreamingResponse>;

/** `${method} ${path}` → its answer; anything else answers 404. */
export type Script = Readonly<Record<string, Answer>>;

export const answeredWith =
  (words: string): Answer =>
  () =>
    jsonReply(200, grantAnswer('granted', words));
export const refusedWith =
  (status: number, detail: string): Answer =>
  () =>
    jsonReply(status, { detail });
export const offline: Answer = () => {
  throw new TypeError('Network request failed');
};
export const readOk: Answer = () => jsonReply(200, { success: true });

/** MMKV in memory, with what was written. */
export function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & {
  readonly items: Map<string, string>;
} {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

export const OPEN_CHECKS: StaleChecks = Object.freeze({
  pendingQuestionIds: async () => ['42'],
  getTicket: async () => ({ id: 8812, status: 'review' }),
  getSocialPost: async () => ({ status: 'needs_approval' }),
  getChat: async () => ({ id: 'chat' }),
});

export type WorldOptions = {
  readonly script?: Script;
  readonly record?: PushRecord | null;
  readonly loadFails?: boolean;
  readonly role?: WorkspaceRole | null;
  readonly workspaceId?: string | null;
  readonly checks?: Partial<StaleChecks>;
  readonly storage?: KeyValueStorage;
  readonly navigateFails?: boolean;
};

/** The handler's deps over fakes, and what they saw. */
export function world(options: WorldOptions = {}) {
  const script: Script = { [`POST ${READ_PATH}`]: readOk, ...options.script };
  const api = harness((request) => {
    const answer = script[`${request.method} ${new URL(request.url).pathname}`];
    return answer ? answer() : jsonReply(404, { detail: 'Not Found' });
  });
  const seen = { routes: [] as string[], toasts: [] as string[], dismissed: [] as string[] };
  let refreshes = 0;
  const record = options.record === undefined ? phoneRecord() : options.record;
  const deps: HandlerDeps = {
    session: {
      serverOrigin: ORIGIN,
      workspaceId: () => (options.workspaceId === undefined ? WS : options.workspaceId),
      role: () => (options.role === undefined ? 'editor' : options.role),
    },
    client: api.client,
    store: {
      load: async () => {
        if (options.loadFails) throw new Error('the keychain is locked');
        return record;
      },
    },
    handled: handledStoreOver(options.storage ?? memoryStorage()),
    checks: { ...OPEN_CHECKS, ...options.checks },
    port: { dismissNotificationAsync: async (id) => void seen.dismissed.push(id) },
    sha256: nodeSha256,
    nowSeconds: () => NOW_S,
    navigate: (route) => {
      if (options.navigateFails) throw new Error('no navigator yet');
      seen.routes.push(route);
    },
    notify: (message) => void seen.toasts.push(message),
    refresh: () => {
      refreshes += 1;
    },
  };
  return {
    deps,
    seen,
    refreshes: () => refreshes,
    requests: () => api.calls.map((call) => sent(call)),
  };
}

/** A fake response port: the cold start's response, a recorded clear, one listener to fire. */
export function responsesPort(last: unknown) {
  const calls: string[] = [];
  let listener: ((response: unknown) => void) | null = null;
  const port: ResponsesPort = {
    getLastNotificationResponse: () => {
      calls.push('getLast');
      return last;
    },
    clearLastNotificationResponse: () => void calls.push('clearLast'),
    addNotificationResponseReceivedListener: (next) => {
      calls.push('listen');
      listener = next;
      return {
        remove: () => {
          calls.push('remove');
          listener = null;
        },
      };
    },
    dismissNotificationAsync: async () => undefined,
  };
  return {
    port,
    calls,
    fire: (next: unknown) => {
      if (!listener) throw new Error('nothing is listening');
      listener(next);
    },
  };
}

/** Lets every pending promise settle (the listener's handling is not awaited by the port). */
export async function settle(): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}
