// The data every Automatos push carries (KP6 = W2 K9, W2 US-011a; RE-VERIFY after W2): {v: 2, type,
// workspace_id, notification_id?, grant_id?, link_type?, link_id?, ticket_number?, question?,
// options?, iat, sig}. Every id and ticket_number is a JSON string (str(grant.id)): a number is a
// type error, because the signature is computed over the string. W2 omits an absent key and never
// sends null; a null still reads as absent. Unknown keys are ignored. Anything that does not fit —
// a v other than 2 (v1 included), a field of the wrong type, no sig, type, workspace_id or iat —
// is no payload at all: the notification is unverifiable, never a crash. Parsing proves the shape
// only; the signature and the freshness window are checked in src/push/signature.

import { z } from 'zod';

import { parseJson } from '../../api/json';
import { PUSH_PAYLOAD_VERSION, PUSH_SIG_PATTERN } from '../config';

/** An optional signed field: a string, or absent ('' in the canonical message). */
const Signed = z.string().optional();

const PushPayloadShape = z.object({
  v: z.literal(PUSH_PAYLOAD_VERSION),
  /** The push type (needs_answer | review | auto_message), verified as received. */
  type: z.string().min(1),
  workspace_id: z.string().min(1),
  notification_id: Signed,
  grant_id: Signed,
  link_type: Signed,
  link_id: Signed,
  ticket_number: Signed,
  question: Signed,
  /** In order: the order is signed. */
  options: z.array(z.string()).optional(),
  /** Epoch seconds when W2 built the message. */
  iat: z.number().int().safe(),
  sig: z.string().regex(PUSH_SIG_PATTERN),
});

/** A plain object's entries without the null ones (a new object; arrays and scalars pass as is). */
function withoutNulls(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== null));
}

export const pushPayloadSchema = z.preprocess(withoutNulls, PushPayloadShape);

export type PushPayload = Readonly<z.output<typeof PushPayloadShape>>;

/**
 * The payload of a notification's data: the object expo-notifications hands over (content.data),
 * or the same as a JSON string (an Android data string). null when it is not a v2 payload.
 */
export function parsePushData(raw: unknown): PushPayload | null {
  const value = typeof raw === 'string' ? parseJson(raw)?.value : raw;
  const parsed = pushPayloadSchema.safeParse(value);
  return parsed.success ? Object.freeze(parsed.data) : null;
}
