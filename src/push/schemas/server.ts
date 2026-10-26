// What the server answers the push wave (D-ONE-CLIENT): zod at the boundary, unknown fields dropped
// at parse time. Shapes read on automatos-ai origin/main (W1 merged): api/mobile_devices.py
// (register_device, list_devices, update_device), core/models/mobile_devices.py to_dict (never the
// push key or token), api/notifications.py PreferenceRow / PreferenceListResponse,
// api/approval_grants.py answer_question ({grant: to_dict}), api/workspaces.py get_current_workspace
// (settings). W2's additions (RE-VERIFY after W2): push rows and push_types (US-014a), PUT
// /api/v1/mobile/push-settings (US-014b), the 409 push_token_missing (US-009). A refusal's detail is
// read by the foundation's error parser (src/api/errors.ts → ApiError.code), never by a second one.

import { z } from 'zod';

import { isApiError } from '../../api/errors';
import { WORKSPACE_ROLES } from '../../api/workspace';
import { logger } from '../../lib/logger';
import { CONFLICT_STATUS, DIGEST_TIME_PATTERN, PUSH_KEY_MAX_LENGTH } from '../config';

const Text = z.string().nullable().catch(null);

/** POST /api/v1/mobile/devices, Cache-Control no-store: push_key in clear only when minted. */
export const registrationSchema = z.object({
  device_id: z.string().uuid(),
  push_key: z.string().min(1).max(PUSH_KEY_MAX_LENGTH).nullable(),
});

export type Registration = Readonly<z.output<typeof registrationSchema>>;

export const DEVICE_KINDS = ['clerk', 'paired'] as const;

/** One device as W1's to_dict shows it (no hash, no push key, no push token). */
export const deviceSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid().nullable().catch(null),
  kind: z.enum(DEVICE_KINDS),
  install_id: z.string().min(1),
  /** W2 US-009 stores the phone's model name on registration; a paired row keeps its pairing name. */
  name: Text,
  platform: z.string(),
  timezone: Text,
  digest_time: z.string().regex(DIGEST_TIME_PATTERN).nullable().catch(null),
  /** pending | active | revoked; kept as sent. */
  status: z.string(),
  push_registered: z.boolean(),
  push_enabled: z.boolean(),
  /** device_revoked, token_moved, DeviceNotRegistered (W2 K14, K15), or null. */
  push_disabled_reason: Text,
  last_seen_at: Text,
});

export type Device = Readonly<z.output<typeof deviceSchema>>;

/** The rows that parse; one this version cannot read is not this phone's to act on. */
const DeviceRows = z.array(z.unknown()).transform((items): Device[] =>
  items.flatMap((item) => {
    const parsed = deviceSchema.safeParse(item);
    if (parsed.success) return [parsed.data];
    logger.debug('[push] left out a device row this version cannot read');
    return [];
  }),
);

export const devicesSchema = z.object({ devices: DeviceRows });

export type Devices = Readonly<z.output<typeof devicesSchema>>;

/**
 * One preference row, exactly as GET sends it: PUT replaces every row of each event it names
 * (KP12), so a row is never dropped or rewritten here — a row that does not parse fails the whole
 * answer (invalid_response) rather than be lost by the next save.
 */
export const preferenceRowSchema = z.object({
  event_type: z.string().min(1),
  destination: z.string().min(1),
  enabled: z.boolean(),
  channel_connection_id: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
});

export type PreferenceRow = Readonly<z.output<typeof preferenceRowSchema>>;

const EventList = z.array(z.string().min(1));

/** W2 US-014a: push type → its event types; absent on a server before W2 (or malformed: absent). */
const PushTypesSchema = z
  .object({
    needs_answer: EventList,
    review: EventList,
    auto_message: EventList,
    digest: EventList,
  })
  .optional()
  .catch(undefined);

export type PushTypes = Readonly<NonNullable<z.output<typeof PushTypesSchema>>>;

export const preferencesSchema = z.object({
  success: z.boolean(),
  preferences: z.array(preferenceRowSchema),
  push_types: PushTypesSchema,
});

export type Preferences = Readonly<z.output<typeof preferencesSchema>>;

/** PUT /api/notification-preferences: how many rows were written. */
export const preferencesSavedSchema = z.object({
  success: z.boolean(),
  updated_count: z.number().int().nonnegative(),
});

export type PreferencesSaved = Readonly<z.output<typeof preferencesSavedSchema>>;

/** PUT /api/v1/mobile/push-settings (W2 US-014b). */
export const pushSettingsSchema = z.object({
  push: z.object({ redact_questions: z.boolean() }),
});

export type PushSettings = Readonly<z.output<typeof pushSettingsSchema>>;

/** settings.push.redact_questions, off unless the server says true. */
const RedactQuestions = z
  .object({
    push: z
      .object({ redact_questions: z.boolean().catch(false) })
      .catch({ redact_questions: false }),
  })
  .nullish()
  .catch(null)
  .transform((settings) => settings?.push.redact_questions ?? false);

/**
 * GET /api/workspaces/current, read for push only: the role and the redact switch. Everything else
 * stays the foundation's (src/api/workspace.ts); an unknown role reads as viewer (D17).
 */
export const workspacePushSchema = z
  .object({
    role: z.enum(WORKSPACE_ROLES).catch('viewer'),
    settings: RedactQuestions,
  })
  .transform(({ role, settings }) => ({ role, redactQuestions: settings }));

export type WorkspacePush = Readonly<z.output<typeof workspacePushSchema>>;

/** What /answer sends back ({grant: to_dict}); only what the honest result reads (KP8). */
export const answerSchema = z.object({
  grant: z.object({
    id: z.number().int(),
    status: z.string(),
    kind: z.string(),
    answer_text: z.string().nullable(),
  }),
});

export type AnswerResult = Readonly<z.output<typeof answerSchema>>;

/** The stale check's view of the open questions: only their ids (KP9). */
const GrantIdRows = z.array(z.unknown()).transform((items): string[] =>
  items.flatMap((item) => {
    const parsed = z.object({ id: z.number().int().positive() }).safeParse(item);
    return parsed.success ? [String(parsed.data.id)] : [];
  }),
);

export const pendingQuestionsSchema = z.object({ grants: GrantIdRows });

/** A stale check needs only that the record is there and what it is now. */
export const ticketCheckSchema = z.object({ id: z.number().int(), status: Text });
export const socialPostCheckSchema = z.object({ id: z.string().min(1), status: Text });
export const chatCheckSchema = z.object({ id: z.string().min(1) });

export type TicketCheck = Readonly<z.output<typeof ticketCheckSchema>>;
export type SocialPostCheck = Readonly<z.output<typeof socialPostCheckSchema>>;
export type ChatCheck = Readonly<z.output<typeof chatCheckSchema>>;

/** W1's DeviceConflict codes and the push token's unique index (W2 US-009 adds push_token_missing). */
export const DEVICE_CONFLICT_CODES = [
  'push_token_in_use',
  'push_token_missing',
  'device_revoked',
  'install_id_mismatch',
  'install_id_paired',
] as const;

export const deviceConflictSchema = z.object({ code: z.enum(DEVICE_CONFLICT_CODES) });

export type DeviceConflictCode = z.output<typeof deviceConflictSchema>['code'];

/** The code of a device route's 409, or null for any other failure (a concurrent change included). */
export function deviceConflictOf(error: unknown): DeviceConflictCode | null {
  if (!isApiError(error) || error.status !== CONFLICT_STATUS) return null;
  const parsed = deviceConflictSchema.safeParse({ code: error.code });
  return parsed.success ? parsed.data.code : null;
}
