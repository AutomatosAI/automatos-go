// What the Quests map draws (map-paint.ts; D-ARC-6, D-TOKENS): the kit's rects grouped by colour
// paint the very picture the kit's SVG paints rect by rect (every map pixel's winner the same), in
// each palette's own map colours, scaled to the screen's width; and a marker's 44 pt target sits
// on its tile's centre, held inside the map as the kit's clamp holds it.

import { describe, expect, it } from 'vitest';

import { ARCADE_PRESET_LOOKS } from '../../look-schema';
import { PALETTES } from '../../../tokens/arcade-catalogue';
import {
  MAP_HEIGHT,
  MAP_LAYER_ORDER,
  MAP_WIDTH,
  mapColours,
  mapHeightFor,
  mapLayers,
  markerBox,
} from '../map-paint';
import { MAP_RECTS, type MapKey } from '../world-map';

type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** Paints boxes in order onto a map-pixel grid: the last box over a pixel wins it. */
function paint(boxes: readonly (Box & { readonly key: string })[]): string[] {
  const grid = Array.from({ length: MAP_WIDTH * MAP_HEIGHT }, () => '');
  boxes.forEach((box) => {
    for (let y = box.y; y < box.y + box.height; y += 1)
      for (let x = box.x; x < box.x + box.width; x += 1) grid[y * MAP_WIDTH + x] = box.key;
  });
  return grid;
}

describe('the map’s layers', () => {
  const overworld = ARCADE_PRESET_LOOKS[0];

  it('paint every map pixel as the kit’s rects, in order, paint it', () => {
    const layers = mapLayers(overworld, MAP_WIDTH);
    const byLayer = layers.flatMap((layer) =>
      layer.rects.map((rect) => ({ ...rect, key: layer.key })),
    );
    const kit = paint(MAP_RECTS);
    expect(kit.every((key) => key !== '')).toBe(true);
    expect(paint(byLayer)).toEqual(kit);
  });

  it('are each colour once, every rect drawn', () => {
    expect(new Set(MAP_LAYER_ORDER).size).toBe(MAP_LAYER_ORDER.length);
    const layers = mapLayers(overworld, MAP_WIDTH);
    expect(layers.map((layer) => layer.key)).toEqual(MAP_LAYER_ORDER);
    expect(layers.reduce((count, layer) => count + layer.rects.length, 0)).toBe(MAP_RECTS.length);
  });

  it.each(ARCADE_PRESET_LOOKS.map((look) => [look.palette, look] as const))(
    'take %s’s own map colours',
    (id, look) => {
      const palette = PALETTES.find((each) => each.id === id);
      expect(mapColours(look)).toBe(palette?.map);
      mapLayers(look, MAP_WIDTH).forEach((layer) =>
        expect(layer.colour).toBe(palette?.map[layer.key as MapKey]),
      );
    },
  );

  it('scale to the width the screen gives the map, the tiles keeping their shape', () => {
    expect([MAP_WIDTH, MAP_HEIGHT]).toEqual([320, 192]);
    expect(mapHeightFor(400)).toBe(240);
    const [first] = mapLayers(overworld, MAP_WIDTH)[0].rects;
    const [doubled] = mapLayers(overworld, MAP_WIDTH * 2)[0].rects;
    expect(doubled).toEqual({
      x: first.x * 2,
      y: first.y * 2,
      width: first.width * 2,
      height: first.height * 2,
    });
    expect(mapLayers(overworld, 0).every((layer) => layer.rects.every((r) => r.width === 0))).toBe(
      true,
    );
  });
});

describe('a marker’s box', () => {
  const WIDTH = 360; // 9 pt tiles, 216 pt tall

  it('is a 44 pt target centred on its tile', () => {
    expect(markerBox({ tx: 18, ty: 15 }, WIDTH, 44)).toEqual({
      left: 18.5 * 9 - 22,
      top: 15.5 * 9 - 22,
      size: 44,
    });
  });

  it('is held inside the map on an edge tile (the kit’s clamp)', () => {
    expect(markerBox({ tx: 0, ty: 0 }, WIDTH, 44)).toEqual({ left: 0, top: 0, size: 44 });
    expect(markerBox({ tx: 39, ty: 23 }, WIDTH, 44)).toEqual({
      left: WIDTH - 44,
      top: mapHeightFor(WIDTH) - 44,
      size: 44,
    });
  });

  it('sits in the middle of a map narrower than a target', () => {
    expect(markerBox({ tx: 0, ty: 23 }, 40, 44)).toEqual({ left: -2, top: 12 - 22, size: 44 });
  });
});
