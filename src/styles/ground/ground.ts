// What a screen stands on (D54), pure: the Screen primitive paints the dress's ground behind its
// content — Studio's plain background (an installed theme's too), Play's page glow, HUD's glow,
// grid and scanlines, Arcade's page, Candy's page — and sets the status bar to the style's tone, so
// the clock reads on Play's Paper as on HUD's black, Arcade's Handheld green and Candy's Night
// bloom. ScreenGround.tsx draws the plan. Arcade's ground is the palette's page colour and nothing
// over it: its scanlines live only inside its windows (arcade/parts/Scanlines.tsx), never a layer
// over the screen and the AI label (D-AI-LABEL). Candy's ground on a shared screen is the palette's
// page, flat: the band and Vivid's aura are its home's and its edge screens' own (CANDY-LAYOUT §4,
// §7). The text inputs take the keyboard's appearance from the same tone under Play, HUD, Arcade
// and Candy (keyboardAppearanceFor).

import type { MascotName } from '../../core/frozen/lib/mascot/types';
import type { GroundKind } from '../dress/dress';
import type { ResolvedStyle } from '../provider/resolve';
import type { ColourScheme } from '../tokens/types';
import { hudGroundPlan, type HudGroundPlan } from './hud-ground';
import { playGlowPlan, type PlayGlowPlan } from './play-glow';
import type { ScreenKind } from './spots';

export type GroundPlan =
  | { readonly kind: 'plain' }
  | { readonly kind: 'play-glow'; readonly plan: PlayGlowPlan | null }
  | { readonly kind: 'hud-grid'; readonly plan: HudGroundPlan }
  | { readonly kind: 'arcade-page'; readonly page: string }
  | { readonly kind: 'candy-page'; readonly page: string };

const PLAIN: GroundPlan = Object.freeze({ kind: 'plain' });

/** expo-status-bar's style: light content on a dark tone, dark content on a light one. */
export type StatusBarStyle = 'light' | 'dark';

export function statusBarStyle(tone: ColourScheme): StatusBarStyle {
  return tone === 'dark' ? 'light' : 'dark';
}

/** TextInput's keyboardAppearance; 'default' follows the window (Studio's Light/Dark/System). */
export type KeyboardAppearance = 'default' | 'light' | 'dark';

/**
 * The keyboard under this style: Play's look, HUD, Arcade's and Candy's palette paint their own tone
 * (Arcade: Handheld light, the others dark; Candy: Night bloom dark, the others light), so the
 * keyboard takes it; Studio and an installed theme keep
 * 'default', the window's appearance theme.tsx sets from Studio's choice.
 */
export function keyboardAppearanceFor(style: ResolvedStyle): KeyboardAppearance {
  return style.layout === 'studio' ? 'default' : style.tone;
}

export type GroundInput = {
  readonly style: ResolvedStyle;
  /** The dress's ground (dressOf(style).ground). */
  readonly ground: GroundKind;
  readonly kind: ScreenKind;
  readonly state: MascotName;
};

/** The ground for this style, screen and Auto's state. */
export function groundPlan({ style, ground, kind, state }: GroundInput): GroundPlan {
  if (ground === 'play-glow' && style.playLook && style.play) {
    const plan = playGlowPlan({
      look: style.playLook,
      vars: style.play,
      kind,
      state,
      loops: style.motion.loops,
    });
    return Object.freeze({ kind: 'play-glow', plan });
  }
  if (ground === 'hud-grid' && style.hudLook && style.hud) {
    return Object.freeze({ kind: 'hud-grid', plan: hudGroundPlan(style.hudLook, style.hud) });
  }
  return flatPage(style, ground) ?? PLAIN;
}

/** Arcade's and Candy's ground: the palette's page colour, flat; null for any other ground. */
function flatPage(style: ResolvedStyle, ground: GroundKind): GroundPlan | null {
  if (ground === 'arcade-page' && style.arcade) {
    return Object.freeze({ kind: 'arcade-page', page: style.arcade.page });
  }
  if (ground === 'candy-page' && style.candy) {
    return Object.freeze({ kind: 'candy-page', page: style.candy.page });
  }
  return null;
}
