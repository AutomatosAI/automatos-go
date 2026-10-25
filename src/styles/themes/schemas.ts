// The theme answers the phone reads (PRD-261, D-THEMES), in the shapes core main sends them
// (99fb70ff5): GET /api/themes/installed (services/themes/updates.py install_row), GET
// /api/themes/active (defaults.py resolve_active) and GET /api/themes/mobile/{install_id}
// (services/themes/mobile.py). Unknown fields are ignored. A revocation is {level, reason}, never a
// boolean, and a level this app does not know, or a revocation it cannot read, counts as 'disable'
// (fail closed, as core's revocations.effective_level). An install row the schema cannot read is
// dropped, never the whole list. Token values, font URLs and mascot files are only shaped here:
// paint.ts reads the colours and file-url.ts decides which URLs may be loaded.

import { z } from 'zod';

import { InstallIdSchema } from '../registry/choice';

export const REVOKE_WARN = 'warn';
export const REVOKE_DISABLE = 'disable';

export type RevocationLevel = typeof REVOKE_WARN | typeof REVOKE_DISABLE;

export type Revocation = { readonly level: RevocationLevel; readonly reason: string | null };

const REVOCATION_FIELDS = {
  level: z
    .unknown()
    .transform((level): RevocationLevel => (level === REVOKE_WARN ? REVOKE_WARN : REVOKE_DISABLE)),
  reason: z
    .string()
    .nullable()
    .optional()
    .catch(null)
    .transform((reason) => reason ?? null),
};

const RevocationSchema = z.object(REVOCATION_FIELDS);

const UNREADABLE_REVOCATION: Revocation = Object.freeze({ level: REVOKE_DISABLE, reason: null });

/** null for none; a revocation as sent; anything else there (true, a string) reads as 'disable'. */
export function revocationOf(value: unknown): Revocation | null {
  if (value === null || value === undefined) return null;
  const parsed = RevocationSchema.safeParse(value);
  return parsed.success ? Object.freeze(parsed.data) : UNREADABLE_REVOCATION;
}

const RevokedField = z.unknown().transform(revocationOf);

/** services/themes/optin.py opt_in_state: required until the member opts in to private code. */
const OptInSchema = z
  .object({ required: z.boolean(), wording: z.string().catch(''), packageId: z.string().catch('') })
  .nullable()
  .catch(null);

export const InstallRowSchema = z.object({
  installId: InstallIdSchema,
  themeId: z.string().min(1),
  /** The manifest's name; null for a package that has none. */
  name: z.string().nullable().catch(null),
  version: z.string().min(1),
  optIn: OptInSchema.optional().transform((optIn) => optIn ?? null),
  revoked: RevokedField,
});

export type InstallRow = Readonly<z.output<typeof InstallRowSchema>>;

/** The envelope only: each row is read on its own (installRows), so one bad row drops alone. */
export const InstalledSchema = z.object({ installs: z.array(z.unknown()) });

export type InstalledRows = { readonly rows: readonly InstallRow[]; readonly dropped: number };

export function installRows(installs: readonly unknown[]): InstalledRows {
  const rows = installs.flatMap((install) => {
    const parsed = InstallRowSchema.safeParse(install);
    return parsed.success ? [Object.freeze(parsed.data)] : [];
  });
  return Object.freeze({ rows: Object.freeze(rows), dropped: installs.length - rows.length });
}

const ActiveThemeSchema = z.object({
  installId: InstallIdSchema,
  themeId: z.string().min(1),
  version: z.string(),
  /** A 'warn' revocation of the theme Studio still runs ('disable' answers theme null). */
  revoked: RevokedField.optional().transform((revoked) => revoked ?? null),
});

const ActiveRevokedSchema = z.object({ installId: InstallIdSchema, ...REVOCATION_FIELDS });

export const ActiveSchema = z.object({
  /** 'studio', 'classic' or an install id. */
  choice: z.string(),
  /** 'choice', 'default' or 'fallback': where the choice came from. */
  source: z.string(),
  theme: ActiveThemeSchema.nullable(),
  /** The theme Studio would use is withdrawn: Studio shows its base, theme is null. */
  revoked: ActiveRevokedSchema.optional().catch(undefined),
});

export type Active = Readonly<z.output<typeof ActiveSchema>>;

/** What the phone reads for a server that has no theme routes (an older self-hosted install). */
export const NO_ACTIVE_THEME: Active = Object.freeze({
  choice: 'studio',
  source: 'fallback',
  theme: null,
});

export const MOBILE_ANSWER_SCHEMA = 1;

export const MOBILE_SOURCES = ['tokens', 'fromLooks'] as const;
export const MASCOT_MODES = ['clips', 'stills', 'none'] as const;
/** services/themes/contract.py MOBILE_FONT_ROLES. */
export const THEME_FONT_ROLES = ['sans', 'serif', 'mono'] as const;

export type ThemeFontRole = (typeof THEME_FONT_ROLES)[number];
export type MascotMode = (typeof MASCOT_MODES)[number];

const SchemeTokensSchema = z.record(z.string(), z.unknown()).nullable().catch(null);

/** core's manifest.py MAX_STATES: a theme's mascot names at most this many states. */
export const MAX_MASCOT_STATES = 32;

const MascotStateSchema = z.object({
  name: z.string().min(1),
  clip: z.string().nullable().catch(null),
  still: z.string().nullable().catch(null),
});

const MascotSchema = z
  .object({
    mode: z.enum(MASCOT_MODES).catch('none'),
    states: z
      .array(z.unknown())
      .catch([])
      .transform((states) =>
        states
          .flatMap((state) => {
            const parsed = MascotStateSchema.safeParse(state);
            return parsed.success ? [Object.freeze(parsed.data)] : [];
          })
          .slice(0, MAX_MASCOT_STATES),
      ),
  })
  .catch({ mode: 'none' as const, states: [] });

const FontsSchema = z
  .object({
    sans: z.string().optional().catch(undefined),
    serif: z.string().optional().catch(undefined),
    mono: z.string().optional().catch(undefined),
  })
  .catch({});

const MobileBlockSchema = z.object({
  source: z.enum(MOBILE_SOURCES),
  tone: z.enum(['light', 'dark']).nullable().catch(null),
  tokens: z.object({ light: SchemeTokensSchema, dark: SchemeTokensSchema }),
  fonts: FontsSchema.optional().transform((fonts) => fonts ?? {}),
  mascot: MascotSchema.optional().transform(
    (mascot) => mascot ?? { mode: 'none' as const, states: [] },
  ),
});

export const MobileThemeSchema = z.object({
  schema: z.literal(MOBILE_ANSWER_SCHEMA),
  installId: InstallIdSchema,
  themeId: z.string().min(1),
  version: z.string(),
  /** null: no phone look, private code not opted in to, revoked, or a painting that can't be read. */
  mobile: MobileBlockSchema.nullable(),
});

export type MobileTheme = Readonly<z.output<typeof MobileThemeSchema>>;
export type MobileBlock = NonNullable<MobileTheme['mobile']>;
export type MascotState = MobileBlock['mascot']['states'][number];
