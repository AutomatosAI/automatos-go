// Candy's colours on the phone (PRD-001 §4.6.2, D-CAN-9, KA3-VENDOR-PIN): the design kit's
// catalogue copied as data — the three palettes (the page, the band behind the top of each view,
// the windows, chips, text, accent and the user's bubble, each pair tuned to read at AA on its
// ground), the three card gradients every palette shares in its own order, the see-through layers
// over a card, the frame's and the orb's whites and pinks, Auto's own colours and each Deliverable
// kind's card. This directory is the only place in src/styles a colour literal may live
// (D-TOKENS). Pure: no React, React Native, Expo or Skia.
//
// Source: AutomatosAI/automatos-design-kit themes/candy/src/looks/catalogue.ts at 3920359d5
// (3920359d5350960471aca1b7111f6243be537cc0), sha256
// 05b498b1757afc762eac8d16be0bba4c33be829fcf98668730a0b0448975fc90. Values are copied, never
// retuned: a change starts there. Only the layout is the repo's (semicolons, frozen values).
//
// The kit's own note: two start stops differ from the handoff — its pink #D93A7E and blue #2878D8
// hold white text at 4.32:1 and 4.40:1, under the 4.5:1 a 13 px label needs, so each is darkened
// by the least that reaches AA (#D73178, #2675D3). Everything else is the design's.

export const CANDY_CATALOGUE_SOURCE = 'themes/candy/src/looks/catalogue.ts';
export const CANDY_KIT_COMMIT = '3920359d5350960471aca1b7111f6243be537cc0';

export const PALETTE_IDS = ['blush', 'lilac', 'nightbloom'] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

export type Tone = 'light' | 'dark';
export type CardSetId = 'pink' | 'violet' | 'blue';

/** One card gradient: its start (a), its middle (b) and the next hue it blends into on Rich and Vivid (c). */
export interface CardSet {
  readonly id: CardSetId;
  readonly a: string;
  readonly b: string;
  readonly c: string;
}

export const CARD_SETS: Readonly<Record<CardSetId, CardSet>> = Object.freeze({
  pink: Object.freeze({ id: 'pink', a: '#D73178', b: '#B01E5F', c: '#9C3BD0' }),
  violet: Object.freeze({ id: 'violet', a: '#8E4AE8', b: '#5B2BCB', c: '#3557D8' }),
  blue: Object.freeze({ id: 'blue', a: '#2675D3', b: '#0F5DAE', c: '#0B8FB0' }),
});

/** White: the text on every card, and the base of every highlight. */
export const CARD_INK = '#FFFFFF';

/** The interface colours of one palette, by the design's token names. */
export interface PaletteColours {
  /** The page. */
  readonly page: string;
  /** The band's two stops on Soft. */
  readonly bandA: string;
  readonly bandB: string;
  /** The band's three stops on Rich and Vivid. */
  readonly band1: string;
  readonly band2: string;
  readonly band3: string;
  /** Windows and cards. */
  readonly win: string;
  /** The quiet fill of chips, Auto's bubbles and inactive avatars. */
  readonly chip: string;
  readonly text: string;
  /** Quiet text: meta lines, captions. */
  readonly quiet: string;
  /** Hairlines and inactive rings, as the design draws them (see-through). */
  readonly line: string;
  /** The hairline on a window, opaque: Studio's border and input tokens. */
  readonly border: string;
  /** Quiet text on the band (the date over the greeting): quiet, darkened where the band is deeper than the page. */
  readonly bandQuiet: string;
  readonly accent: string;
  readonly accentInk: string;
  /** The accent as text on the page and on windows (links, "Open"): the accent itself where it reads at AA. */
  readonly accentText: string;
  /** The user's bubble: a gradient from userA to userB (one colour on Night bloom), and its text. */
  readonly userA: string;
  readonly userB: string;
  readonly userInk: string;
  /** The state pill on Auto's violet stage: its text on a white pill. */
  readonly stageInk: string;
  /** The shadow's tint, as `r,g,b`: the glow's colour. */
  readonly tint: string;
  /** The three aura blobs of Vivid. */
  readonly blobs: readonly [string, string, string];
}

export interface Palette {
  readonly id: PaletteId;
  readonly name: string;
  /** The preset's one line under its name. */
  readonly sub: string;
  readonly tone: Tone;
  /** The card gradients in this palette's order: the first is One colour's. */
  readonly order: readonly [CardSetId, CardSetId, CardSetId];
  readonly colours: PaletteColours;
}

export const PALETTES: readonly Palette[] = Object.freeze<Palette[]>([
  {
    id: 'blush', name: 'Blush', sub: 'Pink on white, mixed cards', tone: 'light', order: ['pink', 'violet', 'blue'],
    colours: {
      page: '#FBF0F4', bandA: '#FFD9E8', bandB: '#FFC2DA', band1: '#FFC6E0', band2: '#F2C9FF', band3: '#FFD9C2',
      win: '#FFFFFF', chip: '#FCE8F1', text: '#2A1830', quiet: '#6E5670', line: 'rgba(42,24,48,.09)', border: '#ECEAEC', bandQuiet: '#634B65', accent: '#D62F7A',
      accentInk: '#FFFFFF', accentText: '#C2266C', userA: '#D73178', userB: '#B01E5F', userInk: '#FFFFFF',
      stageInk: '#4A1E8E', tint: '214,47,122', blobs: ['#F9C6E4', '#FFE0C7', '#E5D4FF'],
    },
  },
  {
    id: 'lilac', name: 'Lilac', sub: 'Violet into blue, airy', tone: 'light', order: ['violet', 'blue', 'pink'],
    colours: {
      page: '#F3F1FF', bandA: '#E2DCFF', bandB: '#D3E3FF', band1: '#D9CCFF', band2: '#C9DBFF', band3: '#F6D2F0',
      win: '#FFFFFF', chip: '#EEEAFF', text: '#1E1A3E', quiet: '#5B5680', line: 'rgba(30,26,62,.09)', border: '#ECEAEE', bandQuiet: '#5B5680', accent: '#5B35D5',
      accentInk: '#FFFFFF', accentText: '#5B35D5', userA: '#8E4AE8', userB: '#5B2BCB', userInk: '#FFFFFF',
      stageInk: '#4A1E8E', tint: '91,53,213', blobs: ['#DCD0FF', '#CFE8FF', '#FFD9EE'],
    },
  },
  {
    id: 'nightbloom', name: 'Night bloom', sub: 'Neon pinks after dark', tone: 'dark', order: ['pink', 'violet', 'blue'],
    colours: {
      page: '#150B1F', bandA: '#43123F', bandB: '#2A1250', band1: '#5A1450', band2: '#3A1670', band3: '#16335E',
      win: '#22142F', chip: '#352040', text: '#FBEFFA', quiet: '#CDB3D4', line: 'rgba(255,255,255,.1)', border: '#382C44', bandQuiet: '#CDB3D4', accent: '#FF6FB5',
      accentInk: '#2A0618', accentText: '#FF6FB5', userA: '#FF6FB5', userB: '#FF6FB5', userInk: '#2A0618',
      stageInk: '#4A1E8E', tint: '255,80,170', blobs: ['#5A1856', '#1E2B66', '#3E1460'],
    },
  },
]);

/** Studio's destructive token, which Candy's design has no colour for: a red that reads on each tone's grounds. */
export const DANGER: Readonly<Record<Tone, { readonly fill: string; readonly ink: string }>> = Object.freeze({
  light: Object.freeze({ fill: '#C02436', ink: '#FFFFFF' }),
  dark: Object.freeze({ fill: '#FF7A88', ink: '#2A0618' }),
});

/** The see-through layers over a card's gradient: the white highlight (Soft and Rich, then Vivid's brighter one),
 * and Vivid's pink and cyan corner glows. */
export const LAYER_COLOURS = Object.freeze({
  highlight: 'rgba(255,255,255,.34)',
  highlightVivid: 'rgba(255,255,255,.5)',
  glowPink: 'rgba(255,170,210,.4)',
  glowCyan: 'rgba(90,230,255,.35)',
} as const);

/** The see-through whites and the pinks the frame and the orb draw with, on every palette: a back circle on a card
 * (22%), an active menu dot's ring (28%), the orb's rings and glow (45%, 55%, 92%), its gloss and its pink blush, the
 * orb's fourth hue, and the shadow under a big white figure. Painted as --candy-<name> (prepaint.ts). */
export const SHARED_COLOURS = Object.freeze({
  white22: 'rgba(255,255,255,.22)',
  white28: 'rgba(255,255,255,.28)',
  white55: 'rgba(255,255,255,.55)',
  white85: 'rgba(255,255,255,.85)',
  white12: 'rgba(255,255,255,.12)',
  white45: 'rgba(255,255,255,.45)',
  white92: 'rgba(255,255,255,.92)',
  orbBlush: 'rgba(255,190,220,.55)',
  orbPink: '#FF9BC8',
  figureShadow: 'rgba(70,0,60,.45)',
} as const);

/** Auto's colours (the concept's glossy body, visor, eyes, cheeks and antenna): the same on every palette. */
export const AUTO_COLOURS = Object.freeze({
  bodyA: '#FFA9CE',
  bodyB: '#E86DB8',
  bodyC: '#9A5CF0',
  gloss: '#FFFFFF',
  cyan: '#78CDFF',
  shade: '#5A1478',
  visorA: '#3A1A4E',
  visorB: '#24102F',
  eye: '#FFF3FB',
  eyeGlow: '#FFB3E0',
  cheek: '#FF78AA',
  stalk: '#C9A3D9',
  ballA: '#FFB3D4',
  ballB: '#B266F2',
  ballGlow: '#FF78BE',
} as const);

export type AutoColour = keyof typeof AUTO_COLOURS;

/** A Deliverable's tile colour by its kind (the design's W3 and P3): report and slides pink, document and
 * spreadsheet violet, image and blog post blue, by the host's kind ids too (slide, blog_post). Any other kind takes
 * the first card. */
export const KIND_SETS: Readonly<Record<string, 1 | 2 | 3>> = Object.freeze({
  report: 1,
  slides: 1,
  slide: 1,
  document: 2,
  spreadsheet: 2,
  image: 3,
  blog: 3,
  blog_post: 3,
});

export function paletteById(id: string): Palette | undefined {
  return PALETTES.find((palette) => palette.id === id);
}
