// Auto's twelve sprite states against the design kit (D-ARC-5, KA3-VENDOR-PIN): every frame of every
// state is the kit's, pixel for pixel (kit-frames.ts), so the port's reshaped eyes() and layout
// cannot drift. Also: the vendored mascot names in their order, two to four
// frames each, every pixel a catalogue SpriteKey, the grid builder, and the pure modules' imports.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MASCOT_STATES, type MascotName } from '../../../../core/frozen/lib/mascot/types';
import { SPRITE_KEYS } from '../../../tokens/arcade-catalogue';
import { AUTO_SIZE, drawAuto } from '../auto-sprite';
import { Canvas, box, gridOfRows, runsOf } from '../grid';
import { SPRITE_STATES, spriteState, stateWord } from '../states';
import { KIT_FRAMES, digest } from './kit-frames';

describe("the sprite's states", () => {
  it('are the vendored mascot names, in their order', () => {
    expect(SPRITE_STATES.map((state) => state.name)).toEqual([...MASCOT_STATES]);
  });

  it.each(MASCOT_STATES)('%s draws the kit’s frames, pixel for pixel', (name) => {
    const { frames } = spriteState(name);
    expect(frames.map(digest)).toEqual(KIT_FRAMES[name]);
  });

  it.each(MASCOT_STATES)('%s has two to four frames', (name) => {
    const count = spriteState(name).frames.length;
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(4);
  });

  it('paints only the catalogue’s sprite keys, inside the 32 × 32 grid', () => {
    const keys = new Set<string>(SPRITE_KEYS);
    SPRITE_STATES.flatMap((state) => state.frames.flat()).forEach((run) => {
      expect(keys.has(run.key)).toBe(true);
      expect(run.x).toBeGreaterThanOrEqual(0);
      expect(run.x + run.width).toBeLessThanOrEqual(AUTO_SIZE);
      expect(run.y).toBeGreaterThanOrEqual(0);
      expect(run.y).toBeLessThan(AUTO_SIZE);
    });
  });

  it('says each state in capitals, and falls back to the first for an unknown name', () => {
    expect(stateWord('celebrate')).toBe('CELEBRATE');
    expect(spriteState('nope' as MascotName).name).toBe('hello');
  });

  it('draws the same grid for the same pose', () => {
    expect(drawAuto({ eyes: 'wide', dx: 1 })).toEqual(drawAuto({ eyes: 'wide', dx: 1 }));
    expect(drawAuto({})).toHaveLength(AUTO_SIZE);
  });
});

describe('the grid builder', () => {
  it('keeps pixels inside the canvas and freezes the grid it hands out', () => {
    const canvas = new Canvas<'a'>(3, 2);
    canvas.set(-1, 0, 'a');
    canvas.set(3, 0, 'a');
    canvas.fill(1, 0, 5, 1, 'a');
    const grid = canvas.grid();
    expect(grid).toEqual([
      [null, 'a', 'a'],
      [null, null, null],
    ]);
    expect(Object.isFrozen(grid[0])).toBe(true);
  });

  it('outlines a blob on every open side', () => {
    const canvas = new Canvas<'a' | 'o'>(3);
    canvas.blob([[1, 1]], 'a', 'o');
    expect(canvas.grid()).toEqual([
      [null, 'o', null],
      ['o', 'a', 'o'],
      [null, 'o', null],
    ]);
  });

  it('turns rows into same-coloured runs and rows of characters into a grid', () => {
    const grid = gridOfRows(['aab.', '.bbb'], { a: 'a', b: 'b' });
    expect(runsOf(grid)).toEqual([
      { x: 0, y: 0, width: 2, key: 'a' },
      { x: 2, y: 0, width: 1, key: 'b' },
      { x: 1, y: 1, width: 3, key: 'b' },
    ]);
    expect(box(2, 3, 2, 1)).toEqual([
      [2, 3],
      [3, 3],
    ]);
  });
});

describe('the pure modules (D-SHAPE)', () => {
  const PURE = [
    'grid.ts',
    'auto-sprite.ts',
    'states.ts',
    'clock.ts',
    'turn-state.ts',
    'paint.ts',
    '../motion-pause.ts',
  ];
  const IMPURE = /from '(react|react-native[^']*|expo[^']*|@shopify\/react-native-skia)'/;

  it.each(PURE)('%s imports no React, React Native, Expo or Skia', (file) => {
    const source = readFileSync(path.resolve(__dirname, '..', file), 'utf8');
    expect(source).not.toMatch(IMPURE);
  });

  it('take no colour literal: the sprite’s colours come from the catalogue', () => {
    PURE.forEach((file) => {
      const source = readFileSync(path.resolve(__dirname, '..', file), 'utf8');
      expect(source).not.toMatch(/#[0-9a-fA-F]{6}\b|rgba?\(/);
    });
  });
});
