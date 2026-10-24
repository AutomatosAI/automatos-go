// What Auto's stage shows for the resolved style (D-MASCOT, D37), pure: whether he is there at all,
// the file and how it is drawn (media.ts), his ring's colour (ring-palette.ts), whether the ring
// pulses and the name VoiceOver reads. Mascot.tsx draws it.
//
//   no mascot   the style shows none (Studio without a theme mascot, HUD with auto 'off'), or the
//               installed theme's mascot mode is 'none'
//   stills      no loop runs (the phone's Reduce Motion, HUD's motion 'off'), or a clip failed to
//               play: the state's still, and the driver jumps (run.ts)
//   shell       Play's look tints the bundled Auto (SHELLS[look.shell].filter); sleeping dims him
//               on top (Mascot.dc.html: the shell, then brightness(.55) saturate(.6)); a theme's
//               own files are never tinted (media.ts)

import { captionFor } from '../../core/web/lib/mascot/media';
import type { MascotName } from '../../core/web/lib/mascot/types';
import type { ResolvedStyle } from '../provider/resolve';
import type { StyleChoice } from '../registry/style-id';
import { MASCOT_COPY } from '../strings';
import type { ThemeMascot, ThemePaint } from '../themes/types';
import type { BundledMascot } from './bundled';
import {
  mascotMedia,
  type MascotFile,
  type MascotMedia,
  type MascotPlatform,
  type ThemeMascotMedia,
} from './media';
import { ringColourOf } from './ring-palette';
import { cssFilterToColorMatrix, NO_FILTER, type ColorMatrix } from './shell-matrix';

/** Mascot.dc.html's sleeping filter, applied after the shell. */
export const SLEEP_DIM = 'brightness(.55) saturate(.6)';

/** What the stage reads of the resolved style. */
export type StageStyle = Pick<
  ResolvedStyle,
  'layout' | 'tokens' | 'playLook' | 'hudLook' | 'play' | 'motion' | 'mascot'
>;

export type MascotStageInput = {
  readonly style: StageStyle;
  readonly platform: MascotPlatform;
  /** A clip would not play on this phone (expo-video's error): stills from then on. */
  readonly clipFailed: boolean;
  /** The installed theme's local copies, when the style's mascot is the theme's. */
  readonly theme: ThemeMascotMedia | null;
  readonly bundled: BundledMascot;
  /** MASCOT_TINTED_CLIPS. */
  readonly tintedClips: boolean;
};

export type ShownMedia = Exclude<MascotMedia, { readonly kind: 'none' }>;

export type MascotStage = {
  readonly media: ShownMedia;
  /** The ring's #rrggbb. */
  readonly ring: string;
  /** The ring pulses (Ember's 2.4 s loop) while loops run. */
  readonly pulse: boolean;
  /** No clip plays for this state: the driver jumps and one-shots end on a timer. */
  readonly stills: boolean;
};

/** A theme that brings Auto but whose painting is not the one cached: nothing to show. */
const NO_THEME_MASCOT: ThemeMascotMedia = Object.freeze({
  mode: 'none',
  states: Object.freeze({}),
});

/** The theme mascot of the painting on screen (the cached painting must be that install's). */
export function themeMascotOf(choice: StyleChoice, paint: ThemePaint | null): ThemeMascot | null {
  if (choice.kind !== 'theme' || !paint || paint.installId !== choice.installId) return null;
  return paint.mascotFiles ?? null;
}

/** The theme mascot cut to one state, so only that state's copies are looked up on the phone. */
export function themeMascotFor(mascot: ThemeMascot | null, state: MascotName): ThemeMascot | null {
  if (!mascot) return null;
  return Object.freeze({ ...mascot, states: mascot.states.filter(({ name }) => name === state) });
}

/** The CSS filter over the bundled Auto in this state. */
export function mascotFilter(style: StageStyle, state: MascotName): string {
  const shell = style.layout === 'play' && style.play ? style.play.autoShellFilter : NO_FILTER;
  if (state !== 'sleeping') return shell;
  return shell === NO_FILTER ? SLEEP_DIM : `${shell} ${SLEEP_DIM}`;
}

export function playsClip(media: MascotMedia): boolean {
  return media.kind === 'clip' || media.kind === 'tinted-clip';
}

/** What the stage shows for the state on screen, or null where the style shows no mascot. */
export function mascotStage(input: MascotStageInput, showing: MascotName): MascotStage | null {
  const { style } = input;
  if (style.mascot === 'none') return null;
  const media = mascotMedia(
    {
      platform: input.platform,
      reduceMotion: !style.motion.loops || input.clipFailed,
      shellFilter: mascotFilter(style, showing),
      tintedClips: input.tintedClips,
      theme: style.mascot === 'theme' ? (input.theme ?? NO_THEME_MASCOT) : null,
      bundled: input.bundled,
    },
    showing,
  );
  if (media.kind === 'none') return null;
  return Object.freeze({
    media,
    ring: ringColourOf(showing, style),
    pulse: style.motion.loops,
    stills: !playsClip(media),
  });
}

/** What Skia draws: the still (always: the poster under a clip), its matrix, and the clip if any. */
export type SkiaMedia = {
  readonly still: MascotFile;
  readonly matrix: ColorMatrix;
  readonly clip: MascotFile | null;
};

const IDENTITY = cssFilterToColorMatrix(NO_FILTER);

/** The Skia-drawn kinds (every still, a tinted clip); a plain clip is expo-video's. */
export function skiaMedia(media: Exclude<ShownMedia, { readonly kind: 'clip' }>): SkiaMedia {
  switch (media.kind) {
    case 'still':
      return Object.freeze({ still: media.still, matrix: IDENTITY, clip: null });
    case 'tinted-still':
      return Object.freeze({ still: media.still, matrix: media.matrix, clip: null });
    case 'tinted-clip':
      return Object.freeze({ still: media.still, matrix: media.matrix, clip: media.clip });
  }
}

/** VoiceOver's name for Auto: 'Auto, Ready when you are'. */
export function mascotLabel(state: MascotName): string {
  return MASCOT_COPY.label(captionFor(state));
}
