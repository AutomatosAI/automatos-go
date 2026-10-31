// The dress (D-ONE-SET, PRD-001 §4.6): what the shared primitives wear in each style, so the
// Command Centre, the sheets and settings are one set of screens that look like the style chosen
// without anyone copying a screen. dressOf(resolved) answers, for the style a subtree paints: the
// panel (Studio's, Play's and Candy's cards, HUD's bracketed panels, Arcade's windows), the status
// (a dot and a word, or a glyph plus WORD), the button (radius, height, label face, case and
// tracking), the small label, the filter pill, a list's rows and rules, the radii, the sheet's top,
// the ground behind the screen, the least an edge screen's action is tall and the paints. Pure:
// src/ui reads it through useDress() (use-dress.ts) and src/ui/dressed.ts.
//
//   Studio  exactly what the foundation draws (an installed theme too: the Studio layout, D58)
//   Play    Ember: cards 14 on the surface with the ground's line, buttons 10 and 44 high in
//           Geist 600 14, chips round and 40 high, labels Geist 500 11 in capitals at .14em
//   HUD     its README: square panels with brackets, buttons square and at least 44 (46 in a
//           panel) in Geist Mono 12 capitals at .14em, labels Geist Mono 500 11 at .1em
//   Arcade  its README and design kit: every panel a square window in the look's window style,
//           glyph plus WORD statuses, buttons and chips square and at least 44 in Press Start 2P
//           capitals at its button step (12), labels at its label step (11, .1em), a chosen or
//           pressed thing in the palette's highlight with its ink, on the palette's page
//   Candy   CANDY-LAYOUT §7 and its design kit: every panel a window (the win fill, rs corners,
//           the palette's tinted shadow), section titles in Outfit 600 20, glyph and word
//           statuses, buttons, chips and segments pills at least 44 high in Nunito 800 13 (an edge
//           screen's action 50), the chosen one the accent with its ink, labels Nunito 700 14,
//           rows 52 high over 1.5 pt rules, on the palette's page

import type { FontWeight } from '../fonts';
import type { ResolvedStyle } from '../provider/resolve';
import type { Layout } from '../registry/style-id';
import type { StyleRadii } from '../tokens/radii';
import type { SpaceName } from '../tokens/types';
import { ARCADE_STEPS } from '../typeface/arcade-type';
import { CANDY_STEPS } from '../typeface/candy-type';
import { BUTTON_SIZES, PILL_HEIGHT } from '../../ui/variants';
import { GRABBER } from '../../ui/overlay';
import { MIN_TOUCH } from '../../ui/paint';
import { CANDY_LINE, candyPaints } from './candy-paints';
import {
  HAIRLINE,
  arcadePaints,
  hudPaints,
  playPaints,
  studioPaints,
  type DressPaints,
} from './paints';

export type PanelKind = 'card' | 'bracket' | 'window';
export type StatusKind = 'pip' | 'glyph';
export type GroundKind = 'plain' | 'play-glow' | 'hud-grid' | 'arcade-page' | 'candy-page';
export type LabelCase = 'as-written' | 'capitals';

/**
 * A face by its role in the style (its sans, its mono, or Arcade's pixel face, which comes only at
 * its type's own steps: typeface/arcade-type.ts) and a weight.
 */
export type DressFace = { readonly role: 'sans' | 'mono' | 'pixel'; readonly weight: FontWeight };

export type ButtonDress = {
  readonly radius: number;
  /** The least a button is tall; a button size taller than this keeps its own (Studio's 40). */
  readonly minHeight: number;
  /** The least inside a panel (HUD's 46). */
  readonly panelMinHeight: number;
  readonly labelFace: DressFace;
  /** The label's points; null: the button size's own Body level (Studio's 14 and 12). */
  readonly labelSize: number | null;
  readonly labelCase: LabelCase;
  readonly trackingEm: number;
};

/** The small label: section heads, meta lines, a status's word, a chip. */
export type LabelDress = {
  readonly face: DressFace;
  readonly size: number;
  readonly case: LabelCase;
  readonly trackingEm: number;
};

/** The filter pill; its label is the button's face, case and tracking. */
export type PillDress = {
  readonly radius: number;
  readonly minHeight: number;
  readonly paddingX: SpaceName;
  readonly restWeight: FontWeight;
  readonly selectedWeight: FontWeight;
};

/** A list's row and the rule between two (Settings' grouped cards: CANDY-LAYOUT §7). */
export type RowDress = {
  readonly minHeight: number;
  /** The rule's thickness, in the border token (Candy's line on a window). */
  readonly separatorWidth: number;
};

/**
 * A panel's header row: Studio's eyebrow, Play's label, HUD's display face at its label size,
 * Candy's section title (the scale's Title 3: Outfit 600 20).
 */
export type PanelHeaderFace = 'eyebrow' | 'label' | 'display' | 'section';

export type Dress = {
  readonly layout: Layout;
  readonly panel: PanelKind;
  readonly panelHeader: PanelHeaderFace;
  readonly status: StatusKind;
  readonly button: ButtonDress;
  readonly label: LabelDress;
  readonly pill: PillDress;
  readonly row: RowDress;
  readonly radii: StyleRadii;
  readonly sheetRadius: number;
  readonly grabberRadius: number;
  readonly ground: GroundKind;
  /** The least an edge screen's one action is tall (Candy's 50 pt pill); null: the edges' 48. */
  readonly edgeActionMinHeight: number | null;
  readonly paints: DressPaints;
};

/** Ember and HUD: Apple's 44 pt, the least a button or chip is tall. */
export const DRESS_MIN_HEIGHT = 44;
/** HUD's README: buttons inside a panel are 46 high. */
export const HUD_PANEL_BUTTON_HEIGHT = 46;
/** Ember 04's filter chips. */
export const PLAY_PILL_HEIGHT = 40;
/** CANDY-LAYOUT §7: an edge screen's primary is an accent pill 50 tall. */
export const CANDY_EDGE_ACTION_HEIGHT = 50;
/** CANDY-LAYOUT §7: Settings' rows are at least 52 tall (the design's min-height 52px). */
export const CANDY_ROW_HEIGHT = 52;

/** The foundation's rows (ListRow's 44 pt touch) and rules (Divider's 1 pt). */
const ROW: RowDress = Object.freeze({ minHeight: MIN_TOUCH, separatorWidth: HAIRLINE });

const STUDIO_BUTTON_WEIGHT: FontWeight = 500;

const STUDIO = Object.freeze({
  button: {
    minHeight: BUTTON_SIZES.sm.height,
    panelMinHeight: BUTTON_SIZES.sm.height,
    labelFace: { role: 'sans', weight: STUDIO_BUTTON_WEIGHT },
    labelSize: null,
    labelCase: 'as-written',
    trackingEm: 0,
  },
  label: { face: { role: 'mono', weight: 600 }, size: 11, case: 'capitals', trackingEm: 0.12 },
  pill: {
    minHeight: PILL_HEIGHT,
    paddingX: 'space4',
    restWeight: STUDIO_BUTTON_WEIGHT,
    selectedWeight: STUDIO_BUTTON_WEIGHT,
  },
} as const);

const PLAY = Object.freeze({
  button: {
    minHeight: DRESS_MIN_HEIGHT,
    panelMinHeight: DRESS_MIN_HEIGHT,
    labelFace: { role: 'sans', weight: 600 },
    labelSize: 14,
    labelCase: 'as-written',
    trackingEm: 0,
  },
  label: { face: { role: 'sans', weight: 500 }, size: 11, case: 'capitals', trackingEm: 0.14 },
  pill: { minHeight: PLAY_PILL_HEIGHT, paddingX: 'space7', restWeight: 500, selectedWeight: 600 },
} as const);

const HUD = Object.freeze({
  button: {
    minHeight: DRESS_MIN_HEIGHT,
    panelMinHeight: HUD_PANEL_BUTTON_HEIGHT,
    labelFace: { role: 'mono', weight: 500 },
    labelSize: 12,
    labelCase: 'capitals',
    trackingEm: 0.14,
  },
  label: { face: { role: 'mono', weight: 500 }, size: 11, case: 'capitals', trackingEm: 0.1 },
  pill: { minHeight: DRESS_MIN_HEIGHT, paddingX: 'space7', restWeight: 500, selectedWeight: 500 },
} as const);

/** Press Start 2P has one weight. */
const PIXEL_WEIGHT: FontWeight = 400;

const ARCADE = Object.freeze({
  button: {
    minHeight: DRESS_MIN_HEIGHT,
    panelMinHeight: DRESS_MIN_HEIGHT,
    labelFace: { role: 'pixel', weight: PIXEL_WEIGHT },
    labelSize: ARCADE_STEPS.button,
    labelCase: 'capitals',
    trackingEm: 0,
  },
  label: {
    face: { role: 'pixel', weight: PIXEL_WEIGHT },
    size: ARCADE_STEPS.label,
    case: 'capitals',
    trackingEm: 0.1,
  },
  // the Inventory's tabs: 44 high (--arcade-target), 16 in (inventory.module.css .tab)
  pill: {
    minHeight: DRESS_MIN_HEIGHT,
    paddingX: 'space7',
    restWeight: PIXEL_WEIGHT,
    selectedWeight: PIXEL_WEIGHT,
  },
} as const);

/** Nunito's weights for a label and for a button or chip (candy-type.ts). */
const CANDY_LABEL_WEIGHT: FontWeight = 700;
const CANDY_BUTTON_WEIGHT: FontWeight = 800;

const CANDY = Object.freeze({
  button: {
    minHeight: DRESS_MIN_HEIGHT,
    panelMinHeight: DRESS_MIN_HEIGHT,
    labelFace: { role: 'sans', weight: CANDY_BUTTON_WEIGHT },
    labelSize: CANDY_STEPS.button,
    labelCase: 'as-written',
    trackingEm: 0,
  },
  // the design's label step ('3 things need you': Nunito 700 14)
  label: {
    face: { role: 'sans', weight: CANDY_LABEL_WEIGHT },
    size: CANDY_STEPS.label,
    case: 'as-written',
    trackingEm: 0,
  },
  // the kit's filter pill (ui.module.css .pill: 40 high, 0 18px, 800), 44 high (D-A11Y)
  pill: {
    minHeight: DRESS_MIN_HEIGHT,
    paddingX: 'space8',
    restWeight: CANDY_BUTTON_WEIGHT,
    selectedWeight: CANDY_BUTTON_WEIGHT,
  },
  row: { minHeight: CANDY_ROW_HEIGHT, separatorWidth: CANDY_LINE },
} as const);

function needs<T>(vars: T | undefined, layout: Layout): T {
  if (vars === undefined) throw new Error(`a resolved ${layout} style without its variables`);
  return vars;
}

function studio(style: ResolvedStyle): Dress {
  const { radii } = style;
  return {
    layout: 'studio',
    panel: 'card',
    panelHeader: 'eyebrow',
    status: 'pip',
    button: { ...STUDIO.button, radius: radii.control },
    label: STUDIO.label,
    pill: { ...STUDIO.pill, radius: radii.pill },
    row: ROW,
    radii,
    sheetRadius: radii.sheet,
    grabberRadius: GRABBER.radius,
    ground: 'plain',
    edgeActionMinHeight: null,
    paints: studioPaints(style.tokens.colours),
  };
}

function play(style: ResolvedStyle): Dress {
  const { radii } = style;
  return {
    layout: 'play',
    panel: 'card',
    panelHeader: 'label',
    status: 'pip',
    button: { ...PLAY.button, radius: radii.control },
    label: PLAY.label,
    pill: { ...PLAY.pill, radius: radii.pill },
    row: ROW,
    radii,
    sheetRadius: radii.sheet,
    grabberRadius: GRABBER.radius,
    ground: 'play-glow',
    edgeActionMinHeight: null,
    paints: playPaints(needs(style.play, 'play'), style.tokens.colours),
  };
}

function hud(style: ResolvedStyle): Dress {
  const { radii } = style;
  return {
    layout: 'hud',
    panel: 'bracket',
    panelHeader: 'display',
    status: 'glyph',
    button: { ...HUD.button, radius: radii.control },
    label: HUD.label,
    pill: { ...HUD.pill, radius: radii.pill },
    row: ROW,
    radii,
    sheetRadius: radii.sheet,
    grabberRadius: 0, // radius 0 everywhere (its README)
    ground: 'hud-grid',
    edgeActionMinHeight: null,
    paints: hudPaints(needs(style.hud, 'hud'), style.tokens.colours),
  };
}

function arcade(style: ResolvedStyle): Dress {
  const { radii } = style;
  return {
    layout: 'arcade',
    panel: 'window',
    panelHeader: 'display',
    status: 'glyph',
    button: { ...ARCADE.button, radius: radii.control },
    label: ARCADE.label,
    pill: { ...ARCADE.pill, radius: radii.pill },
    row: ROW,
    radii,
    sheetRadius: radii.sheet,
    grabberRadius: 0, // hard edges only (README 'Pixels')
    ground: 'arcade-page',
    edgeActionMinHeight: null,
    paints: arcadePaints(needs(style.arcade, 'arcade'), needs(style.arcadeLook, 'arcade')),
  };
}

function candy(style: ResolvedStyle): Dress {
  const { radii } = style;
  return {
    layout: 'candy',
    panel: 'card',
    panelHeader: 'section',
    status: 'glyph',
    button: { ...CANDY.button, radius: radii.control },
    label: CANDY.label,
    pill: { ...CANDY.pill, radius: radii.pill },
    row: CANDY.row,
    radii,
    sheetRadius: radii.sheet,
    grabberRadius: GRABBER.radius,
    ground: 'candy-page',
    edgeActionMinHeight: CANDY_EDGE_ACTION_HEIGHT,
    paints: candyPaints(needs(style.candy, 'candy'), needs(style.candyLook, 'candy')),
  };
}

const DRESSES: Readonly<Record<Layout, (style: ResolvedStyle) => Dress>> = Object.freeze({
  studio,
  play,
  hud,
  arcade,
  candy,
});

/** What the shared primitives wear in the style this subtree paints. */
export function dressOf(style: ResolvedStyle): Dress {
  return Object.freeze(DRESSES[style.layout](style));
}

// ── HUD's corner brackets (KS12) ────────────────────────────────────────────────────────────

export type BracketBar = {
  readonly top?: 0;
  readonly bottom?: 0;
  readonly left?: 0;
  readonly right?: 0;
  readonly width: number;
  readonly height: number;
};

const CORNERS = [
  ['top', 'left'],
  ['top', 'right'],
  ['bottom', 'left'],
  ['bottom', 'right'],
] as const;

/**
 * The eight bars of four L-shapes, each length x thickness one way and thickness x length the
 * other, anchored at its corner of the panel (the drawing's background gradients, inside the
 * border).
 */
export function bracketBars(length: number, thickness: number): readonly BracketBar[] {
  return Object.freeze(
    CORNERS.flatMap(([vertical, side]): BracketBar[] => {
      const anchor = { [vertical]: 0, [side]: 0 } as Pick<
        BracketBar,
        typeof vertical | typeof side
      >;
      return [
        { ...anchor, width: length, height: thickness },
        { ...anchor, width: thickness, height: length },
      ];
    }),
  );
}
