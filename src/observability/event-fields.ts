// The allowlists scrubEvent() reads for an event's contexts, extra, tags and request (R01, R02,
// KR7). Each kept context keeps only the named fields, each string through redactText(): the
// build, the OS and the device model, never the device's name, its id, its owner's time zone, its
// boot time or its disk space (Apple's required-reason APIs: boot time and disk space read for
// those reasons may not leave the device). Pure.

import type { Event } from '@sentry/react-native';

import { LAYOUTS } from '../styles/registry/style-id';
import { reducePath } from './paths';
import { redactText } from './redact';
import {
  isRecord,
  nonEmpty,
  pickPrimitives,
  present,
  redactPrimitives,
  type Fields,
} from './values';

/** This app's own context (US-021c): every primitive it sets, each string redacted. */
const OWN_CONTEXT = 'release';

/** Each context kept, and its fields: the device, OS, runtime and app facts, and 'release'. */
export const KEPT_CONTEXT_FIELDS: Readonly<Record<string, readonly string[] | typeof OWN_CONTEXT>> =
  Object.freeze({
    app: Object.freeze([
      'app_identifier',
      'app_name',
      'app_version',
      'app_build',
      'app_start_time',
      'build_type',
      'in_foreground',
      'app_memory',
      'start_type',
    ]),
    device: Object.freeze([
      'family',
      'model',
      'model_id',
      'arch',
      'simulator',
      'manufacturer',
      'brand',
      'memory_size',
      'free_memory',
      'usable_memory',
      'low_memory',
      'processor_count',
      'cpu_description',
      'battery_level',
      'charging',
      'orientation',
      'screen_density',
      'screen_dpi',
      'screen_width_pixels',
      'screen_height_pixels',
      'locale',
      'online',
      'thermal_state',
    ]),
    os: Object.freeze(['name', 'version', 'build', 'kernel_version', 'rooted', 'theme']),
    runtime: Object.freeze(['name', 'version', 'raw_description']),
    release: OWN_CONTEXT,
  });

/** Each kept tag and the only values it may have (KR7: platform, channel, edition, style). */
export const KEPT_TAGS: Readonly<Record<string, (value: unknown) => boolean>> = Object.freeze({
  platform: (value: unknown) => value === 'ios' || value === 'android',
  channel: (value: unknown) =>
    typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,31}$/.test(value),
  edition: (value: unknown) => value === 'hosted' || value === 'own',
  style: (value: unknown) => (LAYOUTS as readonly unknown[]).includes(value),
});

/** Request headers kept (compared ignoring case): none of them names a person or a credential. */
export const KEPT_HEADERS: ReadonlySet<string> = new Set([
  'accept',
  'content-type',
  'content-length',
]);

function redactedFields(source: Fields, keys: readonly string[]): Record<string, unknown> {
  return redactPrimitives(pickPrimitives(source, keys));
}

function scrubContext(name: string, context: Fields): Record<string, unknown> {
  const fields = KEPT_CONTEXT_FIELDS[name];
  return fields === OWN_CONTEXT ? redactPrimitives(context) : redactedFields(context, fields);
}

/** The kept contexts (or extras: held to the same names), each reduced to its kept fields. */
export function scrubContexts(
  contexts: unknown,
): Record<string, Record<string, unknown>> | undefined {
  if (!isRecord(contexts)) return undefined;
  const kept = Object.keys(KEPT_CONTEXT_FIELDS)
    .filter((name) => isRecord(contexts[name]))
    .map((name) => [name, scrubContext(name, contexts[name] as Fields)] as const)
    .filter(([, fields]) => Object.keys(fields).length > 0);
  return nonEmpty(Object.fromEntries(kept));
}

export function scrubTags(tags: unknown): Record<string, string> | undefined {
  if (!isRecord(tags)) return undefined;
  const kept = Object.entries(KEPT_TAGS).filter(([name, allowed]) => allowed(tags[name]));
  return nonEmpty(Object.fromEntries(kept.map(([name]) => [name, tags[name] as string])));
}

function scrubHeaders(headers: unknown): Record<string, string> | undefined {
  if (!isRecord(headers)) return undefined;
  const kept = Object.entries(headers).filter(
    ([name, value]) => KEPT_HEADERS.has(name.toLowerCase()) && typeof value === 'string',
  );
  return nonEmpty(
    Object.fromEntries(kept.map(([name, value]) => [name, redactText(value as string)])),
  );
}

/** The request's method, its path template and the kept headers; never its body, query or env. */
export function scrubRequest(request: Event['request']): Event['request'] {
  if (!isRecord(request)) return undefined;
  const { method, url } = request;
  return nonEmpty({
    ...present('method', typeof method === 'string' ? method.slice(0, 16) : undefined),
    ...present('url', typeof url === 'string' ? reducePath(url) : undefined),
    ...present('headers', scrubHeaders(request.headers)),
  });
}
