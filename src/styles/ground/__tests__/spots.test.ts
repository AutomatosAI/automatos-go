import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SCREEN_KIND,
  HUD_SPOT,
  PLAY_SPOTS,
  SCREEN_KINDS,
  radialGeometry,
  type ScreenKind,
} from '../spots';

type Drawn = readonly [rx: number, ry: number, x: number, y: number, alpha: number, fade: number];

// Each phone's background in 'Automatos Play Ember.dc.html': radial-gradient(rx ry at x% y%,
// colour at alpha, transparent fade%).
const EMBER_PHONES: Readonly<Record<ScreenKind, { drawn: Drawn; light: string } | null>> = {
  page: { drawn: [360, 300, 0.5, 0.4, 0.16, 0.65], light: 'glow' },
  chat: { drawn: [360, 260, 0.3, 0.92, 0.2, 0.65], light: 'glow' },
  report: { drawn: [360, 260, 0.3, 0.92, 0.24, 0.65], light: 'glow' },
  conversations: null,
  shelf: { drawn: [360, 300, 0.5, 0.4, 0.16, 0.65], light: 'glow' },
  deliverable: null,
  'first-open': { drawn: [360, 300, 0.7, 0.34, 0.26, 0.65], light: 'glow' },
  'not-running': { drawn: [320, 260, 0.5, 0.3, 0.18, 0.7], light: 'dusk' },
  'something-wrong': { drawn: [340, 260, 0.3, 0.9, 0.16, 0.65], light: 'error' },
  lost: { drawn: [320, 300, 0.5, 0.4, 0.16, 0.65], light: 'glow' },
};

describe("Play's spots per screen kind", () => {
  it('has one entry for every screen kind', () => {
    expect(Object.keys(PLAY_SPOTS).sort()).toEqual([...SCREEN_KINDS].sort());
    expect(DEFAULT_SCREEN_KIND).toBe('page');
  });

  it.each(SCREEN_KINDS)('%s sits where its Ember phone draws its light', (kind) => {
    const phone = EMBER_PHONES[kind];
    const spot = PLAY_SPOTS[kind];
    if (!phone) {
      expect(spot).toBeNull();
      return;
    }
    const [radiusX, radiusY, centreX, centreY, alpha, fadeEnd] = phone.drawn;
    expect(spot).toEqual({ radiusX, radiusY, centreX, centreY, alpha, fadeEnd, light: phone.light });
  });

  it("gives screens Ember does not draw the shelf's light", () => {
    expect(PLAY_SPOTS.page).toBe(PLAY_SPOTS.shelf);
  });
});

describe("HUD's spot", () => {
  it("is the phone core's 320 x 320 at 50 % 40 %, gone by 70 %", () => {
    expect(HUD_SPOT).toEqual({ radiusX: 320, radiusY: 320, centreX: 0.5, centreY: 0.4, fadeEnd: 0.7 });
  });
});

describe('radialGeometry', () => {
  it('places the centre on the screen and squashes the circle into the ellipse', () => {
    const chat = PLAY_SPOTS.chat;
    if (!chat) throw new Error('chat has a light');
    expect(radialGeometry(chat, { width: 390, height: 844 })).toEqual({
      cx: 117,
      cy: 776.48,
      r: 360,
      scaleY: 260 / 360,
      positions: [0, 0.65],
    });
  });

  it('keeps the radii in points on a wider phone', () => {
    const geometry = radialGeometry(HUD_SPOT, { width: 440, height: 956 });
    expect(geometry.cx).toBe(220);
    expect(geometry.cy).toBeCloseTo(382.4);
    expect(geometry.r).toBe(320);
    expect(geometry.scaleY).toBe(1);
  });
});
