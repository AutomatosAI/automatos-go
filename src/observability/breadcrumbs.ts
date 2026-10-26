// The crash-report breadcrumb rule (R01, KR7): Sentry's beforeBreadcrumb, and scrubEvent() for the
// native breadcrumbs merged into a JS event. A breadcrumb that could carry what the user wrote,
// read or tapped is dropped whole: console lines, touches, clicks, input, navigation (screen
// names), and any breadcrumb whose data names a field the app's chat, push and voice traffic uses
// for content or secrets (chat text and bodies, push payloads and keys, call and chat ids, tokens,
// prompts). An HTTP breadcrumb keeps only its method, its path template and its status code. Any
// other keeps its message through redactText() and its data's single-word values only.

import type { Breadcrumb } from '@sentry/react-native';

import { reducePath } from './paths';
import { redactText } from './redact';
import { isRecord, nonEmpty, present, type Fields } from './values';

/** Categories never sent: what was typed, tapped or logged, and where the user went. */
export const DROPPED_CATEGORIES: ReadonlySet<string> = new Set([
  'console',
  'touch',
  'ui.click',
  'ui.input',
  'navigation',
]);

/**
 * Data keys that mean content or a secret (chat request parts and SSE frames carry text; the push
 * payload carries question, options and sig; registration carries push_key; Auto Live's mint
 * answer carries call_id and access_token; ChatRequest carries message and the chat id). Matched
 * at any depth, ignoring case.
 */
export const SENSITIVE_DATA_KEYS: ReadonlySet<string> = new Set([
  'text',
  'body',
  'question',
  'answer',
  'message',
  'payload',
  'call_id',
  'chat_id',
  'token',
  'push_key',
  'sig',
  'prompt',
]);

/** The JS SDK's fetch and xhr breadcrumbs, and the native SDKs' 'http' ones (URLSession, OkHttp). */
export const HTTP_CATEGORIES: ReadonlySet<string> = new Set(['xhr', 'fetch', 'http']);

const HTTP_METHOD = /^[A-Z]{3,7}$/;
/** A data value kept on an ordinary breadcrumb: one word or identifier, never free text or a URL. */
const SINGLE_WORD = /^[\w.:-]{1,64}$/;
/** Deeper than this, a breadcrumb's data is not the SDK's: it is dropped as if sensitive. */
const MAX_DATA_DEPTH = 4;

function hasSensitiveKey(value: unknown, depth = 0): boolean {
  if (depth > MAX_DATA_DEPTH) return true;
  if (Array.isArray(value)) return value.some((item) => hasSensitiveKey(item, depth + 1));
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, nested]) =>
      SENSITIVE_DATA_KEYS.has(key.toLowerCase()) || hasSensitiveKey(nested, depth + 1),
  );
}

function httpData(data: Fields): Record<string, unknown> | undefined {
  const { method, url, status_code: status } = data;
  return nonEmpty({
    ...present(
      'method',
      typeof method === 'string' && HTTP_METHOD.test(method) ? method : undefined,
    ),
    ...present('url', typeof url === 'string' ? reducePath(url) : undefined),
    ...present(
      'status_code',
      typeof status === 'number' && Number.isInteger(status) ? status : undefined,
    ),
  });
}

function wordValue(value: unknown): unknown {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || !SINGLE_WORD.test(value)) return undefined;
  return redactText(value);
}

function wordData(data: Fields): Record<string, unknown> | undefined {
  const kept = Object.entries(data)
    .map(([key, value]) => [key, wordValue(value)] as const)
    .filter(([, value]) => value !== undefined);
  return nonEmpty(Object.fromEntries(kept));
}

function scrubData(
  category: string | undefined,
  data: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(data)) return undefined;
  return category !== undefined && HTTP_CATEGORIES.has(category) ? httpData(data) : wordData(data);
}

/** The breadcrumb as it may leave the phone (a new object), or null when it must not. */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  const { category } = crumb;
  if (category !== undefined && DROPPED_CATEGORIES.has(category)) return null;
  if (hasSensitiveKey(crumb.data)) return null;
  return {
    ...present('type', crumb.type),
    ...present('level', crumb.level),
    ...present('event_id', crumb.event_id),
    ...present('category', category),
    ...present('timestamp', crumb.timestamp),
    ...present(
      'message',
      typeof crumb.message === 'string' ? redactText(crumb.message) : undefined,
    ),
    ...present('data', scrubData(category, crumb.data)),
  };
}

/** Every breadcrumb that may leave the phone, scrubbed, in order. */
export function scrubBreadcrumbs(crumbs: readonly Breadcrumb[]): Breadcrumb[] {
  return crumbs.map(scrubBreadcrumb).filter((crumb): crumb is Breadcrumb => crumb !== null);
}
