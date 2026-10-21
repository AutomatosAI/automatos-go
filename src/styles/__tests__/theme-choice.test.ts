import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../storage/encrypted-storage';
import {
  DEFAULT_THEME_CHOICE,
  THEME_CHOICES,
  THEME_CHOICE_STORAGE_KEY,
  appearanceOverride,
  parseThemeChoice,
  readThemeChoice,
  resolveScheme,
  saveThemeChoice,
} from '../theme-choice';

function failingStorage(): KeyValueStorage {
  const fail = () => {
    throw new Error('mmkv unavailable');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the Light / Dark / System choice', () => {
  it('offers System, Light and Dark, and starts on System', () => {
    expect(THEME_CHOICES).toEqual(['system', 'light', 'dark']);
    expect(DEFAULT_THEME_CHOICE).toBe('system');
  });

  it('reads a stored choice, and anything else as System', () => {
    expect(parseThemeChoice('light')).toBe('light');
    expect(parseThemeChoice('dark')).toBe('dark');
    expect(parseThemeChoice('system')).toBe('system');
    for (const raw of [null, undefined, '', 'Dark', 'mist', 42, {}]) {
      expect(parseThemeChoice(raw)).toBe('system');
    }
  });

  it('follows the phone under System and holds a fixed choice against it', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('system', undefined)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('hands the windows back to the phone under System and pins them otherwise', () => {
    expect(appearanceOverride('system')).toBeNull();
    expect(appearanceOverride('light')).toBe('light');
    expect(appearanceOverride('dark')).toBe('dark');
  });
});

describe('the choice on the phone (MMKV, D59)', () => {
  it('saves under its own key and reads back', () => {
    const storage = memoryStorage();
    expect(readThemeChoice(storage)).toBe('system');
    expect(saveThemeChoice(storage, 'dark')).toBe(true);
    expect(storage.getItem(THEME_CHOICE_STORAGE_KEY)).toBe('dark');
    expect(readThemeChoice(storage)).toBe('dark');
  });

  it('reads a value it does not know as System', () => {
    const storage = memoryStorage();
    storage.setItem(THEME_CHOICE_STORAGE_KEY, 'sepia');
    expect(readThemeChoice(storage)).toBe('system');
  });

  it('logs a store that fails and carries on: System on read, false on save', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    expect(readThemeChoice(failingStorage())).toBe('system');
    expect(saveThemeChoice(failingStorage(), 'light')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      expect.stringContaining('could not read the theme choice'),
      expect.stringContaining('could not save the theme choice'),
    ]);
  });
});
