// What the phone paints (PRD-001 §4.6, D54, D58, D59): resolveStyle turns the phone's style choice,
// Studio's Light / Dark / System, the phone's appearance, Play's, HUD's and Arcade's looks and an
// installed theme's cached painting into one ResolvedStyle — the layout, its tone, the Studio-keyed
// token set every shared screen reads through useTokens(), the radii, the type, Play's, HUD's and
// Arcade's own variables, the motion rule and where Auto comes from. Pure: theme.tsx feeds it the
// store and the phone, StyleScope a preview's own choice and look.
//
//   Studio  the scheme's tokens (System → the phone's appearance)
//   Play    the look's ground decides the tone; the scheme does not apply (as on the web)
//   HUD     always dark
//   Arcade  the look's palette decides the tone (Handheld light, the others dark), as on the web;
//           Studio's type until Arcade's faces land (US-022d); never the bundled Auto (D-ARC-5)
//   theme   the Studio layout with the theme's painting, or Studio's own while none is cached; its
//           fonts once they are loaded (themes/fonts.ts), Studio's faces until then

import type { Look } from '../../core/frozen/lib/looks/types';
import { ARCADE_DEFAULT_LOOK, ARCADE_INTERFACE, type ArcadeLook } from '../arcade/look-schema';
import { HUD_INTERFACE, type HudLook } from '../hud/look-schema';
import { styleEntry } from '../registry/registry';
import { layoutOf, type BuiltInStyleId, type Layout, type StyleChoice } from '../registry/style-id';
import { resolveScheme, type SystemScheme, type ThemeChoice } from '../theme-choice';
import { arcadeTone, arcadeVars, type ArcadeVars } from '../tokens/arcade';
import { HUD_TONE, hudVars, type HudVars } from '../tokens/hud';
import { playTone, playVars, type PlayVars } from '../tokens/play';
import { STYLE_RADII, type StyleRadii } from '../tokens/radii';
import { studioTokens } from '../tokens/studio';
import {
  arcadeStyleTokens,
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
  /** Arcade's active look; absent: Overworld (the default preset). */
  readonly arcadeLook?: ArcadeLook;
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
  /** Arcade only: the look, and its palette's variables for Arcade's own components. */
  readonly arcadeLook?: ArcadeLook;
  readonly arcade?: ArcadeVars;
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

/** Play's, HUD's and Arcade's own variables, once per look object (the engine runs once). */
const playVarsOf = oncePerObject(playVars);
const hudVarsOf = oncePerObject((look: HudLook): HudVars => hudVars(look));
const arcadeVarsOf = oncePerObject((look: ArcadeLook): ArcadeVars => arcadeVars(look));

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

function arcade(look: ArcadeLook): Painted {
  return {
    layout: 'arcade',
    tone: arcadeTone(look),
    tokens: arcadeStyleTokens(look),
    radii: STYLE_RADII.arcade,
    type: styleType({ layout: 'studio' }), // ARCADE_STAND_IN US-022d: Arcade's type
    arcadeLook: look,
    arcade: arcadeVarsOf(look),
    mascot: 'none', // the registry's 'never': the bundled clips never show in Arcade (D-ARC-5)
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
  if (choice.id === 'arcade') return arcade(input.arcadeLook ?? ARCADE_DEFAULT_LOOK);
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

/** Any style's look: Play's, HUD's or Arcade's, told apart by its interface. */
export type StyleLook = Look | HudLook | ArcadeLook;

/**
 * A preview's input (StyleScope): the app's, with its own choice and, when given, its own look —
 * a HUD look by its interface 'command', an Arcade look by 'arcade', any other a Play look.
 */
export function scopeInput(input: StyleInput, choice: StyleChoice, look?: StyleLook): StyleInput {
  if (!look) return { ...input, choice };
  if (look.interface === HUD_INTERFACE) return { ...input, choice, hudLook: look };
  if (look.interface === ARCADE_INTERFACE) return { ...input, choice, arcadeLook: look };
  return { ...input, choice, playLook: look };
}
