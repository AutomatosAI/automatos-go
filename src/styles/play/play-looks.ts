// Play's looks on the phone (D55, D59), pure: the saved looks and the active one, every look
// checked by the vendored validateLook (lib/looks/engine.ts, the server's twin), and the editor's
// fresh-id rule for a phone-only look whose id the server already uses. The look page (US-017e)
// builds its editor on these. Play's looks are kept on the server under 'automatos/play' (looks.py
// BUILTIN_PLAY_THEME_ID), so a look changed here repaints Play in the browser (look-sync.ts).

import { validateLook } from '../../core/frozen/lib/looks/engine';
import { DEFAULT_LOOK, PRESETS, isPresetId } from '../../core/frozen/lib/looks/presets';
import type { Look } from '../../core/frozen/lib/looks/types';
import type { LookRules } from './look-sync';

/** The id Play's looks are kept under on the server, sent as two path segments. */
export const PLAY_THEME_ID = 'automatos/play';

/** The phone's Play looks: the ones the user saved, and the one Play paints. */
export type PlayLooks = {
  readonly saved: readonly Look[];
  readonly active: Look;
};

export const INITIAL_PLAY_LOOKS: PlayLooks = Object.freeze({
  saved: Object.freeze([]),
  active: DEFAULT_LOOK,
});

/** The look as Play takes it (the vendored validateLook: only Look's fields, text trimmed). */
export function checkPlayLook(value: unknown): Look | null {
  const result = validateLook(value);
  return result.ok ? Object.freeze(result.look) : null;
}

/** 'look-N' with the lowest N no preset or saved look uses (editor.ts freshLookId, ported). */
export function freshPlayLookId(saved: readonly Look[]): string {
  const ids = new Set([...PRESETS, ...saved].map((look) => look.id));
  let n = 1;
  while (ids.has(`look-${n}`)) n += 1;
  return `look-${n}`;
}

export const PLAY_LOOK_RULES: LookRules<Look> = Object.freeze({
  themeId: PLAY_THEME_ID,
  check: checkPlayLook,
  isPreset: isPresetId,
  freshId: freshPlayLookId,
  defaultLook: DEFAULT_LOOK,
});
