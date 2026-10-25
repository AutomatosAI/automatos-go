// What the phone paints (PRD-001 §4.6, D54, D58, D59): resolveStyle turns the phone's style choice,
// Studio's Light / Dark / System, the phone's appearance, Play's and HUD's looks and an installed
// theme's cached painting into one ResolvedStyle — the layout, its tone, the Studio-keyed token set
// every shared screen reads through useTokens(), the radii, the type, Play's and HUD's own
// variables, the motion rule and where Auto comes from. Pure: theme.tsx feeds it the store and
// the phone, StyleScope a preview's own choice and look.
//
//   Studio  the scheme's tokens (System → the phone's appearance)
//   Play    the look's ground decides the tone; the scheme does not apply (as on the web)
//   HUD     always dark
//   theme   the Studio layout with the theme's painting, or Studio's own while none is cached; its
//           fonts once they are loaded (themes/fonts.ts), Studio's faces until then

import type { Look } from '../../core/web/lib/looks/types';
import { HUD_INTERFACE, type HudLook } from '../hud/look-schema';
import { styleEntry } from '../registry/registry';
import { layoutOf, type BuiltInStyleId, type Layout, type StyleChoice } from '../registry/style-id';
import { resolveScheme, type SystemScheme, type ThemeChoice } from '../theme-choice';
import { HUD_TONE, hudVars, type HudVars } from '../tokens/hud';
import { playTone, playVars, type PlayVars } from '../tokens/play';
import { STYLE_RADII, type StyleRadii } from '../tokens/radii';
import { studioTokens } from '../tokens/studio';
import {
  hudStyleTokens,
  oncePerObject,
  paintedStudioTokens,
  playStyleTokens,
} from '../tokens/style-tokens';
import { paintScheme } from '../themes/paint';
import { themedStyleType, themedTokens } from '../themes/type';
import type { LoadedThemeFonts, ThemePaint } from '../themes/types';
import type { ColourScheme, Tokens } from '../tokens/types';
import { styleType, type StyleType } from '../typeface/scale';

/** An installed theme's phone painting: themes/types.ts (US-016i), data only (D-NO-CODE). */
export type { ThemePaint } from '../themes/types';

export type StyleInput = {
  readonly choice: StyleChoice;
  /** Studio's Light / Dark / System (the foundation's theme-choice.ts). */
  readonly studioScheme: ThemeChoice;
  /** The phone's appearance, as useColorScheme() reports it. */
  readonly systemScheme: SystemScheme;
  readonly playLook: Look;
  readonly hudLook: HudLook;
  /** The cached painting of the theme last read (US-016i); null or absent while none is. */
  readonly themePaint?: ThemePaint | null;
  /** The theme fonts loaded for that painting (US-016i); null or absent: Studio's faces. */
  readonly themeFonts?: LoadedThemeFonts | null;
  /** The phone's Reduce Motion (reduce-motion.ts). */
  readonly reduceMotion: boolean;
};

/** Why loops are off: the phone's Reduce Motion, or HUD's look with motion 'off'. */
export type MotionReason = 'reduce-motion' | 'look';

export type StyleMotion = {
  /** Loops may run: the ring's pulse, Play's rises and glow crossfades, HUD's scan. */
  readonly loops: boolean;
  readonly reason: MotionReason | null;
};

/** Where Auto comes from: nowhere, the app's bundled files, or the installed theme's files. */
export type MascotSource = 'none' | 'bundled' | 'theme';

export type ResolvedStyle = {
  readonly choice: StyleChoice;
  readonly layout: Layout;
  readonly tone: ColourScheme;
  /** The Studio-keyed set (the foundation's Tokens), the one every shared screen reads. */
  readonly tokens: Tokens;
  readonly radii: StyleRadii;
  readonly type: StyleType;
  /** Play only: the look, and its --pl-* variables for Play's own components. */
  readonly playLook?: Look;
  readonly play?: PlayVars;
  /** HUD only: the look, and the README's derived variables for HUD's own components. */
  readonly hudLook?: HudLook;
  readonly hud?: HudVars;
  readonly motion: StyleMotion;
  readonly mascot: MascotSource;
};

const LOOPING: StyleMotion = Object.freeze({ loops: true, reason: null });
const STILL_FOR_PHONE: StyleMotion = Object.freeze({ loops: false, reason: 'reduce-motion' });
const STILL_FOR_LOOK: StyleMotion = Object.freeze({ loops: false, reason: 'look' });

/** Reduce Motion stops every loop in every style; HUD's look can turn its own off as well. */
export function motionOf(layout: Layout, hudLook: HudLook, reduceMotion: boolean): StyleMotion {
  if (reduceMotion) return STILL_FOR_PHONE;
  if (layout === 'hud' && hudLook.motion === 'off') return STILL_FOR_LOOK;
  return LOOPING;
}

/** The registry's rule for a built-in style (HUD: the look's auto knob). */
export function bundledMascot(id: BuiltInStyleId, hudLook: HudLook): MascotSource {
  const rule = styleEntry(id).mascot;
  if (rule === 'always') return 'bundled';
  if (rule === 'look') return hudLook.auto === 'on' ? 'bundled' : 'none';
  return 'none';
}

/** The painting for this theme choice, if the cached one is that install's. */
function paintFor(installId: string, paint: ThemePaint | null | undefined): ThemePaint | null {
  return paint && paint.installId === installId ? paint : null;
}

/** Play's and HUD's own variables, once per look object (the vendored engine runs once). */
const playVarsOf = oncePerObject(playVars);
const hudVarsOf = oncePerObject((look: HudLook): HudVars => hudVars(look));

type Painted = Omit<ResolvedStyle, 'choice' | 'motion'>;

function studio(scheme: ColourScheme): Painted {
  return {
    layout: 'studio',
    tone: scheme,
    tokens: studioTokens(scheme),
    radii: STYLE_RADII.studio,
    type: styleType({ layout: 'studio' }),
    mascot: 'none',
  };
}

function play(look: Look): Painted {
  return {
    layout: 'play',
    tone: playTone(look),
    tokens: playStyleTokens(look),
    radii: STYLE_RADII.play,
    type: styleType({ layout: 'play', font: look.font }),
    playLook: look,
    play: playVarsOf(look),
    mascot: 'bundled',
  };
}

function hud(look: HudLook): Painted {
  return {
    layout: 'hud',
    tone: HUD_TONE,
    tokens: hudStyleTokens(look),
    radii: STYLE_RADII.hud,
    type: styleType({ layout: 'hud', font: look.font }),
    hudLook: look,
    hud: hudVarsOf(look),
    mascot: bundledMascot('hud', look),
  };
}

/** The loaded families for this install, or null while none are (Studio's faces). */
function fontsFor(installId: string, fonts: LoadedThemeFonts | null | undefined) {
  const families = fonts && fonts.installId === installId ? fonts.families : null;
  return families && Object.keys(families).length > 0 ? families : null;
}

function theme(input: StyleInput, installId: string): Painted {
  const paint = paintFor(installId, input.themePaint);
  if (!paint) return studio(resolveScheme(input.studioScheme, input.systemScheme));
  const scheme = paintScheme(paint, input.studioScheme, input.systemScheme);
  const tokens = paintedStudioTokens(paint.colours[scheme], scheme);
  const families = fontsFor(installId, input.themeFonts);
  const base = studio(scheme);
  return {
    ...base,
    tokens: families ? themedTokens(tokens, families) : tokens,
    type: families ? themedStyleType(base.type, families) : base.type,
    mascot: paint.mascot ? 'theme' : 'none',
  };
}

function painted(input: StyleInput): Painted {
  const { choice } = input;
  if (choice.kind === 'theme') return theme(input, choice.installId);
  if (choice.id === 'play') return play(input.playLook);
  if (choice.id === 'hud') return hud(input.hudLook);
  return studio(resolveScheme(input.studioScheme, input.systemScheme));
}

export function resolveStyle(input: StyleInput): ResolvedStyle {
  const style = painted(input);
  return Object.freeze({
    ...style,
    choice: input.choice,
    motion: motionOf(layoutOf(input.choice), input.hudLook, input.reduceMotion),
  });
}

/** A preview's input (StyleScope): the app's, with its own choice and, when given, its own look. */
export function scopeInput(
  input: StyleInput,
  choice: StyleChoice,
  look?: Look | HudLook,
): StyleInput {
  if (!look) return { ...input, choice };
  if (look.interface === HUD_INTERFACE) return { ...input, choice, hudLook: look };
  return { ...input, choice, playLook: look };
}
