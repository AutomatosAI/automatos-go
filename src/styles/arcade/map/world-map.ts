// The Quests overworld as data (PRD-001 §4.6.1, D-ARC-6, KA3-VENDOR-PIN; the design's drawMap):
// 40 by 24 tiles of 8 pixels, a river down the right third with one bridge, forest west of it
// (Greenwood), rocky peaks to the north-east (Storm Peaks) and a village to the south-east (Hearth
// Village), with paths between them. The tiles come from a fixed hash, so the map is the same every
// time; its colours are the palette's map colours (tokens/arcade-catalogue.ts MapColours, painted
// by map-paint.ts; never a literal here). Each region holds the quests in one state, each on a
// grass tile a stable hash of its id picks. Pure: no React, React Native, Expo or Skia.
//
// Source: AutomatosAI/automatos-design-kit themes/arcade/src/art/world-map.ts at 034fa629c
// (034fa629c8ba79cff042559ca2d132f6d38f6d23), sha256
// 86888cab963aef021db3cfa5189f361b19c454d729eed391291bdd6c8ca55681. The drawing and the placing
// are copied, never retuned: a change starts there. Only the layout is the repo's (semicolons,
// line width) and tileAt is split in two for the lint's complexity 10 (landTile); every tile,
// region, rect and placement is pinned against the kit's own output (__tests__/world-map.test.ts).

export const MAP_COLUMNS = 40;
export const MAP_ROWS = 24;
export const TILE = 8;

export type MapKey =
  'g1' | 'g2' | 't1' | 't2' | 'w1' | 'w2' | 'p1' | 'p2' | 'r1' | 'r2' | 'sn' | 'roof' | 'wall';
export type Tile = 'grass' | 'tree' | 'rock' | 'house' | 'water' | 'bridge' | 'path';
export type Region = 'active' | 'needs' | 'done';

export interface MapRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly key: MapKey;
}

/** The design's tile hash: a number from 0 to 1 for a tile. */
function noise(a: number, b: number): number {
  let n = (a * 374761393 + b * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

/** The river's first column on a row. */
export function riverAt(row: number): number {
  return Math.round(21 + Math.sin(row / 3) * 1.5);
}

function isPath(tx: number, ty: number, river: number): boolean {
  return (
    (ty === 12 && tx >= 2) ||
    (ty === 16 && tx >= river + 2 && tx < 38) ||
    (tx === 30 && ty >= 5 && ty <= 16)
  );
}

/** A land tile off the paths: forest west of the river, peaks north-east, the village south-east. */
function landTile(tx: number, ty: number, river: number): Tile {
  if (tx < river) return noise(tx, ty) < 0.42 ? 'tree' : 'grass';
  if (ty < 11) return noise(tx, ty) < 0.5 ? 'rock' : 'grass';
  if (ty >= 13) return noise(tx, ty) < 0.18 && ty !== 16 ? 'house' : 'grass';
  return 'grass';
}

export function tileAt(tx: number, ty: number): Tile {
  const river = riverAt(ty);
  if (tx >= river && tx < river + 2) return ty === 12 ? 'bridge' : 'water';
  return isPath(tx, ty, river) ? 'path' : landTile(tx, ty, river);
}

export function regionAt(tx: number, ty: number): Region | null {
  const river = riverAt(ty);
  if (tx < river) return 'active';
  if (tx < river + 2) return null;
  if (ty < 11) return 'needs';
  return ty >= 13 ? 'done' : null;
}

type Rects = MapRect[];

function rect(out: Rects, key: MapKey, x: number, y: number, width: number, height: number): void {
  out.push({ x, y, width, height, key });
}

function baseOf(tile: Tile): MapKey {
  if (tile === 'water') return 'w1';
  return tile === 'bridge' || tile === 'path' ? 'p1' : 'g1';
}

/** The ground of every row, one rect per run of tiles with the same ground. */
function grounds(out: Rects): void {
  for (let ty = 0; ty < MAP_ROWS; ty += 1) {
    let tx = 0;
    while (tx < MAP_COLUMNS) {
      const key = baseOf(tileAt(tx, ty));
      let run = 1;
      while (tx + run < MAP_COLUMNS && baseOf(tileAt(tx + run, ty)) === key) run += 1;
      rect(out, key, tx * TILE, ty * TILE, run * TILE, TILE);
      tx += run;
    }
  }
}

function details(out: Rects, tile: Tile, tx: number, ty: number): void {
  const [px, py] = [tx * TILE, ty * TILE];
  if (tile === 'water') {
    rect(out, 'w2', px + 1 + (ty % 2), py + 2, 3, 1);
    rect(out, 'w2', px + 4 - (ty % 2), py + 6, 3, 1);
  } else if (tile === 'bridge') {
    rect(out, 'p2', px, py, TILE, 1);
    rect(out, 'p2', px, py + 7, TILE, 1);
    rect(out, 'p2', px + 3, py + 1, 1, 6);
  } else if (tile === 'path') {
    if (noise(ty, tx) > 0.5) rect(out, 'p2', px + 2, py + 3, 1, 1);
    rect(out, 'p2', px + 6, py + 6, 1, 1);
  } else landDetails(out, tile, px, py, tx, ty);
}

function landDetails(out: Rects, tile: Tile, px: number, py: number, tx: number, ty: number): void {
  if (noise(tx + 7, ty) > 0.45) rect(out, 'g2', px + 2, py + 3, 1, 1);
  if (noise(tx, ty + 9) > 0.6) rect(out, 'g2', px + 5, py + 6, 1, 1);
  if (tile === 'tree') {
    rect(out, 't1', px + 2, py, 4, 1);
    rect(out, 't1', px + 1, py + 1, 6, 4);
    rect(out, 't2', px + 1, py + 4, 6, 1);
    rect(out, 'p2', px + 3, py + 5, 2, 3);
  } else if (tile === 'rock') {
    for (let row = 0; row < 7; row += 1) {
      const width = Math.min(TILE, 2 + row * 2);
      rect(out, 'r1', px + 4 - width / 2, py + 1 + row, width, 1);
      rect(out, 'r2', px + 4, py + 1 + row, width / 2, 1);
    }
    rect(out, 'sn', px + 3, py + 1, 2, 1);
    rect(out, 'sn', px + 2, py + 2, 3, 1);
  } else if (tile === 'house') {
    rect(out, 'roof', px + 2, py + 1, 4, 1);
    rect(out, 'roof', px + 1, py + 2, 6, 1);
    rect(out, 'roof', px, py + 3, TILE, 1);
    rect(out, 'wall', px + 1, py + 4, 6, 4);
    rect(out, 't2', px + 3, py + 5, 2, 3);
  }
}

function drawMap(): readonly MapRect[] {
  const out: Rects = [];
  grounds(out);
  for (let ty = 0; ty < MAP_ROWS; ty += 1)
    for (let tx = 0; tx < MAP_COLUMNS; tx += 1) details(out, tileAt(tx, ty), tx, ty);
  return out;
}

/** The whole map, drawn once. */
export const MAP_RECTS: readonly MapRect[] = drawMap();

// --- Markers ----------------------------------------------------------------------------------

export interface MapSpot {
  readonly tx: number;
  readonly ty: number;
}

/** Rows the region names sit on, kept clear of markers. */
function underLabel(tx: number, ty: number): boolean {
  return ty <= 2 || (tx >= 23 && (ty === 14 || ty === 15));
}

function freeTiles(region: Region): readonly MapSpot[] {
  const tiles: MapSpot[] = [];
  for (let ty = 0; ty < MAP_ROWS; ty += 1) {
    for (let tx = 0; tx < MAP_COLUMNS; tx += 1) {
      if (regionAt(tx, ty) === region && tileAt(tx, ty) === 'grass' && !underLabel(tx, ty))
        tiles.push({ tx, ty });
    }
  }
  return tiles;
}

const FREE: Readonly<Record<Region, readonly MapSpot[]>> = {
  active: freeTiles('active'),
  needs: freeTiles('needs'),
  done: freeTiles('done'),
};

/** FNV-1a over the id's characters: the same id always lands on the same tile. */
export function hashOf(id: string): number {
  let hash = 0x811c9dc5;
  for (const char of id) hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  return hash;
}

const SPACING = 2;

function farFrom(spot: MapSpot, taken: readonly MapSpot[], spacing: number): boolean {
  return taken.every(
    (other) => Math.max(Math.abs(other.tx - spot.tx), Math.abs(other.ty - spot.ty)) > spacing,
  );
}

/** The first tile from the id's own place, going round, that keeps `spacing` from every marker placed. */
function pick(tiles: readonly MapSpot[], start: number, taken: readonly MapSpot[]): MapSpot | null {
  for (const spacing of [SPACING, 0]) {
    for (let step = 0; step < tiles.length; step += 1) {
      const spot = tiles[(start + step) % tiles.length];
      if (farFrom(spot, taken, spacing)) return spot;
    }
  }
  return null;
}

/** A tile for each id in its region, in the order given; an id with no room left gets none. */
export function placeMarkers(
  items: readonly { readonly id: string; readonly region: Region }[],
): ReadonlyMap<string, MapSpot> {
  const placed = new Map<string, MapSpot>();
  items.forEach(({ id, region }) => {
    const tiles = FREE[region];
    if (tiles.length === 0) return;
    const spot = pick(tiles, hashOf(id) % tiles.length, [...placed.values()]);
    if (spot !== null) placed.set(id, spot);
  });
  return placed;
}
