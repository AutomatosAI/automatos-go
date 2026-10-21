// The sheet's and the toast's logic, pure (PRD-001 §4.11, K5). The handoff (README 'Interactions'):
// sheets slide up 220 ms ease and the backdrop fades to the handoff's ink at 34 %, a tap on it
// closes the sheet; feedback is a toast at the top on iOS and an ink snackbar at the bottom on
// Android, for 2.4 s. Under Reduce Motion the sheet does not slide: it cross-fades in place.

import type { ColourName, ColourScheme, Colours, RadiusName, SpaceName } from '../styles/tokens';
import { tint } from './paint';
import type { TextLevel, TextTone } from './variants';

// ── Sheet ───────────────────────────────────────────────────────────────────────────────────

export const SHEET_DURATION_MS = 220;
/** CSS `ease`, as Easing.bezier's control points. */
export const SHEET_EASING = Object.freeze([0.25, 0.1, 0.25, 1] as const);
export const BACKDROP_ALPHA = 0.34;
/** The sheet never covers more than this share of the window (the prototype's max-height: 84%). */
export const SHEET_MAX_HEIGHT_RATIO = 0.84;
export const GRABBER = Object.freeze({ width: 36, height: 4, radius: 2 });

export type SheetMotion = {
  /** Slides up from below the window; false under Reduce Motion (a cross-fade instead). */
  readonly slide: boolean;
  readonly durationMs: number;
};

export function sheetMotion(reduceMotion: boolean): SheetMotion {
  return { slide: !reduceMotion, durationMs: SHEET_DURATION_MS };
}

/** How far below its resting place the sheet sits at `progress` (0 closed, 1 open). */
export function sheetOffset(progress: number, height: number, slide: boolean): number {
  'worklet';
  if (!slide) return 0;
  const clamped = Math.min(Math.max(progress, 0), 1);
  return (1 - clamped) * height;
}

/** The sheet's own opacity: always 1 when it slides; it fades with the backdrop when it doesn't. */
export function sheetOpacity(progress: number, slide: boolean): number {
  'worklet';
  return slide ? 1 : Math.min(Math.max(progress, 0), 1);
}

/**
 * The handoff's backdrop ink (hue 30°, 12 % saturation, 9 % lightness) at 34 %: Light's
 * foreground and Dark's background are that ink, so the backdrop darkens the screen in both
 * schemes.
 */
export function backdropColour(colours: Colours, scheme: ColourScheme): string {
  return tint(scheme === 'dark' ? colours.background : colours.foreground, BACKDROP_ALPHA);
}

// ── Toast ───────────────────────────────────────────────────────────────────────────────────

export const TOAST_DURATION_MS = 2400;

export type ToastPlacement = 'top' | 'bottom';

/** iOS: a card at the top. Android (and anything else): the ink snackbar at the bottom. */
export function toastPlacement(os: string): ToastPlacement {
  return os === 'ios' ? 'top' : 'bottom';
}

export type ToastLook = {
  readonly background: ColourName;
  readonly border: ColourName | null;
  readonly tone: TextTone;
  readonly level: TextLevel;
  readonly radius: RadiusName;
  /** The success tick before the words (the iOS card). */
  readonly icon: boolean;
  /** From the window's sides, and from the safe area's top or bottom. */
  readonly sideInset: SpaceName;
  readonly edgeInset: SpaceName;
  readonly paddingX: SpaceName;
  readonly paddingY: SpaceName;
};

/**
 * The prototype's two: a card (border, 10 pt radius, Geist 500 12.5) 4 pt under the iOS safe area
 * and 14 from the sides; an ink snackbar (6 pt radius, Geist 500 13) 14 above Android's navigation
 * bar and 12 from the sides. The snackbar is the primary paint, so it inverts to cream in Dark.
 */
export const TOAST_LOOKS: Readonly<Record<ToastPlacement, ToastLook>> = Object.freeze({
  top: {
    background: 'card',
    border: 'border',
    tone: 'default',
    level: 4,
    radius: 'panel',
    icon: true,
    sideInset: 'space6',
    edgeInset: 'space1',
    paddingX: 'space6',
    paddingY: 'space4',
  },
  bottom: {
    background: 'primary',
    border: null,
    tone: 'inverse',
    level: 3,
    radius: 'control',
    icon: false,
    sideInset: 'space5',
    edgeInset: 'space6',
    paddingX: 'space7',
    paddingY: 'space5',
  },
});

export type ToastItem = { readonly id: number; readonly message: string };

export type ToastState = { readonly current: ToastItem | null; readonly nextId: number };

export type ToastEvent =
  | { readonly type: 'show'; readonly message: string }
  | { readonly type: 'expire'; readonly id: number }
  | { readonly type: 'dismiss' };

export const INITIAL_TOAST_STATE: ToastState = Object.freeze({ current: null, nextId: 1 });

/**
 * One toast at a time: a new one replaces the one on screen (the prototype's flash()) and gets its
 * own 2.4 s. An expiry only clears the toast it was set for, so an older timer never ends a newer
 * toast early. A blank message shows nothing.
 */
export function toastReducer(state: ToastState, event: ToastEvent): ToastState {
  switch (event.type) {
    case 'show': {
      const message = event.message.trim();
      if (!message) return state;
      return { current: { id: state.nextId, message }, nextId: state.nextId + 1 };
    }
    case 'expire':
      return state.current?.id === event.id ? { ...state, current: null } : state;
    case 'dismiss':
      return state.current ? { ...state, current: null } : state;
  }
}
