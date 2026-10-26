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

/**
 * The most active devices one person may hold in one workspace (W1 services/mobile/devices.py
 * MAX_ACTIVE_DEVICES_PER_PERSON, #1317): a registration that would add one more is 409
 * device_limit_reached.
 */
export const MAX_DEVICES_PER_PERSON = 10;

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

/** The link types a push opens a record for (W2 US-011a's producers; the web's linkFor). */
export const TASK_LINK_TYPE = 'task';
export const SOCIAL_POST_LINK_TYPE = 'social_post';
export const CHAT_LINK_TYPE = 'chat';

/** The one status a social post waits on a person in (modules/socials/service.py NEEDS_APPROVAL). */
export const SOCIAL_NEEDS_APPROVAL_STATUS = 'needs_approval';

/** How long a link's stale check may take before its screen opens unchecked (KP9). */
export const STALE_CHECK_TIMEOUT_MS = 4000;

/**
 * The foreground handler's verify budget (KP15): a push received while the app is open that does
 * not verify within it is shown as unverified (nothing at all).
 */
export const FOREGROUND_VERIFY_TIMEOUT_MS = 2000;

/** The push record's keychain item (KP18), named in the app's key registry (src/lib/secure-keys.ts). */
export const PUSH_RECORD_ITEM = 'automatos.push-record.v1';

/** W1's column limits (core/models/mobile_devices.py, api/mobile_devices.py). */
export const PUSH_KEY_MAX_LENGTH = 128;
export const LOCALE_MAX_LENGTH = 35;
export const TIMEZONE_MAX_LENGTH = 64;
export const PHONE_NAME_MAX_LENGTH = 120;
export const EXPO_PUSH_TOKEN_MAX_LENGTH = 255;

/** W1's expo_push_token rule (api/mobile_devices.py EXPO_PUSH_TOKEN_PATTERN). */
export const EXPO_PUSH_TOKEN_PATTERN = /^ExponentPushToken\[[^[\]\s]+\]$/;

/** A registration whose facts have not changed is sent again after this long (KP10). */
export const REREGISTER_AFTER_MS = 24 * 60 * 60 * 1000;

/** A hosted phone with no key for its row revokes and re-registers at most this often (KP10). */
export const RECOVERY_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** The MMKV item that remembers the last key recovery per server and workspace: dates, nothing else. */
export const KEY_RECOVERY_ITEM = 'push.key-recovery.v1';
export const RECOVERY_SCOPES_MAX = 16;

/**
 * The MMKV item of the scopes whose phone the person removed (KP16): server and workspace pairs,
 * nothing else. Registration waits there until the person's tap.
 */
export const REMOVED_SCOPES_ITEM = 'push.removed.v1';
export const REMOVED_SCOPES_MAX = 16;

/** A preference row's push switch for its event (W2 K7: a destination never delivered as a row). */
export const PUSH_DESTINATION = 'push';

/** W1's device status a PATCH (the digest time) is taken for: pending and revoked rows refuse it. */
export const ACTIVE_DEVICE_STATUS = 'active';

/**
 * Leaving the hosted server (KP16, W2 US-009): the DELETE of this phone's row waits at most this long
 * for the server, then the phone is cleared and signed out anyway (best effort).
 */
export const SIGN_OUT_DELETE_TIMEOUT_MS = 4000;

/** The MMKV item of the handled response keys (dedupe.ts's stored form: keys only, never a payload). */
export const HANDLED_KEYS_ITEM = 'push.handled-responses.v1';

/** The answer route recorded the answer (the grant's status after pending, approval_grants.py). */
export const GRANTED_STATUS = 'granted';

/** The answer route's refusal of a question that is not open any more (approval_grants.py). */
export const UNPROCESSABLE_STATUS = 422;

/** The discovery capability a server lists when it sends push to phones (D-CAPABILITIES). */
export const PUSH_CAPABILITY = 'push';

/** The in-context ask (KP11): from the second session on, and at most twice, a week apart. */
export const PROMPT_MIN_SESSIONS = 2;
export const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const PROMPT_MAX_DECLINES = 2;

/** The MMKV item of the in-context ask's counters: numbers and dates only, never a key or a token. */
export const PROMPT_COUNTS_ITEM = 'push.prompt.v1';

/** The phone's clock is read in milliseconds; the signature's window is in seconds. */
export const MS_PER_SECOND = 1000;
