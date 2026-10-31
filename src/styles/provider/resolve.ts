// What the phone paints (PRD-001 §4.6, D54, D58, D59): resolveStyle turns the phone's style choice,
// Studio's Light / Dark / System, the phone's appearance, Play's, HUD's, Arcade's and Candy's looks
// and an installed theme's cached painting into one ResolvedStyle — the layout, its tone, the
// Studio-keyed token set every shared screen reads through useTokens(), the radii, the type, Play's,
// HUD's, Arcade's and Candy's own variables, the motion rule and where Auto comes from. Pure:
// theme.tsx feeds it the store and the phone, StyleScope a preview's own choice and look.
//
//   Studio  the scheme's tokens (System → the phone's appearance)
//   Play    the look's ground decides the tone; the scheme does not apply (as on the web)
//   HUD     always dark
//   Arcade  the look's palette decides the tone (Handheld light, the others dark), as on the web;
//           Studio's type until Arcade's faces land (US-022d); never the bundled Auto (D-ARC-5)
//   Candy   the look's palette decides the tone (Blush and Lilac light, Night bloom dark, D-CAN-7);
//           its Roundness the corners; its Motion 'paused' stills the loops; Candy's type, Outfit
//           and Nunito (typeface/candy-type.ts); never the bundled Auto (D-CAN-5)
//   theme   the Studio layout with the theme's painting, or Studio's own while none is cached; its
//           fonts once they are loaded (themes/fonts.ts), Studio's faces until then

import type { Look } from '../../core/frozen/lib/looks/types';
import { ARCADE_DEFAULT_LOOK, ARCADE_INTERFACE, type ArcadeLook } from '../arcade/look-schema';
import { CANDY_DEFAULT_LOOK, CANDY_INTERFACE, type CandyLook } from '../candy/look-schema';
import { HUD_INTERFACE, type HudLook } from '../hud/look-schema';
import { styleEntry } from '../registry/registry';
import { layoutOf, type BuiltInStyleId, type Layout, type StyleChoice } from '../registry/style-id';
import { resolveScheme, type SystemScheme, type ThemeChoice } from '../theme-choice';
import { arcadeTone, arcadeVars, type ArcadeVars } from '../tokens/arcade';
import { candyRadii, candyTone, candyVars, type CandyVars } from '../tokens/candy';
import { HUD_TONE, hudVars, type HudVars } from '../tokens/hud';
import { playTone, playVars, type PlayVars } from '../tokens/play';
import { STYLE_RADII, type StyleRadii } from '../tokens/radii';
import { studioTokens } from '../tokens/studio';
import {
  arcadeStyleTokens,
  candyStyleTokens,
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
  /** Candy's active look; absent: Blush (the default preset). */
  readonly candyLook?: CandyLook;
  /** The cached painting of the theme last read (US-016i); null or absent while none is. */
  readonly themePaint?: ThemePaint | null;
  /** The theme fonts loaded for that painting (US-016i); null or absent: Studio's faces. */
  readonly themeFonts?: LoadedThemeFonts | null;
  /** The phone's Reduce Motion (reduce-motion.ts). */
  readonly reduceMotion: boolean;
};

/** Why loops are off: the phone's Reduce Motion, or HUD's look with motion 'off' or Candy's 'paused'. */
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
  /** Candy only: the look, and its palette's variables and card stops for Candy's own components. */
  readonly candyLook?: CandyLook;
  readonly candy?: CandyVars;
  readonly motion: StyleMotion;
  readonly mascot: MascotSource;
};

const LOOPING: StyleMotion = Object.freeze({ loops: true, reason: null });
const STILL_FOR_PHONE: StyleMotion = Object.freeze({ loops: false, reason: 'reduce-motion' });
const STILL_FOR_LOOK: StyleMotion = Object.freeze({ loops: false, reason: 'look' });

/**
 * Reduce Motion stops every loop in every style; HUD's look can turn its own off as well, and
 * Candy's look its own with Motion 'paused' (absent: Blush, which moves).
 */
export function motionOf(
  layout: Layout,
  hudLook: HudLook,
  reduceMotion: boolean,
  candyLook?: Pick<CandyLook, 'motion'>,
): StyleMotion {
  if (reduceMotion) return STILL_FOR_PHONE;
  if (layout === 'hud' && hudLook.motion === 'off') return STILL_FOR_LOOK;
  if (layout === 'candy' && candyLook?.motion === 'paused') return STILL_FOR_LOOK;
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

/** Play's, HUD's, Arcade's and Candy's own variables, once per look object (the engine runs once). */
const playVarsOf = oncePerObject(playVars);
const hudVarsOf = oncePerObject((look: HudLook): HudVars => hudVars(look));
const arcadeVarsOf = oncePerObject((look: ArcadeLook): ArcadeVars => arcadeVars(look));
const candyVarsOf = oncePerObject((look: CandyLook): CandyVars => candyVars(look));
const candyRadiiOf = oncePerObject((look: CandyLook): StyleRadii => candyRadii(look));

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
    type: styleType({ layout: 'arcade' }),
    arcadeLook: look,
    arcade: arcadeVarsOf(look),
    mascot: 'none', // the registry's 'never': the bundled clips never show in Arcade (D-ARC-5)
  };
}

function candy(look: CandyLook): Painted {
  return {
    layout: 'candy',
    tone: candyTone(look),
    tokens: candyStyleTokens(look),
    radii: candyRadiiOf(look),
    type: styleType({ layout: 'candy' }),
    candyLook: look,
    candy: candyVarsOf(look),
    mascot: 'none', // the registry's 'never': Candy draws its own Auto with Skia (D-CAN-5)
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
  if (choice.id === 'candy') return candy(input.candyLook ?? CANDY_DEFAULT_LOOK);
  return studio(resolveScheme(input.studioScheme, input.systemScheme));
}

export function resolveStyle(input: StyleInput): ResolvedStyle {
  const style = painted(input);
  return Object.freeze({
    ...style,
    choice: input.choice,
    motion: motionOf(layoutOf(input.choice), input.hudLook, input.reduceMotion, input.candyLook),
  });
}

/** Any style's look: Play's, HUD's, Arcade's or Candy's, told apart by its interface. */
export type StyleLook = Look | HudLook | ArcadeLook | CandyLook;

/**
 * A preview's input (StyleScope): the app's, with its own choice and, when given, its own look —
 * a HUD look by its interface 'command', an Arcade look by 'arcade', a Candy look by 'candy', any
 * other a Play look.
 */
export function scopeInput(input: StyleInput, choice: StyleChoice, look?: StyleLook): StyleInput {
  if (!look) return { ...input, choice };
  if (look.interface === HUD_INTERFACE) return { ...input, choice, hudLook: look };
  if (look.interface === ARCADE_INTERFACE) return { ...input, choice, arcadeLook: look };
  if (look.interface === CANDY_INTERFACE) return { ...input, choice, candyLook: look };
  return { ...input, choice, playLook: look };
}
