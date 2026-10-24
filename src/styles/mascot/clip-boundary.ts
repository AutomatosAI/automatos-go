// The clip boundary on Skia's frame clock (KS11), pure. A tinted clip plays through Skia's useVideo,
// whose time runs on the UI thread in milliseconds; the check there has to be a worklet, and the
// vendored atClipBoundary (player.ts, seconds, JavaScript only) is not one. nearClipEnd is that
// check, taking milliseconds and doing the vendored arithmetic in seconds with its BOUNDARY_MS, so
// the two agree to the last bit; clip-boundary.test.ts holds them together. Skia gives no 'ended':
// a clip whose last frames come late can stop short of the window, so a timer of the clip's length
// plus CLIP_BACKSTOP_MS ends the run instead (the web's backstop). Skia gives no load error either:
// a clip it cannot open never gets a duration, so neither the window nor the timer ever ends a run;
// clipLoad gives it CLIP_LOAD_DEADLINE_MS from its mount to get one, after which it has failed and
// Auto turns to stills, as he does when expo-video reports an error.

import { BOUNDARY_MS, CLIP_MS } from '../../core/web/lib/mascot/player';

/** After the clip's length, this long again before the timer calls its boundary. */
export const CLIP_BACKSTOP_MS = 250;

/**
 * A tinted clip with no duration this long after it mounted has failed: one clip's length, so Auto
 * never rests on the poster longer than a change already waits for its boundary.
 */
export const CLIP_LOAD_DEADLINE_MS = CLIP_MS;

const MS_PER_SECOND = 1000;

/** True once a clip is within BOUNDARY_MS of its end (or past it); both times in ms. */
export function nearClipEnd(currentMs: number, durationMs: number): boolean {
  'worklet';
  const current = currentMs / MS_PER_SECOND;
  const duration = durationMs / MS_PER_SECOND;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(current)) return false;
  return (duration - current) * MS_PER_SECOND <= BOUNDARY_MS;
}

/** A tinted clip's load: it has a duration, it may still get one (in leftMs), or it never will. */
export type ClipLoad =
  | { readonly kind: 'loaded' }
  | { readonly kind: 'waiting'; readonly leftMs: number }
  | { readonly kind: 'failed' };

const LOADED: ClipLoad = Object.freeze({ kind: 'loaded' });
const FAILED: ClipLoad = Object.freeze({ kind: 'failed' });

/** Where a tinted clip mounted elapsedMs ago stands, given Skia's duration (0 until it loads). */
export function clipLoad(durationMs: number, elapsedMs: number): ClipLoad {
  if (Number.isFinite(durationMs) && durationMs > 0) return LOADED;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const leftMs = CLIP_LOAD_DEADLINE_MS - elapsed;
  return leftMs > 0 ? Object.freeze({ kind: 'waiting', leftMs }) : FAILED;
}
