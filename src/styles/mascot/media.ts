// Which file shows Auto in a state, and how (D-MASCOT, KS11), pure. The web picks webm or mp4 by
// browser (core lib/mascot/media.ts videoFormat); the phone picks by platform and motion:
//
//   clip          iOS, motion, no shell tint: the HEVC-alpha clip through expo-video's VideoView
//   tinted-clip   iOS, motion, a shell other than 'none' and MASCOT_TINTED_CLIPS: the same clip
//                 through Skia's useVideo under the shell's colour matrix (a native video view
//                 takes no filter)
//   still         Android, Reduce Motion, or no clip: the state's still
//   tinted-still  the same, under the shell's colour matrix
//
// An installed theme that brings Auto (US-016i) replaces the bundled files with its own local
// copies, untinted; a state whose copy is not on the phone yet keeps the bundled Auto (files.ts),
// and a theme with mode 'none' shows no mascot.

import { MASCOT_STATES, type MascotName } from '../../core/web/lib/mascot/types';
import type { ThemeMascot } from '../themes/types';
import type { BundledFile, BundledMascot } from './bundled';
import { cssFilterToColorMatrix, isIdentityFilter, type ColorMatrix } from './shell-matrix';

/**
 * KS11: a tinted shell plays its clip through Skia (true) or shows the tinted still (false). If
 * the device check finds a black box where Auto should be (the alpha lost), the owner flips this
 * one constant over the air.
 */
export const MASCOT_TINTED_CLIPS = true;

export type MascotPlatform = 'ios' | 'android';

/** A file to show: a bundled module id, or a theme file's local copy (its file URI). */
export type MascotFile = BundledFile | string;

export type MascotMediaKind = 'clip' | 'tinted-clip' | 'still' | 'tinted-still';

export type MascotMedia =
  | { readonly kind: 'none' }
  | { readonly kind: 'clip'; readonly clip: MascotFile; readonly still: MascotFile }
  | {
      readonly kind: 'tinted-clip';
      readonly clip: MascotFile;
      readonly still: MascotFile;
      readonly matrix: ColorMatrix;
    }
  | { readonly kind: 'still'; readonly still: MascotFile }
  | { readonly kind: 'tinted-still'; readonly still: MascotFile; readonly matrix: ColorMatrix };

/** One theme state's local copies; null where the copy is not on the phone (yet). */
export type ThemeMascotFiles = { readonly clip: string | null; readonly still: string | null };

/** An installed theme's mascot as the phone holds it: its mode and each state's local copies. */
export type ThemeMascotMedia = {
  readonly mode: 'clips' | 'stills' | 'none';
  readonly states: Readonly<Partial<Record<MascotName, ThemeMascotFiles>>>;
};

export type MascotMediaInput = {
  readonly platform: MascotPlatform;
  readonly reduceMotion: boolean;
  /** The look's shell filter (Play: SHELLS[look.shell].filter); 'none' in HUD, Studio, themes. */
  readonly shellFilter: string;
  /** MASCOT_TINTED_CLIPS, passed in so both answers can be tested. */
  readonly tintedClips: boolean;
  /** The theme's mascot when the style's mascot is the theme's (MascotSource 'theme'). */
  readonly theme?: ThemeMascotMedia | null;
  /** The platform's bundled table (assets.ios.ts / assets.android.ts). */
  readonly bundled: BundledMascot;
};

const NO_MASCOT: MascotMedia = Object.freeze({ kind: 'none' });

function playsClips({ platform, reduceMotion }: MascotMediaInput): boolean {
  return platform === 'ios' && !reduceMotion;
}

function bundledMedia(input: MascotMediaInput, state: MascotName): MascotMedia {
  const still = input.bundled.stills[state];
  const clip = playsClips(input) ? (input.bundled.clips?.[state] ?? null) : null;
  if (isIdentityFilter(input.shellFilter)) {
    return Object.freeze(clip === null ? { kind: 'still', still } : { kind: 'clip', clip, still });
  }
  const matrix = cssFilterToColorMatrix(input.shellFilter);
  return Object.freeze(
    clip !== null && input.tintedClips
      ? { kind: 'tinted-clip', clip, still, matrix }
      : { kind: 'tinted-still', still, matrix },
  );
}

/** The theme's own files for the state, untinted; null when its copies are not on the phone. */
function themeMedia(
  input: MascotMediaInput,
  theme: ThemeMascotMedia,
  state: MascotName,
): MascotMedia | null {
  const files = theme.states[state];
  if (!files?.still) return null;
  const clip = theme.mode === 'clips' && playsClips(input) ? files.clip : null;
  return Object.freeze(
    clip ? { kind: 'clip', clip, still: files.still } : { kind: 'still', still: files.still },
  );
}

/** What shows Auto in this state on this phone. */
export function mascotMedia(input: MascotMediaInput, state: MascotName): MascotMedia {
  const { theme } = input;
  if (!theme) return bundledMedia(input, state);
  if (theme.mode === 'none') return NO_MASCOT;
  return themeMedia(input, theme, state) ?? bundledMedia(input, state);
}

const isMascotName = (name: string): name is MascotName =>
  (MASCOT_STATES as readonly string[]).includes(name);

/**
 * A theme's mascot (themes/types.ts ThemeMascot, its allowlisted URLs) as local copies: localCopy
 * answers a URL's copy on the phone or null (US-017b passes files.ts localThemeFile). A state the
 * reducer never shows is dropped; no mascot is mode 'none'.
 */
export function themeMascotMedia(
  mascot: ThemeMascot | null | undefined,
  localCopy: (url: string) => string | null,
): ThemeMascotMedia {
  if (!mascot) return Object.freeze({ mode: 'none', states: Object.freeze({}) });
  const copyOf = (url: string | null) => (url === null ? null : localCopy(url));
  const states = mascot.states.flatMap((state) =>
    isMascotName(state.name)
      ? [[state.name, Object.freeze({ clip: copyOf(state.clip), still: copyOf(state.still) })]]
      : [],
  );
  return Object.freeze({ mode: mascot.mode, states: Object.freeze(Object.fromEntries(states)) });
}
