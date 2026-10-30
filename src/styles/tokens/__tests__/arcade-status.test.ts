// Arcade's status roles (PRD-268 §6.12.2, D-ARC-7; tokens/arcade.ts ARCADE_ROLES): never the
// accent, each readable on Arcade's grounds, and far enough apart on every palette (CIE76 ΔE in
// CIELAB, which weighs hue, chroma and lightness at once) that needs you, working, done and failed
// scan apart at a glance and nothing but needs you reads as needs you. A hue-only measure cannot
// do it: done is the plain text, near-neutral, and on Overworld it is as bright as the quest yellow
// (luminance ratio 1.04); they differ in chroma, which ΔE counts.

import { describe, expect, it } from 'vitest';

import { AA_TEXT, contrastRatio, parseHex } from '../../../core/web/lib/look-kit/contrast';
import { STATE_TOKENS } from '../../../ui/state-tokens';
import { PALETTE_IDS, type PaletteId } from '../arcade-catalogue';
import { ARCADE_DEFAULT_PICKS, ARCADE_ROLES, arcadeTokens, type ArcadePaintPicks } from '../arcade';
import type { ColourName } from '../types';

const LOOKS: readonly ArcadePaintPicks[] = PALETTE_IDS.map((palette: PaletteId) => ({
  ...ARCADE_DEFAULT_PICKS,
  palette,
}));

/** sRGB #RRGGBB to CIELAB under D65: the space ΔE measures in. */
function lab(hex: string): readonly [number, number, number] {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIE76 colour difference: hue, chroma and lightness at once (2.3 is a just-noticeable step). */
function deltaE(one: string, other: string): number {
  const [a, b] = [lab(one), lab(other)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** The four states a glance must tell apart: needs you, working, done, failed. */
const SCANNED: readonly ColourName[] = ['warning', 'running', 'success', 'destructive'];
/** Pairwise among SCANNED: far apart on every palette (the closest, Handheld's warning and success, is 34.8). */
const SCAN_APART = 30;
/** Every other status from warning: never close enough to read as needs you (closest: 23.0). */
const NOT_WARNING = 20;

describe('the status roles (PRD-268 §6.12.2, D-ARC-7)', () => {
  const statusKeys = [...new Set(Object.values(STATE_TOKENS))];

  it('maps each to the design’s status-bar colours, never the accent or the highlight', () => {
    expect(Object.fromEntries(statusKeys.map((key) => [key, ARCADE_ROLES[key]]))).toEqual({
      warning: 'qs',
      running: 'mp',
      success: 'tx',
      destructive: 'hp',
      info: 'tx2',
      mutedForeground: 'tx2',
    });
    // the success text tone and the live dot are statuses too ('✓ Started', LIVE)
    for (const key of [...statusKeys, 'olive', 'ccLiveDot'] as ColourName[]) {
      expect(['ac', 'hl'], key).not.toContain(ARCADE_ROLES[key]);
    }
  });

  it.each(LOOKS)('draws each status readable on the window and the page of $palette', (look) => {
    const colours = arcadeTokens(look);
    for (const key of statusKeys) {
      for (const ground of ['card', 'background'] as const) {
        const ratio = contrastRatio(colours[key], colours[ground]);
        expect(ratio, `${key} on ${ground}`).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });

  it.each(LOOKS)('keeps needs you, working, done and failed apart on $palette', (look) => {
    const colours = arcadeTokens(look);
    SCANNED.forEach((one, index) =>
      SCANNED.slice(index + 1).forEach((other) =>
        expect(deltaE(colours[one], colours[other]), `${one} / ${other}`).toBeGreaterThanOrEqual(
          SCAN_APART,
        ),
      ),
    );
  });

  it.each(LOOKS)('lets nothing but needs you read as needs you on $palette', (look) => {
    const colours = arcadeTokens(look);
    for (const key of statusKeys.filter((each) => each !== 'warning')) {
      expect(deltaE(colours[key], colours.warning), key).toBeGreaterThanOrEqual(NOT_WARNING);
    }
  });
});
