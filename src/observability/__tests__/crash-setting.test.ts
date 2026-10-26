// The 'Send crash reports' switch (R03, KR7): default on, off only when the user said so, read once
// per launch from its own store, and off for the launch when that store cannot be read.

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { logger } from '../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../storage/encrypted-storage';
import {
  CRASH_SETTING_KEY,
  createCrashSetting,
  parseCrashSetting,
  serializeCrashSetting,
} from '../crash-setting';

function failingStorage(failOn: 'read' | 'write'): KeyValueStorage {
  const store = memoryStorage();
  return {
    getItem: (key) => {
      if (failOn === 'read') throw new Error('mmkv read failed');
      return store.getItem(key);
    },
    setItem: (key, value) => {
      if (failOn === 'write') throw new Error('mmkv write failed');
      store.setItem(key, value);
    },
    removeItem: (key) => store.removeItem(key),
  };
}

let warn: MockInstance<typeof logger.warn>;

beforeEach(() => {
  warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
});

describe('parseCrashSetting', () => {
  it('is on when nothing was saved', () => {
    expect(parseCrashSetting(null)).toBe(true);
    expect(parseCrashSetting(undefined)).toBe(true);
    expect(parseCrashSetting('')).toBe(true);
  });

  it('is on for garbage: only the exact word for off turns it off', () => {
    for (const raw of ['on', 'garbage', 'OFF', 'Off', ' off', 'false', '0', 'no', '{"on":false}']) {
      expect({ raw, on: parseCrashSetting(raw) }).toEqual({ raw, on: true });
    }
  });

  it('is off for what the switch writes for off, and round-trips both values', () => {
    expect(parseCrashSetting('off')).toBe(false);
    expect(parseCrashSetting(serializeCrashSetting(false))).toBe(false);
    expect(parseCrashSetting(serializeCrashSetting(true))).toBe(true);
  });
});

describe('createCrashSetting', () => {
  it('opens its store only on the first read, and reads it once per launch', () => {
    const memory = memoryStorage();
    const getItem = vi.fn((key: string) => memory.getItem(key));
    const store: KeyValueStorage = { ...memory, getItem };
    const open = vi.fn(() => store);
    const setting = createCrashSetting(open);
    expect(open).not.toHaveBeenCalled();
    expect(setting.crashReportsEnabled()).toBe(true);
    expect(setting.crashReportsEnabled()).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it('saves the choice under its key and reads it back on the next launch', () => {
    const store = memoryStorage();
    createCrashSetting(() => store).setCrashReportsEnabled(false);
    expect(store.getItem(CRASH_SETTING_KEY)).toBe('off');
    expect(createCrashSetting(() => store).crashReportsEnabled()).toBe(false);
    createCrashSetting(() => store).setCrashReportsEnabled(true);
    expect(store.getItem(CRASH_SETTING_KEY)).toBe('on');
    expect(createCrashSetting(() => store).crashReportsEnabled()).toBe(true);
  });

  it('answers the new value at once after a change', () => {
    const setting = createCrashSetting(() => memoryStorage());
    setting.setCrashReportsEnabled(false);
    expect(setting.crashReportsEnabled()).toBe(false);
    setting.setCrashReportsEnabled(true);
    expect(setting.crashReportsEnabled()).toBe(true);
  });

  it('is off for the launch when the store cannot be read or opened', () => {
    expect(createCrashSetting(() => failingStorage('read')).crashReportsEnabled()).toBe(false);
    const cannotOpen = createCrashSetting(() => {
      throw new Error('mmkv unavailable');
    });
    expect(cannotOpen.crashReportsEnabled()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('keeps a choice it could not save for the rest of the launch, without throwing', () => {
    const setting = createCrashSetting(() => failingStorage('write'));
    expect(() => setting.setCrashReportsEnabled(false)).not.toThrow();
    expect(setting.crashReportsEnabled()).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      '[crash-reports] the switch could not be saved',
      expect.any(Error),
    );
  });
});
