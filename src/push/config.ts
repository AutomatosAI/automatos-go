// The push wave's named constants (D-SHAPE): timeouts, limits, intervals and wire values, one place
// per wave. Each story adds its own here; no module of src/push carries a bare literal for them.

/** The signed payload's version (KP6 = W2 K9): any other v, v1 included, is refused. */
export const PUSH_PAYLOAD_VERSION = 2;

/** sig: lowercase hex HMAC-SHA256 (32 bytes, 64 characters). */
export const PUSH_SIG_PATTERN = /^[0-9a-f]{64}$/;

/** GET /api/v1/approval-grants filters for the open questions (the stale check, KP9). */
export const PENDING_STATUS = 'pending';
export const QUESTION_KIND = 'question';

/** W1 answers a device conflict as 409 {"detail": {"code": …}} (api/mobile_devices.py _write). */
export const CONFLICT_STATUS = 409;

/** W1's device ids and the notifications table's ids are UUIDs (the routes take `UUID`). */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A grant's row id as the payload carries it: str(grant.id), a positive integer (W2 US-011a). */
export const ROW_ID_PATTERN = /^[1-9][0-9]*$/;

/** A device's digest time, 'HH:MM' on the 24-hour clock (W1 DIGEST_TIME_PATTERN). */
export const DIGEST_TIME_PATTERN = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;

/** The first element of the signed message (KP6 = W2 K9's canonical array). */
export const PUSH_SIG_MESSAGE_TAG = 'v2';

/** The freshness window (KP6 = W2 K9): iat at most 7 days old and at most 5 minutes ahead. */
export const PUSH_SIG_MAX_AGE_SECONDS = 604800;
export const PUSH_SIG_MAX_FUTURE_SECONDS = 300;

/** The actions a notification offers (KP7 = W2 K9's categories): no Approve, no option buttons. */
export const REPLY_ACTION_ID = 'reply';
export const OPEN_ACTION_ID = 'open';

/**
 * A tap on the notification itself: expo-notifications 0.32.17's DEFAULT_ACTION_IDENTIFIER
 * (build/NotificationsEmitter.d.ts), named here so the pure modules never import the native one.
 */
export const DEFAULT_ACTION_ID = 'expo.modules.notifications.actions.DEFAULT';

/** The link_type of a question push: its grant_id is what a reply answers (W2 US-011a). */
export const QUESTION_LINK_TYPE = 'question';

/** A reply from the notification is trimmed and cut to this many characters (code points). */
export const ANSWER_MAX_CHARS = 4000;

/** The handled responses remembered across launches: keys only, the oldest dropped first. */
export const HANDLED_KEYS_MAX = 50;
