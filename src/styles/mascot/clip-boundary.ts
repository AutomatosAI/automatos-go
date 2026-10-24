// The clip boundary on Skia's frame clock (KS11), pure. A tinted clip plays through Skia's useVideo,
// whose time runs on the UI thread in milliseconds; the check there has to be a worklet, and the
// vendored atClipBoundary (player.ts, seconds, JavaScript only) is not one. nearClipEnd is that
// check, taking milliseconds and doing the vendored arithmetic in seconds with its BOUNDARY_MS, so
// the two agree to the last bit; clip-boundary.test.ts holds them together. Skia gives no 'ended':
// a clip whose last frames come late can stop short of the window, so a timer of the clip's length
// plus CLIP_BACKSTOP_MS ends the run instead (the web's backstop).

import { BOUNDARY_MS } from '../../core/web/lib/mascot/player';

/** After the clip's length, this long again before the timer calls its boundary. */
export const CLIP_BACKSTOP_MS = 250;

const MS_PER_SECOND = 1000;

/** True once a clip is within BOUNDARY_MS of its end (or past it); both times in ms. */
export function nearClipEnd(currentMs: number, durationMs: number): boolean {
  'worklet';
  const current = currentMs / MS_PER_SECOND;
  const duration = durationMs / MS_PER_SECOND;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(current)) return false;
  return (duration - current) * MS_PER_SECOND <= BOUNDARY_MS;
}
