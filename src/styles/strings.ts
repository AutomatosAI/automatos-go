// The styles' copy (one strings module per feature, §4.11): the picker's names, taglines and the
// words its cards and rows say to VoiceOver. Nothing about plans, credits or prices (D8), and no
// pointer to creating an account (D-NO-SIGNUP).

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
});
