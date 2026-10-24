// The styles' copy (one strings module per feature, §4.11): the picker's names, taglines and the
// words its cards and rows say to VoiceOver. Nothing commercial (D8), and nothing that points at
// making an account (D63).

import type { ThemeChoice } from './theme-choice';
import type { BuiltInStyleId } from './registry/style-id';

/** Each built-in style's name and the line under it in the picker (PRD-001 §4.6). */
export const STYLE_COPY = Object.freeze({
  names: Object.freeze<Record<BuiltInStyleId, string>>({
    studio: 'Studio',
    play: 'Play',
    hud: 'HUD',
  }),
  taglines: Object.freeze<Record<BuiltInStyleId, string>>({
    studio: 'Cream paper or Studio Dark',
    play: 'Auto and the Ember look',
    hud: 'Voice first, glow and grid',
  }),
});

/** The Style and look screen (US-016h): the word on the chosen card is never colour alone. */
export const PICKER_COPY = Object.freeze({
  selected: 'Selected',
  /** VoiceOver's name for a style card: 'Studio style, selected'. */
  styleLabel: (name: string, selected: boolean) =>
    selected ? `${name} style, selected` : `${name} style`,
  /** An installed theme's row under Studio: 'Harbour · 1.1.0'. */
  themeTitle: (name: string, version: string) => `${name} · ${version}`,
  /** VoiceOver's name for that row: 'Harbour theme, version 1.1.0, selected'. */
  themeLabel: (name: string, version: string, selected: boolean) =>
    selected ? `${name} theme, version ${version}, selected` : `${name} theme, version ${version}`,
  /** The link from a style card to its look page (Studio's look is the scheme, on its card). */
  lookLinks: Object.freeze({ play: 'Make it yours', hud: 'Looks' }),
  /** Studio's Light / Dark / System control and its name for VoiceOver. */
  schemes: Object.freeze<Record<ThemeChoice, string>>({
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  }),
  schemeGroup: 'Studio appearance',
  /** The screen's header (Settings → Style and look). */
  eyebrow: 'Settings',
  title: 'Style and look',
  back: 'Back',
  /** After a look link's words on screen ('Make it yours →'); VoiceOver hears the words alone. */
  linkArrow: '→',
  /** What a card does and where its look link goes, for VoiceOver. */
  styleHint: (name: string) => `Paints Automatos Go in ${name}`,
  lookHint: (name: string) => `Opens ${name}'s looks`,
});

/**
 * The live previews on the picker's cards (US-016h): sample words in each style's own layout,
 * hidden from VoiceOver (the card says its name and state). Play's tool line and HUD's chip take
 * their words from the vendored labels and captions, so they read as the real screens do.
 */
export const PREVIEW_COPY = Object.freeze({
  studio: Object.freeze({
    wordmark: 'automatos',
    needs: 'NEEDS YOU · 2',
    needTitle: 'Approve the launch plan',
    needMeta: 'Mission · 2 min ago',
  }),
  play: Object.freeze({
    /** Ember's status word beside Auto ('Searching.'), for Auto at rest. */
    status: 'Ready.',
    /** The sample call Play's tool chip describes (the vendored toolLineLabel words it). */
    toolName: 'platform_web_search',
    toolSummary: '3 results',
  }),
  hud: Object.freeze({
    brand: 'AUTOMATOS',
    brandMark: '//',
  }),
});

/**
 * HUD's looks (US-018a; the Looks drawer is US-018c): each knob's label as the look schema carries
 * it, the status line's mark and the name 'Save as new look' gives, in HUD's capitals as the HUD
 * drawing writes them ('ARC · EDITED', 'MINE 2').
 */
export const HUD_LOOK_COPY = Object.freeze({
  knobs: Object.freeze({
    ground: 'Background',
    accent: 'Accent',
    font: 'Type',
    grid: 'Grid',
    glow: 'Glow',
    scan: 'Scanlines',
    auto: 'Auto',
    motion: 'Motion',
  }),
  /** The status line of a look changed since it was picked: 'ARC · EDITED'. */
  edited: (name: string) => `${name} · EDITED`,
  /** A look saved with 'Save as new look': 'MINE 1', 'MINE 2'. */
  savedName: (n: number) => `MINE ${n}`,
});
