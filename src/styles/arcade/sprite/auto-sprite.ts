// Auto as Arcade draws him (PRD-001 §4.6.1, D-ARC-5, KA3-VENDOR-PIN): an original round robot 32 by
// 32 pixels (a bronze shell, a dark visor, mint eyes and a single crest), drawn from code as the
// design's mock draws him ("Automatos Arcade.dc.html", drawAuto), one pose at a time. A pose moves
// him (dx, dy), sets his arms and eyes, and adds an effect (a thought bubble, a "z", a "?",
// sparkles, a drop, an orbiting light). The keys are the catalogue's SpriteKey; the colours are
// the palette's (sprite/paint.ts), never here. Pure: the same pose always draws the same grid; no
// React, React Native, Expo or Skia.
//
// Source: AutomatosAI/automatos-design-kit themes/arcade/src/art/auto-sprite.ts at 034fa629c
// (034fa629c8ba79cff042559ca2d132f6d38f6d23), sha256
// 62d80021ff3116e2f760df49ce7e770163a277cd16d88e10d099e750a05c4837. The drawing is copied, never
// retuned: a change starts there. The layout is the repo's (semicolons, line width); for the repo's
// complexity limit of 10, eyes()'s chain of eleven kinds is a table (EYE_BOXES) and effect()'s
// branches are small functions (dots, zee, sparkles, spark, drop). Every frame is pinned against
// the kit's own output (__tests__/kit-frames.ts).

import type { SpriteKey } from '../../tokens/arcade-catalogue';
import { box, Canvas, type Grid, type Point } from './grid';

export const AUTO_SIZE = 32;

export type Arms = 'down' | 'up' | 'wave1' | 'wave2' | 'tap1' | 'tap2' | 'out';
type PageEyes = 'page0' | 'page1' | 'page2';
export type Eyes =
  | 'open'
  | 'blink'
  | 'happy'
  | 'wide'
  | 'up'
  | 'left'
  | 'right'
  | 'small'
  | 'narrow'
  | 'line'
  | PageEyes;
export type Effect =
  | 'dots1'
  | 'dots2'
  | 'dots3'
  | 'z1'
  | 'z2'
  | 'z3'
  | 'q0'
  | 'q1'
  | 'sp1'
  | 'sp2'
  | 'spark'
  | 'drop'
  | 'o0'
  | 'o1'
  | 'o2'
  | 'o3';

export interface Pose {
  readonly dx?: number;
  readonly dy?: number;
  readonly arms?: Arms;
  readonly eyes?: Eyes;
  readonly fx?: Effect;
}

type Draw = Canvas<SpriteKey>;
type BoxSpec = readonly [number, number, number, number];

const ARMS: Readonly<Record<Arms, readonly BoxSpec[]>> = {
  down: [
    [4, 19, 2, 4],
    [26, 19, 2, 4],
  ],
  up: [
    [4, 9, 2, 5],
    [26, 9, 2, 5],
  ],
  wave1: [
    [4, 19, 2, 4],
    [26, 9, 2, 5],
  ],
  wave2: [
    [4, 19, 2, 4],
    [27, 7, 2, 5],
  ],
  tap1: [
    [5, 22, 3, 2],
    [24, 20, 3, 2],
  ],
  tap2: [
    [5, 20, 3, 2],
    [24, 22, 3, 2],
  ],
  out: [
    [1, 17, 5, 2],
    [26, 17, 5, 2],
  ],
};

const CREST: readonly Point[] = [
  [17, 3],
  [16, 4],
  [17, 4],
  [18, 4],
  [15, 5],
  [16, 5],
  [17, 5],
  [18, 5],
  [15, 6],
  [16, 6],
  [17, 6],
  [15, 7],
  [16, 7],
  [17, 7],
  [16, 8],
];

function shadow(draw: Draw, dy: number): void {
  const spread = Math.max(3, 7 + Math.min(0, dy));
  for (let x = 16 - spread; x < 16 + spread; x += 1) draw.set(x, 30, 'g');
  for (let x = 18 - spread; x < 14 + spread; x += 1) draw.set(x, 31, 'g');
}

function arms(draw: Draw, pose: Arms, dx: number, dy: number): void {
  ARMS[pose].forEach(([x, y, width, height]) =>
    draw.blob(box(x + dx, y + dy, width, height), 's', 'o'),
  );
}

function crest(draw: Draw, dx: number, dy: number): void {
  const points = CREST.map(([x, y]): Point => [x + dx, y + dy]);
  draw.blob(points, 'c', 'o');
  points.forEach(([x, y]) => {
    if (x - dx >= 17 && y - dy >= 5) draw.set(x, y, 'c2');
  });
}

function shell(draw: Draw, cx: number, cy: number): void {
  for (let y = 0; y < AUTO_SIZE; y += 1) {
    for (let x = 0; x < AUTO_SIZE; x += 1) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (distance > 10) continue;
      if (distance > 8.9) {
        draw.set(x, y, 'o');
        continue;
      }
      const shine = Math.hypot(x + 0.5 - (cx - 4), y + 0.5 - (cy - 5));
      draw.set(x, y, shine < 2.6 ? 'h' : x + 0.5 - cx + (y + 0.5 - cy) > 8 ? 'd' : 's');
    }
  }
}

function visor(draw: Draw, cx: number, cy: number): void {
  for (let y = cy - 5; y <= cy + 2; y += 1) {
    for (let x = cx - 7; x <= cx + 6; x += 1) {
      const corner = (y === cy - 5 || y === cy + 2) && (x === cx - 7 || x === cx + 6);
      if (!corner) draw.set(x, y, 'v');
    }
  }
  draw.set(cx - 6, cy - 4, 'v2');
  draw.set(cx - 5, cy - 4, 'v2');
  draw.set(cx - 6, cy - 3, 'v2');
}

function page(draw: Draw, cx: number, cy: number, offset: number): void {
  draw.fill(cx - 5, cy - 4, 10, 6, 'w');
  [0, 2, 4].forEach((row) =>
    draw.fill(cx - 4, cy - 4 + ((row + offset) % 6), row === 2 ? 5 : 8, 1, 'v2'),
  );
}

/**
 * The kit's pair(x1, x2, y, width, height, key) for each eye kind that is a pair of boxes, as
 * offsets from the left eye (l), the right eye (r) and the eyes' top (t): [l+, r+, t+, w, h, key].
 */
type EyeBox = readonly [number, number, number, number, number, SpriteKey];
type BoxEyes = Exclude<Eyes, 'happy' | PageEyes>;

const EYE_BOXES: Readonly<Record<BoxEyes, EyeBox>> = {
  open: [0, 0, 0, 2, 3, 'e'],
  blink: [0, 0, 2, 2, 1, 'e'],
  wide: [-1, 0, -1, 3, 4, 'e'],
  up: [0, 0, -1, 2, 2, 'e'],
  left: [-1, -1, 0, 2, 3, 'e'],
  right: [1, 1, 0, 2, 3, 'e'],
  small: [1, 0, 1, 1, 2, 'e'],
  narrow: [-1, 0, 1, 3, 1, 'e'],
  line: [-1, 0, 2, 3, 1, 'e2'],
};

const HAPPY: readonly Point[] = [
  [0, 1],
  [1, 0],
  [2, 0],
  [3, 1],
];

function isPage(kind: Eyes): kind is PageEyes {
  return kind.startsWith('page');
}

function eyes(draw: Draw, kind: Eyes, cx: number, cy: number): void {
  const [l, r, t] = [cx - 4, cx + 2, cy - 3];
  if (isPage(kind)) {
    page(draw, cx, cy, Number(kind.slice(4)));
    return;
  }
  if (kind === 'happy') {
    HAPPY.forEach(([a, b]) => {
      draw.set(l - 1 + a, t + b, 'e');
      draw.set(r - 1 + a, t + b, 'e');
    });
    return;
  }
  const [left, right, top, width, height, key] = EYE_BOXES[kind];
  draw.fill(l + left, t + top, width, height, key);
  draw.fill(r + right, t + top, width, height, key);
  if (kind === 'wide') {
    draw.set(l - 1, t - 1, 'w');
    draw.set(r, t - 1, 'w');
  }
}

const Z_AT: Readonly<Record<string, Point>> = { z1: [23, 9], z2: [25, 6], z3: [27, 2] };
const Z_SHAPE: readonly Point[] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [2, 1],
  [1, 2],
  [0, 3],
  [1, 3],
  [2, 3],
  [3, 3],
];
const QUESTION = ['.QQ.', 'Q..Q', '...Q', '..Q.', '....', '..Q.'];
const SPARKLES: Readonly<Record<string, readonly Point[]>> = {
  sp1: [
    [4, 5],
    [27, 3],
    [3, 25],
  ],
  sp2: [
    [6, 2],
    [28, 11],
    [28, 25],
  ],
};
const SPARKLE: readonly Point[] = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const ORBIT: readonly Point[] = [
  [15, 1],
  [28, 17],
  [15, 27],
  [2, 17],
];

function question(draw: Draw, left: number): void {
  const points = QUESTION.flatMap((row, j) =>
    [...row].flatMap((char, i): Point[] => (char === 'Q' ? [[left + i, 1 + j]] : [])),
  );
  draw.blob(points, 'q', 'o');
}

function dots(draw: Draw, count: number): void {
  draw.blob(box(22, 1, 9, 5), 'w', 'o');
  for (let i = 0; i < count; i += 1) draw.set(24 + i * 2, 3, 'o');
  draw.set(21, 7, 'w');
}

function zee(draw: Draw, [zx, zy]: Point): void {
  Z_SHAPE.forEach(([a, b]) => draw.set(zx + a, zy + b, 'w'));
}

function sparkles(draw: Draw, points: readonly Point[]): void {
  points.forEach(([x, y]) => SPARKLE.forEach(([a, b]) => draw.set(x + a, y + b, 'k')));
}

function spark(draw: Draw): void {
  draw.set(29, 19, 'k');
  draw.set(30, 18, 'k');
  draw.set(28, 18, 'k');
}

function drop(draw: Draw, dx: number): void {
  const points: readonly Point[] = [
    [25 + dx, 7],
    [24 + dx, 8],
    [25 + dx, 8],
    [24 + dx, 9],
    [25 + dx, 9],
  ];
  draw.blob(points, 'b', 'o');
}

function effect(draw: Draw, fx: Effect, dx: number): void {
  if (fx.startsWith('dots')) dots(draw, Number(fx.slice(4)));
  else if (fx in Z_AT) zee(draw, Z_AT[fx]);
  else if (fx === 'q0' || fx === 'q1') question(draw, fx === 'q0' ? 24 : 25);
  else if (fx in SPARKLES) sparkles(draw, SPARKLES[fx]);
  else if (fx === 'spark') spark(draw);
  else if (fx === 'drop') drop(draw, dx);
  else orbit(draw, Number(fx.slice(1)));
}

function orbit(draw: Draw, step: number): void {
  const [x, y] = ORBIT[step];
  const [px, py] = ORBIT[(step + 3) % ORBIT.length];
  draw.fill(px, py, 2, 2, 'e2');
  draw.fill(x, y, 2, 2, 'e');
}

/** Auto in one pose. */
export function drawAuto(pose: Pose): Grid<SpriteKey> {
  const draw = new Canvas<SpriteKey>(AUTO_SIZE);
  const { dx = 0, dy = 0 } = pose;
  const [cx, cy] = [16 + dx, 18 + dy];
  shadow(draw, dy);
  arms(draw, pose.arms ?? 'down', dx, dy);
  crest(draw, dx, dy);
  shell(draw, cx, cy);
  visor(draw, cx, cy);
  eyes(draw, pose.eyes ?? 'open', cx, cy);
  if (pose.fx) effect(draw, pose.fx, dx);
  return draw.grid();
}
