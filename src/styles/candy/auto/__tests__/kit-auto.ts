// The design kit's Auto as the kit's own code draws him (D-CAN-5, KA3-VENDOR-PIN): its
// themes/candy/src/art/{auto-geometry,auto-path}.ts at 3920359d5, run through esbuild in Node on
// 30 Oct 2026. Per state: each part's name, shape kind, box [x, y, w, h] (to 3 decimals) and paint
// kinds; a fingerprint (sha256, first 16 hex) of every part as JSON, gradients and glows included;
// and one of every part's shapePath, joined by newlines. Three paths in full. auto-geometry.test.ts
// pins the vendored files to them.

import { createHash } from 'node:crypto';

import type { MascotName } from '../../../../core/frozen/lib/mascot/types';

export type KitPart = readonly [
  name: string,
  kind: 'rrect' | 'arch',
  box: readonly [number, number, number, number],
  paints: readonly ('solid' | 'linear' | 'radial')[],
];

/** The parts every state shares, bottom first (the eyes come between the shine and the cheeks). */
export const KIT_BELOW_EYES: readonly KitPart[] = [
  ['stalk', 'rrect', [48, 2, 4, 14], ['solid']],
  ['ball', 'rrect', [43, -3, 14, 14], ['linear', 'radial']],
  ['body', 'rrect', [6, 12, 88, 85], ['linear', 'linear', 'radial', 'radial']],
  ['visor', 'rrect', [19.2, 32.4, 61.6, 34], ['linear']],
  ['shine', 'rrect', [26.592, 35.12, 28.336, 7.48], ['solid']],
];
export const KIT_ABOVE_EYES: readonly KitPart[] = [
  ['cheek-left', 'rrect', [15.68, 66.4, 14.08, 9.35], ['solid']],
  ['cheek-right', 'rrect', [70.24, 66.4, 14.08, 9.35], ['solid']],
];

type Box = readonly [number, number, number, number];

/** Per state: the eyes' shape kind, the left and right boxes, and the two fingerprints. */
export type KitState = {
  readonly eye: 'rrect' | 'arch';
  readonly left: Box;
  readonly right: Box;
  readonly parts: string;
  readonly paths: string;
};

export const KIT_STATES: Readonly<Record<MascotName, KitState>> = {
  hello: {
    eye: 'arch',
    left: [32.136, 44.83, 10.472, 14.28],
    right: [57.392, 44.83, 10.472, 14.28],
    parts: 'ec16e7900aa48d1f',
    paths: '691e1cec8ef9983a',
  },
  idle: {
    eye: 'rrect',
    left: [34.6, 40.56, 8.008, 17.68],
    right: [57.392, 40.56, 8.008, 17.68],
    parts: '257568ccc4f3996b',
    paths: '2bb2fa229b75153b',
  },
  listening: {
    eye: 'rrect',
    left: [32.136, 38.52, 10.472, 21.76],
    right: [57.392, 38.52, 10.472, 21.76],
    parts: '0803d9d290cfe223',
    paths: 'b5e9eb76d6fc7ba2',
  },
  thinking: {
    eye: 'rrect',
    left: [35.216, 39.227, 7.392, 11.56],
    right: [57.392, 39.227, 7.392, 11.56],
    parts: 'badbd13a38615a51',
    paths: 'dc3df5c3ef20cc67',
  },
  working: {
    eye: 'rrect',
    left: [34.6, 48.421, 8.008, 12.24],
    right: [57.392, 48.421, 8.008, 12.24],
    parts: '08ba9b6856088e81',
    paths: '39ab89e57500f7a8',
  },
  searching: {
    eye: 'rrect',
    left: [41.376, 41.92, 7.392, 14.96],
    right: [63.552, 41.92, 7.392, 14.96],
    parts: '510c764da32fa42a',
    paths: 'b1a6fd954e48a086',
  },
  reading: {
    eye: 'rrect',
    left: [33.984, 50.624, 8.624, 10.2],
    right: [57.392, 50.624, 8.624, 10.2],
    parts: 'fde534cf40fcde62',
    paths: '86c9699d9fdf69c5',
  },
  celebrate: {
    eye: 'arch',
    left: [32.136, 44.83, 10.472, 14.28],
    right: [57.392, 44.83, 10.472, 14.28],
    parts: 'ec16e7900aa48d1f',
    paths: '691e1cec8ef9983a',
  },
  oops: {
    eye: 'rrect',
    left: [35.216, 44.3, 7.392, 10.2],
    right: [57.392, 44.3, 7.392, 10.2],
    parts: 'f1eadd993e1fbbc8',
    paths: '54a34f40c0d75685',
  },
  sleeping: {
    eye: 'rrect',
    left: [31.52, 47.65, 11.088, 3.5],
    right: [57.392, 47.65, 11.088, 3.5],
    parts: '374094bd70dd4ed3',
    paths: '4d396c1058d6e726',
  },
  lost: {
    eye: 'rrect',
    left: [29.056, 46.34, 7.392, 10.2],
    right: [51.232, 46.34, 7.392, 10.2],
    parts: '21ee611a69af3211',
    paths: '49ed8e5d3a1bca54',
  },
  loading: {
    eye: 'rrect',
    left: [33.368, 46.68, 9.24, 5.44],
    right: [57.392, 46.68, 9.24, 5.44],
    parts: 'dd00cbee885714c2',
    paths: 'f15640a571d27dc2',
  },
};

/** shapePath in full, as the kit wrote it: the body, idle's left eye and a celebrating left eye. */
export const KIT_PATHS = {
  body:
    'M47.36 12 L52.64 12 A41.36 39.95 0 0 1 94 51.95 L94 61.3 A36.96 35.7 0 0 1 57.04 97 ' +
    'L42.96 97 A36.96 35.7 0 0 1 6 61.3 L6 51.95 A41.36 39.95 0 0 1 47.36 12 Z',
  idleEye:
    'M38.604 40.56 L38.604 40.56 A4.004 4.004 0 0 1 42.608 44.564 L42.608 54.236 ' +
    'A4.004 4.004 0 0 1 38.604 58.24 L38.604 58.24 A4.004 4.004 0 0 1 34.6 54.236 ' +
    'L34.6 44.564 A4.004 4.004 0 0 1 38.604 40.56 Z',
  celebrateEye:
    'M37.372 44.83 L37.372 44.83 A5.236 7.14 0 0 1 42.608 51.97 L42.608 59.11 ' +
    'A0 0 0 0 1 42.608 59.11 L32.136 59.11 A0 0 0 0 1 32.136 59.11 L32.136 51.97 ' +
    'A5.236 7.14 0 0 1 37.372 44.83 Z M37.372 48.33 L37.372 48.33 A1.736 3.64 0 0 1 ' +
    '39.108 51.97 L39.108 59.11 A0 0 0 0 1 39.108 59.11 L35.636 59.11 A0 0 0 0 1 35.636 59.11 ' +
    'L35.636 51.97 A1.736 3.64 0 0 1 37.372 48.33 Z',
} as const;

/** The fingerprint the kit's output was pinned with: sha256 of the text, first 16 hex. */
export function fingerprint(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}
