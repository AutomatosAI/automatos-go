// The built-in styles in the picker's order (PRD-001 §4.6, D54-D56): what each is called, the
// layout it paints, the look page it opens and when Auto is on screen. The phone starts on Studio.

import { STYLE_COPY } from '../strings';
import { builtinChoice, type BuiltInStyleId, type Layout, type StyleChoice } from './style-id';

/**
 * Studio's look is Light / Dark / System; Play's is 'Make it yours'; HUD's the Looks drawer;
 * Arcade's is Options.
 */
export type LookPage = 'scheme' | 'play' | 'hud' | 'arcade';

/**
 * When the style shows Auto (D-MASCOT): Studio never draws it (an installed theme that brings a
 * mascot is the theme's, US-016i), Play always does, HUD when the look's auto knob is on. Arcade's
 * rule is 'never': it draws its own Auto, the pixel sprite (D-ARC-5), so the bundled stage never
 * shows in it.
 */
export type MascotRule = 'never' | 'always' | 'look';

export type StyleEntry = {
  readonly id: BuiltInStyleId;
  readonly name: string;
  readonly tagline: string;
  readonly layout: Layout;
  readonly lookPage: LookPage;
  readonly mascot: MascotRule;
};

function entry(id: BuiltInStyleId, lookPage: LookPage, mascot: MascotRule): StyleEntry {
  return Object.freeze({
    id,
    name: STYLE_COPY.names[id],
    tagline: STYLE_COPY.taglines[id],
    layout: id,
    lookPage,
    mascot,
  });
}

export const STYLE_REGISTRY: readonly StyleEntry[] = Object.freeze([
  entry('studio', 'scheme', 'never'),
  entry('play', 'play', 'always'),
  entry('hud', 'hud', 'look'),
  entry('arcade', 'arcade', 'never'),
]);

/** A new phone, and anything the store cannot read, is on Studio (PRD-001 §4.6). */
export const DEFAULT_CHOICE: StyleChoice = builtinChoice('studio');

export function styleEntry(id: BuiltInStyleId): StyleEntry {
  const found = STYLE_REGISTRY.find((style) => style.id === id);
  if (!found) throw new Error(`no style registered as ${id}`);
  return found;
}
