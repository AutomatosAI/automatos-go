// What PixelSprite draws (D-ARC-5, D-TOKENS): the catalogue's sprite colours by the palette's art
// (Handheld's shades in Handheld, the bronze robot on the four dark palettes), 32 sprite pixels at
// the look's pixelScale (the portrait twice that), and a frame's runs as whole-point rects grouped
// by colour that cover every drawn pixel exactly once.

import { describe, expect, it } from 'vitest';

import { PALETTE_IDS, SPRITE_COLOURS, SPRITE_KEYS } from '../../../tokens/arcade-catalogue';
import { AUTO_SIZE } from '../auto-sprite';
import { frameAt } from '../clock';
import { spriteColours, spriteLayers, spritePixel, spriteSide } from '../paint';
import { SPRITE_STATES } from '../states';

describe("the sprite's colours", () => {
  it('are Handheld’s shades in Handheld', () => {
    expect(spriteColours({ palette: 'handheld' })).toBe(SPRITE_COLOURS.shades);
  });

  it.each(PALETTE_IDS.filter((id) => id !== 'handheld'))('are the bronze robot in %s', (id) => {
    expect(spriteColours({ palette: id })).toBe(SPRITE_COLOURS.bronze);
  });
});

describe("the sprite's size", () => {
  it('is 32 × the look’s pixel scale, the portrait twice that', () => {
    expect(spritePixel({ pixelScale: '2' }, 'sprite')).toBe(2);
    expect(spritePixel({ pixelScale: '3' }, 'sprite')).toBe(3);
    expect(spriteSide({ pixelScale: '2' }, 'sprite')).toBe(AUTO_SIZE * 2);
    expect(spriteSide({ pixelScale: '3' }, 'sprite')).toBe(96);
    expect(spriteSide({ pixelScale: '2' }, 'portrait')).toBe(128);
    expect(spriteSide({ pixelScale: '3' }, 'portrait')).toBe(192);
  });

  it('draws the status bar’s mark at 32 points, one point a pixel, at every scale', () => {
    expect(spritePixel({ pixelScale: '2' }, 'mark')).toBe(1);
    expect(spritePixel({ pixelScale: '3' }, 'mark')).toBe(1);
    expect(spriteSide({ pixelScale: '2' }, 'mark')).toBe(AUTO_SIZE);
    expect(spriteSide({ pixelScale: '3' }, 'mark')).toBe(32);
  });
});

describe("a frame's layers", () => {
  const colours = SPRITE_COLOURS.bronze;

  it('take each key’s colour, in the catalogue’s key order, leaving out keys with no pixel', () => {
    const layers = spriteLayers(frameAt('idle', 0), colours, 3);
    const order = layers.map((layer) => SPRITE_KEYS.indexOf(layer.key));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    layers.forEach((layer) => {
      expect(layer.colour).toBe(colours[layer.key]);
      expect(layer.rects.length).toBeGreaterThan(0);
    });
    expect(layers.some((layer) => layer.key === 'q')).toBe(false);
  });

  it.each(SPRITE_STATES.map((state) => state.name))(
    'cover every drawn pixel of %s once, on whole points',
    (name) => {
      const frame = frameAt(name, 0);
      const pixel = 3;
      const rects = spriteLayers(frame, colours, pixel).flatMap((layer) => layer.rects);
      const drawn = frame.reduce((sum, run) => sum + run.width, 0);
      const area = rects.reduce((sum, rect) => sum + rect.width * rect.height, 0);
      expect(area).toBe(drawn * pixel * pixel);
      rects.forEach((rect) => {
        [rect.x, rect.y, rect.width, rect.height].forEach((value) =>
          expect(Number.isInteger(value)).toBe(true),
        );
        expect(rect.height).toBe(pixel);
      });
    },
  );
});
