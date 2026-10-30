// What the Quests map draws, pure (PRD-001 §4.6.1 D-ARC-6, D-TOKENS; the design kit's
// quests/map-view.tsx and quests.module.css at 034fa629c): the overworld's rects (world-map.ts
// MAP_RECTS, 40 × 24 tiles of 8 map pixels) in the palette's map colours (the catalogue's
// MapColours, never a literal here), scaled to the width the screen gives the map, grouped by
// colour so Skia draws one path per colour with no antialiasing (MapTerrain.tsx). The kit's SVG
// paints its rects in order; the layers paint in MAP_LAYER_ORDER, which gives every overlap (a
// tree's shade over its crown, a door over its wall, snow over a peak) the same winner, pixel for
// pixel (map-paint.test.ts paints both). A marker is a 44 pt target centred on its tile and held
// inside the map, as the kit's 1.0.0 clamp holds it. Pure: no React, React Native, Expo or Skia.

import type { MapColours } from '../../tokens/arcade-catalogue';
import { arcadePalette, type ArcadePaintPicks } from '../../tokens/arcade';
import type { ArtLayer, SpriteRect } from '../sprite/paint';
import { MAP_COLUMNS, MAP_RECTS, MAP_ROWS, TILE, type MapKey, type MapSpot } from './world-map';

/** The map in map pixels: 320 × 192. */
export const MAP_WIDTH = MAP_COLUMNS * TILE;
export const MAP_HEIGHT = MAP_ROWS * TILE;

/**
 * The order the colours paint in: the grounds, then the specks and planks on them, then the
 * crowns, peaks, roofs and walls, the shade last (a tree's lower crown, a house's door).
 */
export const MAP_LAYER_ORDER: readonly MapKey[] = Object.freeze([
  'g1',
  'w1',
  'p1',
  'g2',
  'w2',
  'p2',
  't1',
  'r1',
  'r2',
  'sn',
  'roof',
  'wall',
  't2',
]);

export type MapLayer = ArtLayer<MapKey>;

/** The palette's map colours. */
export function mapColours(look: Pick<ArcadePaintPicks, 'palette'>): MapColours {
  return arcadePalette(look.palette).map;
}

/** The map's height at this width: the tiles keep their 40 × 24 shape. */
export function mapHeightFor(width: number): number {
  return (width * MAP_ROWS) / MAP_COLUMNS;
}

function scaled(rect: SpriteRect, scale: number): SpriteRect {
  return Object.freeze({
    x: rect.x * scale,
    y: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  });
}

/** The map's rects by colour, in MAP_LAYER_ORDER, scaled to `width` points. */
export function mapLayers(
  look: Pick<ArcadePaintPicks, 'palette'>,
  width: number,
): readonly MapLayer[] {
  const scale = width > 0 ? width / MAP_WIDTH : 0;
  const colours = mapColours(look);
  const layers = MAP_LAYER_ORDER.map((key) => {
    const rects = MAP_RECTS.filter((rect) => rect.key === key).map((rect) => scaled(rect, scale));
    return Object.freeze({ key, colour: colours[key], rects: Object.freeze(rects) });
  });
  return Object.freeze(layers.filter((layer) => layer.rects.length > 0));
}

// ── Markers ──────────────────────────────────────────────────────────────────────────────────

export type MarkerBox = {
  readonly left: number;
  readonly top: number;
  readonly size: number;
};

/** One axis: the tile's centre, held half a target in from each side (a map narrower than a target: its middle). */
function heldCentre(tile: number, tiles: number, length: number, half: number): number {
  const centre = ((tile + 0.5) / tiles) * length;
  if (length <= half * 2) return length / 2;
  return Math.min(Math.max(centre, half), length - half);
}

/** A marker's box on a map `width` points wide: `target` square, centred on its tile, inside the map. */
export function markerBox(spot: MapSpot, width: number, target: number): MarkerBox {
  const half = target / 2;
  const height = mapHeightFor(width);
  const x = heldCentre(spot.tx, MAP_COLUMNS, width, half);
  const y = heldCentre(spot.ty, MAP_ROWS, height, half);
  return Object.freeze({ left: x - half, top: y - half, size: target });
}
