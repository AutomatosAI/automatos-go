// The style choice as the phone stores it (D59): a small versioned JSON value, parsed with zod on
// the way back. Anything the parser cannot read — garbage, an older or newer version, a style this
// build does not have — is Studio, never a crash. A theme choice is only as good as the install
// behind it: resolveChoice falls back to Studio when the workspace no longer offers it (D58).
// Nothing stored at all is 'Same as Studio' (D-PHONE-CHOICE, the default since 24 Oct), and that
// choice is stored as {v, kind: 'follow'} once it is picked again (parsePhoneChoice).

import { z } from 'zod';

import { DEFAULT_CHOICE } from './registry';
import {
  BUILT_IN_STYLE_IDS,
  FOLLOW_STUDIO,
  builtinChoice,
  isFollowStudio,
  themeChoice,
  type PhoneChoice,
  type StyleChoice,
} from './style-id';

/** The stored shape's version; a value written under any other version reads as Studio. */
export const CHOICE_VERSION = 1;

/**
 * An install id as the server sends it (a UUID) and as it travels in a path segment
 * (GET /api/themes/mobile/{install_id}): letters, digits, '-' and '_', at most 64.
 */
export const InstallIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

const StoredChoiceSchema = z.discriminatedUnion('kind', [
  z.object({
    v: z.literal(CHOICE_VERSION),
    kind: z.literal('builtin'),
    id: z.enum(BUILT_IN_STYLE_IDS),
  }),
  z.object({ v: z.literal(CHOICE_VERSION), kind: z.literal('theme'), installId: InstallIdSchema }),
]);

export function serialiseChoice(choice: StyleChoice): string {
  const fields =
    choice.kind === 'builtin'
      ? { kind: choice.kind, id: choice.id }
      : { kind: choice.kind, installId: choice.installId };
  return JSON.stringify({ v: CHOICE_VERSION, ...fields });
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The stored string back to a choice; unknown fields are ignored, anything else is Studio. */
export function parseChoice(raw: unknown): StyleChoice {
  if (typeof raw !== 'string') return DEFAULT_CHOICE;
  const parsed = StoredChoiceSchema.safeParse(parseJson(raw));
  if (!parsed.success) return DEFAULT_CHOICE;
  return parsed.data.kind === 'builtin'
    ? builtinChoice(parsed.data.id)
    : themeChoice(parsed.data.installId);
}

const StoredFollowSchema = z.object({ v: z.literal(CHOICE_VERSION), kind: z.literal('follow') });

/** A phone choice as stored: 'Same as Studio' as {v, kind: 'follow'}, a style as serialiseChoice. */
export function serialisePhoneChoice(choice: PhoneChoice): string {
  if (isFollowStudio(choice)) return JSON.stringify({ v: CHOICE_VERSION, kind: choice.kind });
  return serialiseChoice(choice);
}

/** Nothing stored, or 'Same as Studio' stored: follow Studio; anything else as parseChoice reads it. */
export function parsePhoneChoice(raw: unknown): PhoneChoice {
  if (raw === null || raw === undefined) return FOLLOW_STUDIO;
  if (typeof raw === 'string' && StoredFollowSchema.safeParse(parseJson(raw)).success) {
    return FOLLOW_STUDIO;
  }
  return parseChoice(raw);
}

/** The choice to paint: a theme whose install is no longer offered is back on Studio. */
export function resolveChoice(
  stored: StyleChoice,
  offeredInstallIds: readonly string[],
): StyleChoice {
  if (stored.kind === 'builtin') return stored;
  return offeredInstallIds.includes(stored.installId) ? stored : DEFAULT_CHOICE;
}
