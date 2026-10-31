// Candy's pause (D-CAN-5, D-A11Y; WCAG 2.2.2): the phone's own choice under
// 'styles.candy.motionPaused', parsed and saved as Arcade's through the keyed factory, read lazily,
// a failing store logged and never thrown; whether Candy moves (the style's loops, the look's
// Motion and the pause); the Pause / Play control and what VoiceOver hears, none under Reduce
// Motion or while the look's Motion is 'paused'; and the style store holding the pause beside
// Candy's looks, apart from Arcade's, so the next launch reads it back.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../../storage/encrypted-storage';
import { ARCADE_MOTION_PAUSED_KEY, keyedMotionPause } from '../../arcade/motion-pause';
import { appStyleSources, createStyleStore, memorySource } from '../../provider/store';
import {
  CANDY_MOTION_PAUSED_KEY,
  candyMotion,
  candyPauseControlOf,
  createCandyMotionPauseSource,
  readCandyMotionPaused,
  saveCandyMotionPaused,
  type CandyMotionInput,
} from '../motion-pause';
import { CANDY_PAUSE_COPY } from '../strings';

function failing(): KeyValueStorage {
  return {
    getItem: () => {
      throw new Error('keychain locked');
    },
    setItem: () => {
      throw new Error('disk full');
    },
    removeItem: () => undefined,
  };
}

const MOVING: CandyMotionInput = Object.freeze({
  loops: true,
  reduceMotion: false,
  paused: false,
  lookPaused: false,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the pause on the phone', () => {
  it("is kept under 'styles.candy.motionPaused', apart from Arcade's", () => {
    const storage = memoryStorage();
    expect(CANDY_MOTION_PAUSED_KEY).toBe('styles.candy.motionPaused');
    expect(saveCandyMotionPaused(storage, true)).toBe(true);
    expect(storage.getItem(CANDY_MOTION_PAUSED_KEY)).toBe('true');
    expect(storage.getItem(ARCADE_MOTION_PAUSED_KEY)).toBeNull();
    expect(readCandyMotionPaused(storage)).toBe(true);
    saveCandyMotionPaused(storage, false);
    expect(readCandyMotionPaused(storage)).toBe(false);
  });

  it("reads as playing when nothing, or anything but 'true', is stored", () => {
    const storage = memoryStorage();
    expect(readCandyMotionPaused(storage)).toBe(false);
    storage.setItem(CANDY_MOTION_PAUSED_KEY, 'yes');
    expect(readCandyMotionPaused(storage)).toBe(false);
  });

  it("logs a store that fails in Candy's name and never throws", () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    expect(readCandyMotionPaused(failing())).toBe(false);
    expect(saveCandyMotionPaused(failing(), true)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]?.[0])).toContain("Candy's pause");
  });

  it('opens the store only on the first read, and holds a choice it could not save', () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const open = vi.fn(failing);
    const source = createCandyMotionPauseSource(open);
    expect(open).not.toHaveBeenCalled();
    expect(source.get()).toBe(false);
    expect(source.set(true)).toBe(false);
    expect(source.get()).toBe(true);
  });

  it('treats an unavailable store as playing', () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const source = createCandyMotionPauseSource(() => {
      throw new Error('no keychain');
    });
    expect(source.get()).toBe(false);
    expect(source.set(true)).toBe(false);
  });

  it('comes from the keyed factory any style can key', () => {
    const storage = memoryStorage();
    const other = keyedMotionPause('styles.test.motionPaused', "Test's pause");
    expect(other.key).toBe('styles.test.motionPaused');
    expect(other.save(storage, true)).toBe(true);
    expect(other.read(storage)).toBe(true);
    expect(readCandyMotionPaused(storage)).toBe(false);
    expect(other.source(() => storage).get()).toBe(true);
  });
});

describe('whether Candy moves', () => {
  it("moves only while loops may run, the look's Motion is on and nobody paused it", () => {
    expect(candyMotion(MOVING)).toEqual({
      moving: true,
      paused: false,
      reduced: false,
      lookPaused: false,
    });
    expect(candyMotion({ ...MOVING, paused: true })).toMatchObject({ moving: false, paused: true });
  });

  it('is still under Reduce Motion, which leaves no control', () => {
    const reduced = candyMotion({ ...MOVING, loops: false, reduceMotion: true });
    expect(reduced).toMatchObject({ moving: false, reduced: true });
    expect(
      candyMotion({ ...MOVING, loops: false, reduceMotion: true, lookPaused: true }).reduced,
    ).toBe(true);
  });

  it("is still while the look's Motion is 'paused' (not Reduce Motion)", () => {
    const look = candyMotion({ ...MOVING, loops: false, lookPaused: true });
    expect(look).toEqual({ moving: false, paused: false, reduced: false, lookPaused: true });
    expect(candyMotion({ ...MOVING, lookPaused: true }).moving).toBe(false);
  });

  it("is still, with no control, when another style's loops are off", () => {
    expect(candyMotion({ ...MOVING, loops: false })).toMatchObject({
      moving: false,
      reduced: true,
    });
  });
});

describe('the pause control', () => {
  it("says Pause while moving: VoiceOver hears 'Pause the animation'", () => {
    expect(candyPauseControlOf(candyMotion(MOVING))).toEqual({
      word: CANDY_PAUSE_COPY.pause,
      label: 'Pause the animation',
      paused: false,
    });
  });

  it("says Play while paused: VoiceOver hears 'Play the animation'", () => {
    expect(candyPauseControlOf(candyMotion({ ...MOVING, paused: true }))).toEqual({
      word: CANDY_PAUSE_COPY.play,
      label: 'Play the animation',
      paused: true,
    });
  });

  it("is not there under Reduce Motion or while the look's Motion is 'paused'", () => {
    const reduced = { ...MOVING, loops: false, reduceMotion: true };
    expect(candyPauseControlOf(candyMotion(reduced))).toBeNull();
    expect(candyPauseControlOf(candyMotion({ ...reduced, paused: true }))).toBeNull();
    const look = { ...MOVING, loops: false, lookPaused: true };
    expect(candyPauseControlOf(candyMotion(look))).toBeNull();
  });
});

describe('the style store holds the pause', () => {
  it("reads it at launch and keeps a change for the next launch, apart from Arcade's", () => {
    const storage = memoryStorage();
    const store = createStyleStore(appStyleSources(() => storage));
    expect(store.getState().candyMotionPaused).toBe(false);
    expect(store.getState().setCandyMotionPaused(true)).toBe(true);
    expect(store.getState().candyMotionPaused).toBe(true);
    expect(store.getState().arcadeMotionPaused).toBe(false);
    const next = createStyleStore(appStyleSources(() => storage)).getState();
    expect(next.candyMotionPaused).toBe(true);
    expect(next.arcadeMotionPaused).toBe(false);
  });

  it('holds it for this launch when the sources keep none', () => {
    const sources = appStyleSources(() => memoryStorage());
    const { candyMotionPaused: _kept, ...rest } = sources;
    const store = createStyleStore(rest);
    expect(store.getState().candyMotionPaused).toBe(false);
    store.getState().setCandyMotionPaused(true);
    expect(store.getState().candyMotionPaused).toBe(true);
  });

  it('hydrates from any source', () => {
    const sources = {
      ...appStyleSources(() => memoryStorage()),
      candyMotionPaused: memorySource(true),
    };
    expect(createStyleStore(sources).getState().candyMotionPaused).toBe(true);
  });
});
