// What a screen stands on (D54), pure: the Screen primitive paints the dress's ground behind its
// content — Studio's plain background (an installed theme's too), Play's page glow, HUD's glow,
// grid and scanlines — and sets the status bar to the style's tone, so the clock reads on Play's
// Paper as on HUD's black. ScreenGround.tsx draws the plan.

import type { MascotName } from '../../core/web/lib/mascot/types';
import type { GroundKind } from '../dress/dress';
import type { ResolvedStyle } from '../provider/resolve';
import type { ColourScheme } from '../tokens/types';
import { hudGroundPlan, type HudGroundPlan } from './hud-ground';
import { playGlowPlan, type PlayGlowPlan } from './play-glow';
import type { ScreenKind } from './spots';

export type GroundPlan =
  | { readonly kind: 'plain' }
  | { readonly kind: 'play-glow'; readonly plan: PlayGlowPlan | null }
  | { readonly kind: 'hud-grid'; readonly plan: HudGroundPlan };

const PLAIN: GroundPlan = Object.freeze({ kind: 'plain' });

/** expo-status-bar's style: light content on a dark tone, dark content on a light one. */
export type StatusBarStyle = 'light' | 'dark';

export function statusBarStyle(tone: ColourScheme): StatusBarStyle {
  return tone === 'dark' ? 'light' : 'dark';
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
  return PLAIN;
}
