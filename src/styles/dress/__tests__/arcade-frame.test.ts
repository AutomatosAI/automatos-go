// Arcade's window on a shared panel (US-022h, README 'Windows'): the Card's border is the window's
// outer line and the rest rides on its boxShadow, top first — Classic's gap in the window colour,
// its inner line and the 1 pt bevel (light top-left over dark bottom-right), then the 6 pt hard
// drop; Thin is its one 2 pt line and a 4 pt drop. The rings reach exactly as deep into the panel
// as ArcadeWindow's do, so a panel and a window measure the same.

import { describe, expect, it } from 'vitest';

import { ringsDepth, windowRings } from '../../arcade/parts/window-frame';
import { ARCADE_WINDOW_FRAMES, ARCADE_WINDOW_STYLES } from '../../tokens/arcade';
import { arcadePanelFrame, type ArcadeFrameColours } from '../arcade-frame';

const COLOURS: ArcadeFrameColours = {
  line: 'line',
  gap: 'gap',
  bevelLight: 'light',
  bevelDark: 'dark',
  shadow: 'shadow',
};

const frameOf = (style: (typeof ARCADE_WINDOW_STYLES)[number]) =>
  arcadePanelFrame(windowRings(ARCADE_WINDOW_FRAMES[style]), COLOURS);

describe('arcadePanelFrame', () => {
  it('draws Classic: a 2 pt border, the gap, the inner line, the bevel and the 6 pt drop', () => {
    const frame = frameOf('classic');
    expect(frame.borderWidth).toBe(2);
    expect(frame.layers).toEqual([
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 2, color: 'gap', inset: true },
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 4, color: 'line', inset: true },
      { offsetX: 1, offsetY: 1, blurRadius: 0, spreadDistance: 4, color: 'light', inset: true },
      { offsetX: -1, offsetY: -1, blurRadius: 0, spreadDistance: 4, color: 'dark', inset: true },
      { offsetX: 6, offsetY: 6, blurRadius: 0, spreadDistance: 0, color: 'shadow' },
    ]);
  });

  it('draws Thin: its one 2 pt line as the border and a 4 pt drop', () => {
    const frame = frameOf('thin');
    expect(frame.borderWidth).toBe(2);
    expect(frame.layers).toEqual([
      { offsetX: 4, offsetY: 4, blurRadius: 0, spreadDistance: 0, color: 'shadow' },
    ]);
  });

  it('reaches as deep into the panel as an ArcadeWindow’s rings, in every window style', () => {
    for (const style of ARCADE_WINDOW_STYLES) {
      const rings = windowRings(ARCADE_WINDOW_FRAMES[style]);
      const frame = frameOf(style);
      const inset = frame.layers.filter((layer) => layer.inset);
      const deepest = Math.max(
        0,
        ...inset.map((layer) => layer.spreadDistance + Math.abs(layer.offsetX)),
      );
      expect(frame.borderWidth + deepest, style).toBe(ringsDepth(rings));
    }
  });

  it('keeps every edge hard, the drop the only shadow outside the panel', () => {
    for (const style of ARCADE_WINDOW_STYLES) {
      const { layers } = frameOf(style);
      expect(layers.every((layer) => layer.blurRadius === 0)).toBe(true);
      expect(layers.filter((layer) => !layer.inset)).toHaveLength(1);
      expect(layers.at(-1)?.color).toBe('shadow');
    }
  });

  it('freezes the frame', () => {
    const frame = frameOf('classic');
    expect(Object.isFrozen(frame)).toBe(true);
    expect(Object.isFrozen(frame.layers)).toBe(true);
  });
});
