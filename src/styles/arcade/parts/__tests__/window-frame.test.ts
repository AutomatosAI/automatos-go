// Arcade's window and scanlines (window-frame.ts; the kit's theme.css --arcade-winsh and
// --arcade-scan): Classic and Thin as nested rings with the CSS recipe's widths, the shadow as the
// ring box moved by the drop, and scanlines that sit behind text at the look's style, never where a
// line would take a text colour of the window below AA, in every palette.

import { describe, expect, it } from 'vitest';

import { AA_TEXT, relativeLuminance } from '../../../../core/web/lib/look-kit/contrast';
import { PALETTE_IDS, PALETTES, type ScanlineId } from '../../../tokens/arcade-catalogue';
import { ARCADE_WINDOW_FRAMES, arcadeScanColour } from '../../../tokens/arcade';
import { ARCADE_PRESET_LOOKS } from '../../look-schema';
import {
  GROUND_TEXT,
  ringsDepth,
  scanPlan,
  scannedContrast,
  scannedGround,
  windowRings,
  type WindowGround,
} from '../window-frame';

const SCANLINES: readonly ScanlineId[] = ['off', 'soft', 'strong'];
const GROUNDS: readonly WindowGround[] = ['win', 'page'];

describe('the window’s rings (README Windows)', () => {
  it('draws Classic as a 2 pt border, a 2 pt gap and a 2 pt border, a 1 pt bevel, a 6 pt drop', () => {
    const rings = windowRings(ARCADE_WINDOW_FRAMES.classic);
    expect(rings).toEqual({ outer: 2, gap: 2, border: 2, bevel: 1, drop: 6 });
    expect(ringsDepth(rings)).toBe(7);
  });

  it('draws Thin as one 2 pt line and a 4 pt drop', () => {
    const rings = windowRings(ARCADE_WINDOW_FRAMES.thin);
    expect(rings).toEqual({ outer: 0, gap: 0, border: 2, bevel: 0, drop: 4 });
    expect(ringsDepth(rings)).toBe(2);
  });

  it('casts the shadow the ring box moved by the drop: the CSS spread is the outer ring', () => {
    Object.values(ARCADE_WINDOW_FRAMES).forEach((frame) => {
      expect(frame.spread).toBe(frame.ring3);
    });
  });
});

describe('the scanlines (README Look and feel; tokens/arcade.ts)', () => {
  it('are not drawn at Off, in any palette or on any ground', () => {
    PALETTE_IDS.forEach((palette) => {
      GROUNDS.forEach((ground) => {
        expect(scanPlan({ palette, scanlines: 'off' }, ground)).toBeNull();
      });
    });
  });

  it('draw Soft as a 1 pt line every 3 pt and Strong as 2 pt every 4, in the tone’s ink', () => {
    const soft = { palette: 'overworld', scanlines: 'soft' } as const;
    const strong = { palette: 'neon', scanlines: 'strong' } as const;
    expect(scanPlan(soft, 'win')).toEqual({ line: 1, period: 3, colour: arcadeScanColour(soft) });
    expect(scanPlan(strong, 'win')).toEqual({
      line: 2,
      period: 4,
      colour: arcadeScanColour(strong),
    });
  });

  it('darken the ground by the ink at the style’s alpha, and leave it at Off', () => {
    const { win } = PALETTES[0].colours;
    expect(scannedGround({ palette: 'overworld', scanlines: 'off' }, 'win')).toBe(win);
    const soft = scannedGround({ palette: 'overworld', scanlines: 'soft' }, 'win');
    expect(soft).not.toBe(win);
    expect(relativeLuminance(soft)).toBeLessThan(relativeLuminance(win));
  });

  it('never leave a text colour of the window below AA where they are drawn', () => {
    PALETTE_IDS.forEach((palette) => {
      SCANLINES.forEach((scanlines) => {
        GROUNDS.forEach((ground) => {
          const drawn = scanPlan({ palette, scanlines }, ground) !== null;
          const keeps = scannedContrast({ palette, scanlines }, ground) >= AA_TEXT;
          expect(!drawn || keeps, `${palette} ${scanlines} on ${ground}`).toBe(true);
        });
      });
    });
  });

  it('are drawn in every preset as it ships, on the window and on the page', () => {
    ARCADE_PRESET_LOOKS.forEach((look) => {
      GROUNDS.forEach((ground) => {
        expect(scanPlan(look, ground), `${look.id} on ${ground}`).not.toBeNull();
      });
    });
  });

  it('measure the window’s text and the game colours, and the page’s text and accent', () => {
    expect(GROUND_TEXT.win).toEqual(['tx', 'tx2', 'ac', 'hp', 'xp', 'mp', 'qs']);
    expect(GROUND_TEXT.page).toEqual(['tx', 'tx2', 'ac']);
  });
});
