// The message a push's sig covers (KP6 = W2 K9, word for word): the canonical JSON array
// ["v2", type, workspace_id, notification_id, grant_id, link_type, link_id, ticket_number,
// question, options, iat]. W2 serialises it with Python json.dumps(fields, separators=(',', ':'),
// ensure_ascii=False), which equals JSON.stringify(fields) byte for byte. The order is fixed; a
// string field the payload omits is ""; options is the payload's list in order, or []; iat is the
// payload's integer. Received strings are used as received: never trimmed or re-normalised.

import { PUSH_SIG_MESSAGE_TAG } from '../config';
import type { PushPayload } from '../schemas/payload';

/** The fields sig covers: every payload field but sig, the tag standing for v. */
export type SignedFields = Pick<
  PushPayload,
  | 'type'
  | 'workspace_id'
  | 'notification_id'
  | 'grant_id'
  | 'link_type'
  | 'link_id'
  | 'ticket_number'
  | 'question'
  | 'iat'
> & { readonly options?: readonly string[] };

/** The signed fields in the signed order, as one compact JSON array. */
export function signedMessage(payload: SignedFields): string {
  return JSON.stringify([
    PUSH_SIG_MESSAGE_TAG,
    payload.type,
    payload.workspace_id,
    payload.notification_id ?? '',
    payload.grant_id ?? '',
    payload.link_type ?? '',
    payload.link_id ?? '',
    payload.ticket_number ?? '',
    payload.question ?? '',
    payload.options ?? [],
    payload.iat,
  ]);
}
