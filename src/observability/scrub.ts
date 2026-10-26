// What a crash report may carry when it leaves the phone (R01, R02; D44; KR7): Sentry's beforeSend.
// scrubEvent() builds a NEW event from allowlists, so a field the SDK adds later is dropped until
// someone decides it is safe. Kept, because a crash must stay debuggable: the exception's type, its
// stack frames (function, file, line, column), the level, release, dist and environment, the SDK's
// name and the bundle's debug ids, and the device, OS, runtime and app facts. Removed: the user
// (no id, email, username or IP: R02), the request's body, cookies, query and env, every header
// but three harmless ones (never Authorization, Cookie or X-Workspace-ID), every extra, context
// and tag the allowlists do not name (a push payload, a call or chat id), the transaction (a
// screen name), frame variables and source lines. The message, every exception value and every
// kept breadcrumb's message pass redactText(); every URL becomes a path template.
// Pure: type-only Sentry imports.

import type { Breadcrumb, Event, Exception, StackFrame } from '@sentry/react-native';

import { scrubBreadcrumbs } from './breadcrumbs';
import { scrubContexts, scrubRequest, scrubTags } from './event-fields';
import { framePath } from './paths';
import { redactText } from './redact';
import { isRecord, nonEmpty, pickPrimitives, present, type Fields } from './values';

export { scrubBreadcrumb } from './breadcrumbs';
export { redactText } from './redact';

/** The SDK's own facts about the event, copied as they are. */
const KEPT_EVENT_FIELDS = Object.freeze([
  'event_id',
  'timestamp',
  'level',
  'platform',
  'logger',
  'release',
  'dist',
  'environment',
  'type',
]);

const FRAME_FIELDS = Object.freeze([
  'function',
  'module',
  'platform',
  'lineno',
  'colno',
  'in_app',
  'instruction_addr',
  'addr_mode',
  'debug_id',
]);
const MECHANISM_FIELDS = Object.freeze([
  'type',
  'handled',
  'synthetic',
  'source',
  'is_exception_group',
  'exception_id',
  'parent_id',
]);
/** A debug image (a source map's debug id, a native image's address and uuid). */
const IMAGE_FIELDS = Object.freeze([
  'type',
  'debug_id',
  'code_id',
  'arch',
  'uuid',
  'image_addr',
  'image_size',
  'image_vmaddr',
]);
/** An SDK integration's or package's name: one word, never text. */
const SDK_NAME = /^[\w.:@/-]{1,128}$/;

const pathOf = (value: unknown) => (typeof value === 'string' ? framePath(value) : undefined);
const redacted = (value: unknown) => (typeof value === 'string' ? redactText(value) : undefined);
const isSdkName = (value: unknown): value is string =>
  typeof value === 'string' && SDK_NAME.test(value);

function scrubFrame(frame: StackFrame): StackFrame {
  return {
    ...pickPrimitives(frame, FRAME_FIELDS),
    ...present('filename', pathOf(frame.filename)),
    ...present('abs_path', pathOf(frame.abs_path)),
  };
}

function scrubException(exception: Exception): Exception {
  const frames = exception.stacktrace?.frames;
  const mechanism = isRecord(exception.mechanism)
    ? (pickPrimitives(exception.mechanism, MECHANISM_FIELDS) as unknown as Exception['mechanism'])
    : undefined;
  return {
    ...pickPrimitives(exception, ['module', 'thread_id']),
    ...present('type', redacted(exception.type)),
    ...present('value', redacted(exception.value)),
    ...present('mechanism', mechanism),
    ...present(
      'stacktrace',
      Array.isArray(frames) ? { frames: frames.map(scrubFrame) } : undefined,
    ),
  };
}

function scrubExceptions(exception: Event['exception']): Event['exception'] {
  const values = exception?.values;
  return Array.isArray(values) ? { values: values.map(scrubException) } : undefined;
}

function scrubLogEntry(entry: Event['logentry']): Event['logentry'] {
  if (!isRecord(entry) || typeof entry.message !== 'string') return undefined;
  // params are the values a formatted message was built from: never sent
  return { message: redactText(entry.message) };
}

/** The SDK's name and version, its integrations' names and its packages: nothing else. */
function scrubSdk(sdk: Event['sdk']): Event['sdk'] {
  if (!isRecord(sdk)) return undefined;
  const { integrations, packages } = sdk;
  const named = Array.isArray(packages)
    ? packages.filter(isRecord).map((item) => pickPrimitives(item, ['name', 'version']))
    : undefined;
  return nonEmpty({
    ...pickPrimitives(sdk, ['name', 'version']),
    ...present(
      'integrations',
      Array.isArray(integrations) ? integrations.filter(isSdkName) : undefined,
    ),
    ...present('packages', named as { name: string; version: string }[] | undefined),
  });
}

function scrubImage(image: Fields): Record<string, unknown> {
  return {
    ...pickPrimitives(image, IMAGE_FIELDS),
    ...present('code_file', pathOf(image.code_file)),
    ...present('debug_file', pathOf(image.debug_file)),
  };
}

/** The debug images that map a crash to source (debug ids, files, addresses), scrubbed. */
function scrubDebugMeta(meta: Event['debug_meta']): Event['debug_meta'] {
  const images = isRecord(meta) ? meta.images : undefined;
  if (!Array.isArray(images)) return undefined;
  return { images: images.filter(isRecord).map(scrubImage) } as unknown as Event['debug_meta'];
}

function scrubCrumbs(crumbs: unknown): Breadcrumb[] | undefined {
  return Array.isArray(crumbs) ? scrubBreadcrumbs(crumbs as Breadcrumb[]) : undefined;
}

/**
 * The event as it may leave the phone: a new object built from the allowlists; the input is never
 * written to. Typed to the event it is given, so it is Sentry's beforeSend as it stands.
 */
export function scrubEvent<E extends Event>(event: E): E {
  const scrubbed: Event = {
    ...pickPrimitives(event, KEPT_EVENT_FIELDS),
    ...present('sdk', scrubSdk(event.sdk)),
    ...present('debug_meta', scrubDebugMeta(event.debug_meta)),
    ...present('message', redacted(event.message)),
    ...present('logentry', scrubLogEntry(event.logentry)),
    ...present('exception', scrubExceptions(event.exception)),
    ...present('breadcrumbs', scrubCrumbs(event.breadcrumbs)),
    ...present('contexts', scrubContexts(event.contexts)),
    ...present('extra', scrubContexts(event.extra)),
    ...present('tags', scrubTags(event.tags)),
    ...present('request', scrubRequest(event.request)),
  };
  return scrubbed as E;
}
