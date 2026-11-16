// What expo-notifications hands over, read into one plain event (PRD-001 §4.8). A received
// notification and a response (a tap, or an action from the notification) both carry
// request.identifier, request.content.categoryIdentifier and request.content.data; a response adds
// actionIdentifier and, for 'Reply…', userText (expo-notifications 0.32.17,
// build/Notifications.types.d.ts: Notification {date, request}, NotificationResponse
// {notification, actionIdentifier, userText?}). On Android the data may still be the JSON string
// Expo sent (content.dataString, or data itself as a string) when the JS mapping did not parse it.
// On iOS content.data is the APNs userInfo's 'body' key, where Expo puts the data
// (EXNotificationSerializer.m serializedNotificationData), and the trigger keeps the whole userInfo
// (trigger.payload): when content.data comes over empty, trigger.payload.body is read instead, so a
// push the phone holds is never unreadable for want of the one copy the JS mapping used.
// content's title, subtitle, body and attachments are what the notification showed (outside the
// signature: shown.ts holds a Reply to them). Anything missing or malformed is {kind: 'unreadable'}
// (text shown that is not text reads as none): this never throws. Nothing
// here is verified: event.data is the data as received, and only src/push/signature decides
// whether it came from the phone's own server (the action handler acts on parsePushData's output).

import { z } from 'zod';

import { parseJson } from '../../api/json';

/** The words a notification showed: its title, subtitle and body, and how many pictures (iOS). */
export type ShownText = Readonly<{
  title: string | null;
  subtitle: string | null;
  body: string | null;
  /** iOS attachments shown with it; 0 with none (Android exposes none to the app). */
  attachments: number;
}>;

export type InboundEvent = Readonly<{
  kind: 'readable';
  /** The notification request's identifier (the dedupe key's first half). */
  id: string;
  /** The category the server sent (unsigned: it chooses the buttons, never what is done). */
  category: string | null;
  /** The notification's data as received: an object, never verified here. */
  data: Readonly<Record<string, unknown>>;
  /** What the notification showed, as received (outside the signature). Never logged. */
  shown: ShownText;
  /** The response's actionIdentifier; null for a notification received in the foreground. */
  action: string | null;
  /** What the person typed into 'Reply…'; null when nothing was typed. */
  userText: string | null;
}>;

export type InboundRead = InboundEvent | Readonly<{ kind: 'unreadable' }>;

const UNREADABLE: InboundRead = Object.freeze({ kind: 'unreadable' });

const RecordShape = z.record(z.string(), z.unknown());

/** Text the notification showed; one that is not text reads as none and never makes it unreadable. */
const ShownLine = z.string().nullish().catch(null);

const RequestShape = z.object({
  identifier: z.string().min(1),
  content: z.object({
    categoryIdentifier: z.string().nullish(),
    title: ShownLine,
    subtitle: ShownLine,
    body: ShownLine,
    attachments: z.unknown(),
    data: z.unknown(),
  }),
});

/** iOS: a push's trigger carries the APNs userInfo, Expo's data under 'body'. */
const PushTriggerShape = z.object({ payload: z.object({ body: z.unknown() }) });

const NotificationShape = z.object({ request: RequestShape });

const ResponseShape = z.object({
  notification: NotificationShape,
  actionIdentifier: z.string().min(1),
  userText: z.string().nullish(),
});

type Request = z.output<typeof RequestShape>;

/** A JSON object string as an object; null for anything else. */
function recordFromJson(text: string): Record<string, unknown> | null {
  const parsed = RecordShape.safeParse(parseJson(text)?.value);
  return parsed.success ? parsed.data : null;
}

/** A non-empty object as is; null for an empty one (Android leaves data empty and sends dataString). */
function nonEmptyRecord(raw: unknown): Record<string, unknown> | null {
  const parsed = RecordShape.safeParse(raw);
  return parsed.success && Object.keys(parsed.data).length > 0 ? parsed.data : null;
}

/**
 * content.data as an object, or the JSON string it may still be: data itself, or Android's
 * dataString. dataString is read only when data is unusable (expo-notifications turns it into a
 * getter that warns once data is mapped).
 */
function dataOf(content: unknown, data: unknown): Record<string, unknown> | null {
  if (typeof data === 'string') return recordFromJson(data);
  const record = nonEmptyRecord(data);
  if (record) return record;
  const dataString: unknown = (content as { dataString?: unknown }).dataString;
  return typeof dataString === 'string' ? recordFromJson(dataString) : null;
}

/** iOS: Expo's data from the trigger's userInfo ('body'), an object or its JSON; null otherwise. */
function triggerDataOf(rawRequest: unknown): Record<string, unknown> | null {
  const trigger = PushTriggerShape.safeParse((rawRequest as { trigger?: unknown }).trigger);
  if (!trigger.success) return null;
  const { body } = trigger.data.payload;
  return typeof body === 'string' ? recordFromJson(body) : nonEmptyRecord(body);
}

/** How many attachments: an array's length, none for none, and anything else counts as one. */
function attachmentsOf(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  return raw === null || raw === undefined ? 0 : 1;
}

function shownOf(content: Request['content']): ShownText {
  return Object.freeze({
    title: content.title ?? null,
    subtitle: content.subtitle ?? null,
    body: content.body ?? null,
    attachments: attachmentsOf(content.attachments),
  });
}

function eventOf(
  request: Request,
  rawRequest: unknown,
  action: string | null,
  userText: string | null,
): InboundRead {
  const rawContent = (rawRequest as { content: unknown }).content;
  const data = dataOf(rawContent, request.content.data) ?? triggerDataOf(rawRequest);
  if (!data) return UNREADABLE;
  return Object.freeze({
    kind: 'readable',
    id: request.identifier,
    category: request.content.categoryIdentifier ?? null,
    data: Object.freeze(data),
    shown: shownOf(request.content),
    action,
    userText,
  });
}

/** The raw request behind a parsed one (zod drops the keys it was not told about). */
function rawRequestOf(notification: unknown): unknown {
  return (notification as { request: unknown }).request;
}

/** A notification received while the app is open (the foreground handler's argument). */
export function fromNotification(notification: unknown): InboundRead {
  try {
    const parsed = NotificationShape.safeParse(notification);
    if (!parsed.success) return UNREADABLE;
    return eventOf(parsed.data.request, rawRequestOf(notification), null, null);
  } catch {
    // A getter that throws on a native object is an unreadable notification, never a crash.
    return UNREADABLE;
  }
}

/** A tap or an action on a notification (a response listener's or getLastNotificationResponse's). */
export function fromResponse(response: unknown): InboundRead {
  try {
    const parsed = ResponseShape.safeParse(response);
    if (!parsed.success) return UNREADABLE;
    const { notification, actionIdentifier, userText } = parsed.data;
    const raw = (response as { notification: unknown }).notification;
    return eventOf(notification.request, rawRequestOf(raw), actionIdentifier, userText ?? null);
  } catch {
    // As above: a native object that throws when read is unreadable.
    return UNREADABLE;
  }
}
