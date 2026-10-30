// Arcade's colours on the phone (PRD-001 §4.6.1, D-ARC-3, KA3-VENDOR-PIN): the design kit's
// catalogue copied as data — the five palettes (the window, bar, text, accent, highlight and game
// colours, each pair tuned to read at AA on its ground; the shadow and bevels as the kit's rgba;
// each palette's overworld map), the sprite, icon and agent colours of its art (a bronze robot on
// the dark palettes, the four screen shades on Handheld) and the scanlines' ink and alphas. This
// directory is the only place in src/styles a colour literal may live (D-TOKENS). Pure: no React,
// React Native, Expo or Skia.
//
// Source: AutomatosAI/automatos-design-kit themes/arcade/src/looks/catalogue.ts at 034fa629c
// (034fa629c8ba79cff042559ca2d132f6d38f6d23), sha256
// 54b7406dae69c0a4c39cd015f07d318c2862009e4f4e3214ba5a368817b94dc9. Values are copied, never
// retuned: a change starts there. Only the layout is the repo's (semicolons, frozen values).

export const ARCADE_CATALOGUE_SOURCE = 'themes/arcade/src/looks/catalogue.ts';
export const ARCADE_KIT_COMMIT = '034fa629c8ba79cff042559ca2d132f6d38f6d23';

export const PALETTE_IDS = ['overworld', 'dungeon', 'neon', 'nightcity', 'handheld'] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

export type Tone = 'light' | 'dark';
export type ScanlineId = 'off' | 'soft' | 'strong';
export type ArtSet = 'bronze' | 'shades';

/** The interface colours of one palette, by the design's token names (looks.json "tokens"). */
export interface PaletteColours {
  readonly page: string;
  readonly win: string;
  readonly bar: string;
  readonly barTx: string;
  readonly tx: string;
  readonly tx2: string;
  readonly bd: string;
  readonly ac: string;
  readonly aci: string;
  readonly hl: string;
  readonly hlt: string;
  readonly hp: string;
  readonly xp: string;
  readonly mp: string;
  readonly qs: string;
  readonly sh: string;
  readonly bevl: string;
  readonly bevd: string;
}

export interface MapColours {
  readonly g1: string;
  readonly g2: string;
  readonly t1: string;
  readonly t2: string;
  readonly w1: string;
  readonly w2: string;
  readonly p1: string;
  readonly p2: string;
  readonly r1: string;
  readonly r2: string;
  readonly sn: string;
  readonly roof: string;
  readonly wall: string;
}

export interface Palette {
  readonly id: PaletteId;
  readonly name: string;
  /** The preset's one line under its name. */
  readonly sub: string;
  readonly tone: Tone;
  /** The scanlines the palette's preset starts with. */
  readonly scanlines: ScanlineId;
  readonly art: ArtSet;
  readonly colours: PaletteColours;
  readonly map: MapColours;
}

export const PALETTES: readonly Palette[] = Object.freeze<Palette[]>([
  {
    id: 'overworld', name: 'Overworld', sub: 'Night forest, grass-green accent', tone: 'dark', scanlines: 'soft', art: 'bronze',
    colours: {
      page: '#0D1710', win: '#15291B', bar: '#0A120C', barTx: '#EEE7D2', tx: '#EEE7D2', tx2: '#BCC7A9', bd: '#D9CFA8',
      ac: '#7FE35C', aci: '#0B1A07', hl: '#7FE35C', hlt: '#0B1A07', hp: '#FF6E61', xp: '#FFD24A', mp: '#74BDFF', qs: '#FFE34D',
      sh: 'rgba(0,0,0,.55)', bevl: 'rgba(255,255,255,.14)', bevd: 'rgba(0,0,0,.45)',
    },
    map: {
      g1: '#2F5A2A', g2: '#3E7136', t1: '#1F4A22', t2: '#143318', w1: '#2A5C8A', w2: '#6FA6D6', p1: '#8A6A3E', p2: '#6B4F2A',
      r1: '#6E6A5E', r2: '#4A463E', sn: '#E8E4D4', roof: '#B5502E', wall: '#D9CFA8',
    },
  },
  {
    id: 'dungeon', name: 'Dungeon', sub: 'Stone and purple, torch-orange accent', tone: 'dark', scanlines: 'soft', art: 'bronze',
    colours: {
      page: '#110C1A', win: '#1D1530', bar: '#0B0812', barTx: '#EDE7F6', tx: '#EDE7F6', tx2: '#B8AECD', bd: '#BDB4CC',
      ac: '#FF9B3D', aci: '#1C0B00', hl: '#FF9B3D', hlt: '#1C0B00', hp: '#FF7070', xp: '#FFD04A', mp: '#86B6FF', qs: '#FFE24D',
      sh: 'rgba(0,0,0,.6)', bevl: 'rgba(255,255,255,.12)', bevd: 'rgba(0,0,0,.5)',
    },
    map: {
      g1: '#2A2238', g2: '#352B47', t1: '#4A3D5E', t2: '#2E2540', w1: '#3B2A6B', w2: '#8A72D6', p1: '#6A5E72', p2: '#4E4456',
      r1: '#5E5868', r2: '#3C3746', sn: '#BDB4CC', roof: '#FF9B3D', wall: '#BDB4CC',
    },
  },
  {
    id: 'neon', name: 'Neon Cabinet', sub: 'Magenta and cyan, strong scanlines', tone: 'dark', scanlines: 'strong', art: 'bronze',
    colours: {
      page: '#050507', win: '#0E0B16', bar: '#000000', barTx: '#F3EFFF', tx: '#F3EFFF', tx2: '#BDB5DA', bd: '#FF52D9',
      ac: '#3FF2FF', aci: '#00181A', hl: '#3FF2FF', hlt: '#00181A', hp: '#FF5E7C', xp: '#FFD84A', mp: '#76ACFF', qs: '#FFF04D',
      sh: 'rgba(255,82,217,.28)', bevl: 'rgba(63,242,255,.18)', bevd: 'rgba(0,0,0,.6)',
    },
    map: {
      g1: '#0B0A14', g2: '#1A1530', t1: '#3A1050', t2: '#FF52D9', w1: '#062A33', w2: '#3FF2FF', p1: '#2A2540', p2: '#4A3F70',
      r1: '#251E3A', r2: '#14102A', sn: '#3FF2FF', roof: '#FF52D9', wall: '#3FF2FF',
    },
  },
  {
    id: 'nightcity', name: 'Night City', sub: 'Navy rain, sodium-amber accent', tone: 'dark', scanlines: 'soft', art: 'bronze',
    colours: {
      page: '#0A1024', win: '#121B39', bar: '#070B1A', barTx: '#EAF0FA', tx: '#EAF0FA', tx2: '#AFBCD7', bd: '#9FB8E2',
      ac: '#FFB547', aci: '#1E1200', hl: '#FFB547', hlt: '#1E1200', hp: '#FF6F6F', xp: '#FFD25A', mp: '#80B8FF', qs: '#FFE45C',
      sh: 'rgba(0,0,0,.6)', bevl: 'rgba(255,216,107,.14)', bevd: 'rgba(0,0,0,.5)',
    },
    map: {
      g1: '#16213F', g2: '#1C2A50', t1: '#24345E', t2: '#101831', w1: '#0C1A3A', w2: '#5E86C4', p1: '#3A4466', p2: '#2A3352',
      r1: '#2B3658', r2: '#1A2342', sn: '#AFBCD7', roof: '#FFB547', wall: '#FFD86B',
    },
  },
  {
    id: 'handheld', name: 'Handheld', sub: 'Four shades of an olive screen', tone: 'light', scanlines: 'soft', art: 'shades',
    colours: {
      page: '#C9D4A3', win: '#DCE5B8', bar: '#1E2612', barTx: '#DCE5B8', tx: '#1E2612', tx2: '#3F4B22', bd: '#1E2612',
      ac: '#1E2612', aci: '#DCE5B8', hl: '#1E2612', hlt: '#DCE5B8', hp: '#8E1F14', xp: '#6A4A00', mp: '#1E3F7E', qs: '#5C4700',
      sh: '#9AAA6A', bevl: 'rgba(255,255,255,.35)', bevd: 'rgba(30,38,18,.25)',
    },
    map: {
      g1: '#C9D4A3', g2: '#9AAA6A', t1: '#4E5C2C', t2: '#1E2612', w1: '#9AAA6A', w2: '#DCE5B8', p1: '#DCE5B8', p2: '#9AAA6A',
      r1: '#4E5C2C', r2: '#1E2612', sn: '#DCE5B8', roof: '#1E2612', wall: '#9AAA6A',
    },
  },
]);

/** Auto's sprite colours: each key is a pixel kind the sprite engine draws (src/mascot/sprite.ts). */
export const SPRITE_KEYS = ['o', 's', 'h', 'd', 'v', 'v2', 'e', 'e2', 'c', 'c2', 'w', 'k', 'b', 'q', 'g'] as const;
export type SpriteKey = (typeof SPRITE_KEYS)[number];

export const SPRITE_COLOURS: Readonly<Record<ArtSet, Readonly<Record<SpriteKey, string>>>> = Object.freeze({
  bronze: {
    o: '#1A0F0A', s: '#D86A2B', h: '#F6A257', d: '#9A4317', v: '#16212B', v2: '#33485A', e: '#6EF5C4', e2: '#3A9C7C',
    c: '#C9CED6', c2: '#7E858F', w: '#FFFFFF', k: '#FFD24A', b: '#9ED8FF', q: '#FFE34D', g: '#00000059',
  },
  shades: {
    o: '#1E2612', s: '#5C6B33', h: '#8E9E5A', d: '#3A4520', v: '#1E2612', v2: '#3A4520', e: '#DCE5B8', e2: '#9AAA6A',
    c: '#9AAA6A', c2: '#4E5C2C', w: '#DCE5B8', k: '#1E2612', b: '#4E5C2C', q: '#1E2612', g: '#1E261240',
  },
});

/** The item icons' colours (src/art/icons.ts). */
export const ICON_KEYS = ['o', 'paper', 'shade', 'line', 'blue', 'red', 'gold', 'green'] as const;
export type IconKey = (typeof ICON_KEYS)[number];

export const ICON_COLOURS: Readonly<Record<ArtSet, Readonly<Record<IconKey, string>>>> = Object.freeze({
  bronze: { o: '#1A1410', paper: '#F1E7CC', shade: '#00000059', line: '#6B5A40', blue: '#74BDFF', red: '#FF6E61', gold: '#FFD24A', green: '#5FB54A' },
  shades: { o: '#1E2612', paper: '#DCE5B8', shade: '#1E261240', line: '#4E5C2C', blue: '#9AAA6A', red: '#3A4520', gold: '#5C6B33', green: '#4E5C2C' },
});

/** The party's four robot colours, a body and its shade, picked by an agent's place in the roster. */
export const AGENT_COLOURS: Readonly<Record<ArtSet, readonly (readonly [string, string])[]>> = Object.freeze({
  bronze: [['#4FA3E0', '#2A6A9E'], ['#E0C04F', '#9E8424'], ['#D9608C', '#963A5C'], ['#7CC27A', '#46864A']],
  shades: [['#8E9E5A', '#4E5C2C'], ['#9AAA6A', '#3A4520'], ['#5C6B33', '#3A4520'], ['#8E9E5A', '#3A4520']],
} as const);

/** The scanlines' ink: black on the dark palettes, the darkest screen shade on Handheld. */
export const SCAN_INK: Readonly<Record<Tone, string>> = Object.freeze({ dark: '0,0,0', light: '30,38,18' });

/**
 * How dark each scanline style draws, by the palette's tone. The lines sit behind the text (a window's background),
 * so on a dark palette they only deepen the ground; on Handheld they darken a light ground under dark text, so
 * Strong draws thicker lines at Soft's strength and every text pair keeps AA.
 */
export const SCAN_ALPHA: Readonly<Record<Tone, Readonly<Record<ScanlineId, number>>>> = Object.freeze({
  dark: { off: 0, soft: 0.14, strong: 0.32 },
  light: { off: 0, soft: 0.14, strong: 0.14 },
});

export function paletteById(id: string): Palette | undefined {
  return PALETTES.find((palette) => palette.id === id);
}
