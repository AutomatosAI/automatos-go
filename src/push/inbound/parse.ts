// What expo-notifications hands over, read into one plain event (PRD-001 §4.8). A received
// notification and a response (a tap, or an action from the notification) both carry
// request.identifier, request.content.categoryIdentifier and request.content.data; a response adds
// actionIdentifier and, for 'Reply…', userText (expo-notifications 0.32.17,
// build/Notifications.types.d.ts: Notification {date, request}, NotificationResponse
// {notification, actionIdentifier, userText?}). On Android the data may still be the JSON string
// Expo sent (content.dataString, or data itself as a string) when the JS mapping did not parse it.
// Anything missing or malformed is {kind: 'unreadable'}: this never throws. Nothing here is
// verified: event.data is the data as received, and only src/push/signature decides whether it
// came from the phone's own server (the action handler acts on parsePushData's output only).

import { z } from 'zod';

import { parseJson } from '../../api/json';

export type InboundEvent = Readonly<{
  kind: 'readable';
  /** The notification request's identifier (the dedupe key's first half). */
  id: string;
  /** The category the server sent (unsigned: it chooses the buttons, never what is done). */
  category: string | null;
  /** The notification's data as received: an object, never verified here. */
  data: Readonly<Record<string, unknown>>;
  /** The response's actionIdentifier; null for a notification received in the foreground. */
  action: string | null;
  /** What the person typed into 'Reply…'; null when nothing was typed. */
  userText: string | null;
}>;

export type InboundRead = InboundEvent | Readonly<{ kind: 'unreadable' }>;

const UNREADABLE: InboundRead = Object.freeze({ kind: 'unreadable' });

const RecordShape = z.record(z.string(), z.unknown());

const RequestShape = z.object({
  identifier: z.string().min(1),
  content: z.object({
    categoryIdentifier: z.string().nullish(),
    data: z.unknown(),
  }),
});

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

function eventOf(
  request: Request,
  rawContent: unknown,
  action: string | null,
  userText: string | null,
): InboundRead {
  const data = dataOf(rawContent, request.content.data);
  if (!data) return UNREADABLE;
  return Object.freeze({
    kind: 'readable',
    id: request.identifier,
    category: request.content.categoryIdentifier ?? null,
    data: Object.freeze(data),
    action,
    userText,
  });
}

/** The raw content object behind a parsed request (zod drops the keys it was not told about). */
function rawContentOf(notification: unknown): unknown {
  return (notification as { request: { content: unknown } }).request.content;
}

/** A notification received while the app is open (the foreground handler's argument). */
export function fromNotification(notification: unknown): InboundRead {
  try {
    const parsed = NotificationShape.safeParse(notification);
    if (!parsed.success) return UNREADABLE;
    return eventOf(parsed.data.request, rawContentOf(notification), null, null);
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
    return eventOf(notification.request, rawContentOf(raw), actionIdentifier, userText ?? null);
  } catch {
    // As above: a native object that throws when read is unreadable.
    return UNREADABLE;
  }
}
