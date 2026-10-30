// Arcade's pixel art as data (PRD-001 §4.6.1, D-ARC-5, KA3-VENDOR-PIN): a square-ish grid of colour
// keys (null for a clear pixel), drawn by a small builder, and the runs a renderer draws it with
// (one rect per row of same-coloured pixels). Every key names a sprite colour the palette paints
// (tokens/arcade-catalogue.ts SPRITE_COLOURS), so the same art takes each palette's colours. Pure:
// no React, React Native, Expo or Skia.
//
// Source: AutomatosAI/automatos-design-kit themes/arcade/src/art/grid.ts at 034fa629c
// (034fa629c8ba79cff042559ca2d132f6d38f6d23), sha256
// 838c9beabc31b4f5fbb4a86ccac150179c4d13d7853b9f202951c1e20befc821. The code is copied, never
// retuned: a change starts there. Only the layout is the repo's (semicolons, line width).

export type Grid<K extends string> = readonly (readonly (K | null)[])[];

export interface Run<K extends string> {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly key: K;
}

export type Point = readonly [number, number];

/** A drawing surface for one picture: set pixels, fill boxes, outline shapes, then take the frozen grid. */
export class Canvas<K extends string> {
  private readonly rows: (K | null)[][];

  constructor(
    readonly width: number,
    readonly height: number = width,
  ) {
    this.rows = Array.from({ length: height }, () => Array.from({ length: width }, () => null));
  }

  set(x: number, y: number, key: K): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) this.rows[y][x] = key;
  }

  fill(x: number, y: number, width: number, height: number, key: K): void {
    for (let row = 0; row < height; row += 1)
      for (let column = 0; column < width; column += 1) this.set(x + column, y + row, key);
  }

  /** The points in `key`, and an outline in `outline` around every edge they leave open. */
  blob(points: readonly Point[], key: K, outline: K): void {
    const inside = new Set(points.map(([x, y]) => `${x},${y}`));
    points.forEach(([x, y]) => this.set(x, y, key));
    const sides: readonly Point[] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    points.forEach(([x, y]) =>
      sides.forEach(([a, b]) => {
        if (!inside.has(`${x + a},${y + b}`)) this.set(x + a, y + b, outline);
      }),
    );
  }

  grid(): Grid<K> {
    return this.rows.map((row) => Object.freeze([...row]));
  }
}

/** Every point of a box. */
export function box(x: number, y: number, width: number, height: number): Point[] {
  return Array.from({ length: width * height }, (_, index): Point => [
    x + (index % width),
    y + Math.floor(index / width),
  ]);
}

/** The grid as rows of same-coloured runs, top to bottom, left to right. */
export function runsOf<K extends string>(grid: Grid<K>): readonly Run<K>[] {
  return grid.flatMap((row, y) => {
    const runs: Run<K>[] = [];
    let x = 0;
    while (x < row.length) {
      const key = row[x];
      let width = 1;
      while (key !== null && x + width < row.length && row[x + width] === key) width += 1;
      if (key !== null) runs.push({ x, y, width, key });
      x += width;
    }
    return runs;
  });
}

/** Rows of characters as a grid, each character a key from `keys` and '.' clear. */
export function gridOfRows<K extends string>(
  rows: readonly string[],
  keys: Readonly<Record<string, K>>,
): Grid<K> {
  return rows.map((row) => [...row].map((char) => keys[char] ?? null));
}
