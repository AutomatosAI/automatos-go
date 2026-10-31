// Make it sweet (US-023m, D-CAN-3; the kit's looks/look-editor.tsx, look-presets.tsx,
// look-preview.tsx and look-transfer.tsx at 3920359d5, laid out for the phone by CANDY-LAYOUT §5),
// pure: the page's measures; the three presets as cards and the person's saved looks after them,
// one of them checked (the look Candy paints, by its id: a preset stays checked while it is being
// edited); what Save look and Reset say after ('Saved as My look 2.', 'Back to Blush.'), or why a
// change was refused or not kept; the sheet a long press on a saved look opens, in Candy's words
// (Rename, Delete); and the preview's sample cards. The changes themselves are US-023c's
// (candy-looks.ts); the page hands each to the style store, which repaints Candy at once, keeps it
// on the phone and lets the look sync send it. Pure: no React, React Native, Expo or Skia.

import { refusalCopy } from '../../play/look-page';
import type { LookSheetCopy } from '../../play/look-page/LookSheet';
import { PLAY_LOOK_COPY } from '../../strings';
import type { CandySetIndex } from '../../tokens/candy-paint';
import { resetLook, type CandyLooks, type CandyLooksChange } from '../candy-looks';
import { CANDY_DEFAULT_LOOK, CANDY_PRESET_LOOKS, type CandyLook } from '../look-schema';
import { CANDY_SWEET_COPY, CANDY_TODAY_COPY } from '../strings';

const said = CANDY_SWEET_COPY;

/** The page's measures, in points (the 390 frames' gutters, the kit's 38 px swatches). */
export const SWEET_PAGE = Object.freeze({
  pageGap: 24,
  headGap: 8,
  sectionGap: 12,
  preset: Object.freeze({
    gap: 10,
    minWidth: 96,
    picture: 56,
    inset: 6,
    pad: 10,
    ring: 2,
    line: 2,
  }),
  saved: Object.freeze({ gap: 8 }),
  swatch: Object.freeze({ size: 38, ring: 2, gap: 12 }),
  segment: Object.freeze({ gap: 8 }),
  row: Object.freeze({ gap: 10, padV: 12 }),
  preview: Object.freeze({
    band: 132,
    pad: 16,
    gap: 14,
    auto: 84,
    bubble: Object.freeze({ padH: 14, padV: 10 }),
    card: Object.freeze({ gap: 10, minWidth: 92, minHeight: 96, pad: 12 }),
  }),
  foot: Object.freeze({ gap: 10 }),
});

/** A look the page lists: a preset's card or a saved look's pill. */
export type LookItem = {
  readonly look: CandyLook;
  /** Candy paints this look now (the radio's checked state, and the ✓). */
  readonly selected: boolean;
  /** What VoiceOver hears: 'Blush, Pink on white, mixed cards'. */
  readonly label: string;
};

function itemOf(look: CandyLook, activeId: string): LookItem {
  return Object.freeze({
    look,
    selected: look.id === activeId,
    label: said.look(look.name, look.sub),
  });
}

/** The three presets (spec.ts PRESETS, the default first). */
export function presetItems(looks: CandyLooks): readonly LookItem[] {
  return Object.freeze(CANDY_PRESET_LOOKS.map((look) => itemOf(look, looks.active.id)));
}

/** The person's saved looks, in the order they were saved; empty when there are none. */
export function savedItems(looks: CandyLooks): readonly LookItem[] {
  return Object.freeze(looks.saved.map((look) => itemOf(look, looks.active.id)));
}

/** What the last action did, in words: a status for a success, an alert for a refusal. */
export type SweetSaid = { readonly kind: 'done' | 'failed'; readonly text: string };

export function done(text: string): SweetSaid {
  return Object.freeze({ kind: 'done', text });
}

export function failed(text: string): SweetSaid {
  return Object.freeze({ kind: 'failed', text });
}

/** Save look's words: 'Saved as My look 2.', or why the phone saved no more. */
export function savedSaid(change: CandyLooksChange): SweetSaid {
  return change.ok
    ? done(said.savedAs(change.looks.active.name))
    : failed(refusalCopy(change.reason));
}

/** Reset's words: 'Back to Blush.', the palette's preset it goes back to. */
export function resetSaid(looks: CandyLooks): SweetSaid {
  return done(said.backTo(resetLook(looks).active.name));
}

/** A change the phone could not keep (the store refused it): it lasts until the app closes. */
export const NOT_KEPT: SweetSaid = failed(PLAY_LOOK_COPY.notKept);

/** How long Auto celebrates a save in the preview (look-editor.tsx CELEBRATE_MS: a one-shot). */
export const CELEBRATE_MS = 2400;

/** The sheet a long press on a saved look opens, in Candy's words: Rename and Delete. */
export const CANDY_SHEET_COPY: LookSheetCopy = Object.freeze({
  sheet: PLAY_LOOK_COPY.sheet,
  renamed: PLAY_LOOK_COPY.renamed,
  duplicated: PLAY_LOOK_COPY.duplicated,
  deleted: said.deleted,
  refusal: refusalCopy,
  backTo: CANDY_DEFAULT_LOOK.name,
});

/** One of the preview's cards: its gradient, its label and a sample figure (look-preview.tsx). */
export type PreviewCard = {
  readonly set: CandySetIndex;
  readonly label: string;
  readonly figure: string;
};

const stats = CANDY_TODAY_COPY.stats;

/** look-preview.tsx PREVIEW_CARDS: three of Today's cards, with numbers that aren't real. */
export const PREVIEW_CARDS: readonly PreviewCard[] = Object.freeze([
  Object.freeze({ set: 1, label: stats.working, figure: '4' }),
  Object.freeze({ set: 2, label: stats.needs, figure: '3' }),
  Object.freeze({ set: 3, label: stats.queue, figure: '9' }),
]);
