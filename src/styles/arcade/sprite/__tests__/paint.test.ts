// What PixelSprite and AgentAvatar draw (D-ARC-5, D-ARC-6, D-TOKENS): the catalogue's sprite
// colours by the palette's art (Handheld's shades in Handheld, the bronze robot on the four dark
// palettes), 32 sprite pixels at the look's pixelScale (the portrait twice that), a frame's runs as
// whole-point rects grouped by colour that cover every drawn pixel exactly once, and the party's
// robots in AGENT_COLOURS by their place in the roster, 32 points at every scale.

import { describe, expect, it } from 'vitest';

import {
  AGENT_COLOURS,
  PALETTE_IDS,
  SPRITE_COLOURS,
  SPRITE_KEYS,
} from '../../../tokens/arcade-catalogue';
import { AGENT_ART } from '../agents-icons';
import { AUTO_SIZE } from '../auto-sprite';
import { frameAt } from '../clock';
import {
  AGENT_KEYS,
  AGENT_PIXEL,
  AGENT_SIDE,
  agentColours,
  agentLayers,
  agentLook,
  spriteColours,
  spriteLayers,
  spritePixel,
  spriteSide,
} from '../paint';
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

describe('the party’s robots (D-ARC-6)', () => {
  it('cycle the four robots by place in the roster', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(agentLook)).toEqual([0, 1, 2, 3, 0, 1, 1]);
    expect(agentLook(-1)).toBe(0);
  });

  it('take AGENT_COLOURS by place, the rest the palette’s sprite colours', () => {
    const sprite = SPRITE_COLOURS.bronze;
    expect(agentColours({ palette: 'overworld' }, 5)).toEqual({
      body: AGENT_COLOURS.bronze[1][0],
      shade: AGENT_COLOURS.bronze[1][1],
      crest: sprite.c,
      o: sprite.o,
      v: sprite.v,
      e: sprite.e,
    });
    expect(agentColours({ palette: 'handheld' }, 2).body).toBe(AGENT_COLOURS.shades[2][0]);
  });

  it('are 32 points at every scale, every drawn pixel covered once on whole points', () => {
    expect(AGENT_SIDE).toBe(32);
    [0, 1, 2, 3].forEach((index) => {
      const runs = AGENT_ART[index];
      const layers = agentLayers({ palette: 'neon' }, index);
      const drawn = runs.reduce((sum, run) => sum + run.width, 0);
      const rects = layers.flatMap((layer) => layer.rects);
      const area = rects.reduce((sum, rect) => sum + rect.width * rect.height, 0);
      expect(area).toBe(drawn * AGENT_PIXEL * AGENT_PIXEL);
      expect(layers.map((layer) => layer.key)).toEqual(
        AGENT_KEYS.filter((key) => runs.some((run) => run.key === key)),
      );
      const colours = agentColours({ palette: 'neon' }, index);
      layers.forEach((layer) => expect(layer.colour).toBe(colours[layer.key]));
    });
  });
});
