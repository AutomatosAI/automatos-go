// Arcade's pause control (WCAG 2.2.2, D-A11Y): the choice under 'styles.arcade.motionPaused', read
// lazily, a failing store logged and never thrown; whether Arcade moves (the style's loops and the
// pause); the PAUSE / PLAY control and what VoiceOver hears, none under Reduce Motion; and the style
// store holding the pause beside Arcade's looks, so the next launch reads it back.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../../storage/encrypted-storage';
import { appStyleSources, createStyleStore, memorySource } from '../../provider/store';
import { ARCADE_PAUSE_COPY } from '../../strings';
import {
  ARCADE_MOTION_PAUSED_KEY,
  arcadeMotion,
  createMotionPauseSource,
  parseMotionPaused,
  pauseControlOf,
  readMotionPaused,
  saveMotionPaused,
  serialiseMotionPaused,
} from '../motion-pause';

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the pause on the phone', () => {
  it("is kept under 'styles.arcade.motionPaused'", () => {
    const storage = memoryStorage();
    expect(saveMotionPaused(storage, true)).toBe(true);
    expect(storage.getItem(ARCADE_MOTION_PAUSED_KEY)).toBe('true');
    expect(readMotionPaused(storage)).toBe(true);
    saveMotionPaused(storage, false);
    expect(readMotionPaused(storage)).toBe(false);
  });

  it('reads as playing when nothing, or anything but true, is stored', () => {
    expect(parseMotionPaused(null)).toBe(false);
    expect(parseMotionPaused('yes')).toBe(false);
    expect(parseMotionPaused(true)).toBe(false);
    expect(parseMotionPaused(serialiseMotionPaused(true))).toBe(true);
    expect(parseMotionPaused(serialiseMotionPaused(false))).toBe(false);
  });

  it('logs a store that fails and never throws', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    expect(readMotionPaused(failing())).toBe(false);
    expect(saveMotionPaused(failing(), true)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('opens the store only on the first read, and holds a choice it could not save', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const open = vi.fn(failing);
    const source = createMotionPauseSource(open);
    expect(open).not.toHaveBeenCalled();
    expect(source.get()).toBe(false);
    expect(source.set(true)).toBe(false);
    expect(source.get()).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it('treats an unavailable store as playing', () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const source = createMotionPauseSource(() => {
      throw new Error('no keychain');
    });
    expect(source.get()).toBe(false);
    expect(source.set(true)).toBe(false);
  });
});

describe('whether Arcade moves', () => {
  it('moves only while loops may run and nobody paused it', () => {
    expect(arcadeMotion(true, false)).toEqual({ moving: true, paused: false, reduced: false });
    expect(arcadeMotion(true, true)).toEqual({ moving: false, paused: true, reduced: false });
    expect(arcadeMotion(false, false)).toEqual({ moving: false, paused: false, reduced: true });
    expect(arcadeMotion(false, true).moving).toBe(false);
  });
});

describe('the pause control', () => {
  it('says PAUSE while moving: VoiceOver hears "Pause the animation"', () => {
    expect(pauseControlOf(arcadeMotion(true, false))).toEqual({
      word: ARCADE_PAUSE_COPY.pause,
      label: 'Pause the animation',
      paused: false,
    });
  });

  it('says PLAY while paused: VoiceOver hears "Play the animation"', () => {
    expect(pauseControlOf(arcadeMotion(true, true))).toEqual({
      word: ARCADE_PAUSE_COPY.play,
      label: 'Play the animation',
      paused: true,
    });
  });

  it('is not there under Reduce Motion, where nothing moves', () => {
    expect(pauseControlOf(arcadeMotion(false, false))).toBeNull();
    expect(pauseControlOf(arcadeMotion(false, true))).toBeNull();
  });
});

describe('the style store holds the pause', () => {
  it('reads it at launch and keeps a change for the next launch', () => {
    const storage = memoryStorage();
    const store = createStyleStore(appStyleSources(() => storage));
    expect(store.getState().arcadeMotionPaused).toBe(false);
    expect(store.getState().setArcadeMotionPaused(true)).toBe(true);
    expect(store.getState().arcadeMotionPaused).toBe(true);
    expect(createStyleStore(appStyleSources(() => storage)).getState().arcadeMotionPaused).toBe(
      true,
    );
  });

  it('holds it for this launch when the sources keep none', () => {
    const sources = appStyleSources(() => memoryStorage());
    const { arcadeMotionPaused: _kept, ...rest } = sources;
    const store = createStyleStore(rest);
    expect(store.getState().arcadeMotionPaused).toBe(false);
    store.getState().setArcadeMotionPaused(true);
    expect(store.getState().arcadeMotionPaused).toBe(true);
  });

  it('hydrates from any source', () => {
    const sources = {
      ...appStyleSources(() => memoryStorage()),
      arcadeMotionPaused: memorySource(true),
    };
    expect(createStyleStore(sources).getState().arcadeMotionPaused).toBe(true);
  });
});
