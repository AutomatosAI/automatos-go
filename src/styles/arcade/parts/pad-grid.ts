// The D-pad, pure (PRD-001 §4.6.1 D-ARC-6; README 'Pages'; the design kit's frame/controls.tsx
// and handheld.module.css at 034fa629c, sha256
// 23ec9185a837346b716524c8321d084311e66b6b823804e027886952fac12c31 and
// a07d3dc8e22345ac605c3842800f7dbe779e0408c1a0cf7301d5058f56d263e9): four named targets in a
// 3 × 3 grid of 64 pt cells, ▲ Quests over the hub, ◀ Chat and ▶ Inventory beside it, ▼ Menu
// under it, the corners empty. The current page's target is selected (and Menu's while the menu
// is open); every cell grows with Dynamic Type, so the word inside keeps its room. The word is
// Pixelify Sans at 11 pt (typeface/arcade-type.ts ARCADE_PAD_WORD): the design's 13 px does not
// fit 'Inventory' (5.17 em in Pixelify Sans Regular, 67 pt at 13) inside a cell's 60 pt between
// its 2 pt borders, and D38 floors it at 11. Pure: no React, React Native, Expo or Skia.

export const DPAD_IDS = Object.freeze(['quests', 'chat', 'inventory', 'menu'] as const);
export type DPadId = (typeof DPAD_IDS)[number];

/** A grid cell: a target, the hub in the middle or an empty corner. */
export type DPadCell = DPadId | 'hub' | null;

/** The 3 × 3 grid, row by row (controls.tsx's grid areas). */
export const DPAD_GRID: readonly (readonly DPadCell[])[] = Object.freeze([
  Object.freeze([null, 'quests', null] as const),
  Object.freeze(['chat', 'hub', 'inventory'] as const),
  Object.freeze([null, 'menu', null] as const),
]);

/** handheld.module.css: 64 px cells, a 2 px ring, 4 px between arrow and word, a 2 px press. */
export const DPAD_METRICS = Object.freeze({ cell: 64, ring: 2, gap: 4, press: 2 });

/** A cell's side: 64 pt, grown by the phone's text size so its word keeps its room. */
export function padSide(fontScale: number): number {
  const scale = Number.isFinite(fontScale) && fontScale > 1 ? fontScale : 1;
  return Math.round(DPAD_METRICS.cell * scale);
}

/** What VoiceOver hears of a target: selected for the page on screen, expanded for an open menu. */
export type PadState = {
  readonly selected: boolean;
  readonly expanded?: boolean;
};

export function padState(id: DPadId, current: DPadId | null, menuOpen: boolean): PadState {
  if (id === 'menu') return Object.freeze({ selected: menuOpen, expanded: menuOpen });
  return Object.freeze({ selected: !menuOpen && current === id });
}
