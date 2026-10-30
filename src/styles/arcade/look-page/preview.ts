// The Options page's PREVIEW window, pure (the design kit's looks/look-preview.tsx at 034fa629c):
// its title names the palette, Auto celebrates beside a line typing at the look's text speed (a new
// speed types it again), the four game colours each a swatch and a word in its colour, a selected
// and a plain menu item, and the accent on the page ground. Drawn in the look being edited, so a
// change shows here as it shows everywhere. Pure: no React, React Native, Expo or Skia.

import type { MascotName } from '../../../core/frozen/lib/mascot/types';
import { ARCADE_OPTIONS_COPY } from '../../strings';
import { paletteById } from '../../tokens/arcade-catalogue';
import type { ArcadeLook } from '../look-schema';

const said = ARCADE_OPTIONS_COPY.preview;

/** Auto in the preview: celebrating, as the kit's. */
export const PREVIEW_STATE: MascotName = 'celebrate';

/** look-preview.tsx's numbers on the phone, in pt: the say box, the swatches, the menu items. */
export const OPTIONS_PREVIEW = Object.freeze({
  gap: 14,
  sayGap: 12,
  sayPad: 12,
  ring: 2,
  lineSize: 17,
  /** The line keeps this much width beside Auto, or wraps under him. */
  lineMin: 120,
  /** Its room in lines from the start, so the window does not grow as it types (3em). */
  lineRows: 3,
  swatch: 12,
  swatchRing: 1,
  swatchGap: 6,
  colourGap: 12,
  itemGap: 4,
  itemPadH: 12,
  itemSize: 17,
  cursorWidth: 16,
  accentPadV: 10,
});

/** The game colours by the palette's variable names, in the kit's order. */
export const GAME_TONES = Object.freeze(['hp', 'xp', 'mp', 'qs'] as const);
export type GameTone = (typeof GAME_TONES)[number];

export type GameColour = { readonly tone: GameTone; readonly word: string };

export function gameColours(): readonly GameColour[] {
  return Object.freeze(
    GAME_TONES.map((tone) => Object.freeze({ tone, word: said.gameColours[tone] })),
  );
}

/** 'Preview · Night City': the look's palette, else its own name. */
export function previewTitle(look: Pick<ArcadeLook, 'palette' | 'name'>): string {
  return said.title(paletteById(look.palette)?.name ?? look.name);
}

/** The typed line's id: a new text speed types it again from the start (look-preview.tsx). */
export function previewTypingId(look: Pick<ArcadeLook, 'textSpeed'>): string {
  return `preview-${look.textSpeed}`;
}

/** What VoiceOver hears for the preview, once and whole: its title, then the line. */
export function previewLabel(look: Pick<ArcadeLook, 'palette' | 'name'>): string {
  return `${previewTitle(look)}. ${said.line}`;
}
