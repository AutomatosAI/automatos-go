// The themes whose looks the phone keeps in step with the web (US-017d, D-PHONE-CHOICE): Play
// ('automatos/play', the vendored validateLook) and HUD ('automatos/hud', validateLook with
// HUD_LOOK_SPEC; Gerard, 24 Oct: 'when you change on web or local the mobile picks up and changes
// also'). Each binds its rules to its part of the style store: Play's looks (play/look-store.ts)
// and HUD's (hud/look-store.ts). Where the theme is not installed in the workspace (404) its looks
// stay on the phone: Play's look page says how to change that, HUD says nothing.

import type { Look } from '../../core/frozen/lib/looks/types';
import { HUD_LOOK_RULES } from '../hud/hud-looks';
import type { HudLook } from '../hud/look-schema';
import type { LookDoc, LookRules, LookSet } from '../play/look-sync';
import { PLAY_LOOK_RULES } from '../play/play-looks';
import type { StyleState, StyleStore } from '../provider/store';
import { LOOK_SYNC_COPY } from '../strings';
import type { LookThemeKey } from './look-marks';

export type LookTheme<L extends LookDoc> = {
  readonly key: LookThemeKey;
  readonly rules: LookRules<L>;
  /** The theme's looks in the style store. */
  readonly select: (state: StyleState) => LookSet<L>;
  /** Writes them there (and so to the phone); false when the phone could not keep them. */
  readonly apply: (store: StyleStore, looks: LookSet<L>) => boolean;
  /** What the look page says while the theme is not installed in the workspace; null: nothing. */
  readonly notInstalled: string | null;
};

export const PLAY_LOOK_THEME: LookTheme<Look> = Object.freeze({
  key: 'play',
  rules: PLAY_LOOK_RULES,
  select: (state: StyleState) => state.playLooks,
  apply: (store: StyleStore, looks: LookSet<Look>) => store.setPlayLooks(looks),
  notInstalled: LOOK_SYNC_COPY.playNotInstalled,
});

export const HUD_LOOK_THEME: LookTheme<HudLook> = Object.freeze({
  key: 'hud',
  rules: HUD_LOOK_RULES,
  select: (state: StyleState) => state.hudLooks,
  apply: (store: StyleStore, looks: LookSet<HudLook>) => store.setHudLooks(looks),
  notInstalled: null,
});

/** Each theme's words for a look page while it is not installed. */
export const NOT_INSTALLED_COPY: Readonly<Record<LookThemeKey, string | null>> = Object.freeze({
  play: PLAY_LOOK_THEME.notInstalled,
  hud: HUD_LOOK_THEME.notInstalled,
});
