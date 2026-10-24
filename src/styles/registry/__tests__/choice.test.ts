import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../../storage/encrypted-storage';
import {
  CHOICE_VERSION,
  parseChoice,
  parsePhoneChoice,
  resolveChoice,
  serialiseChoice,
  serialisePhoneChoice,
} from '../choice';
import {
  STYLE_CHOICE_KEY,
  createStyleChoiceStore,
  readStyleChoice,
  saveStyleChoice,
} from '../choice-store';
import { DEFAULT_CHOICE } from '../registry';
import { FOLLOW_STUDIO, builtinChoice, paintedChoice, themeChoice } from '../style-id';

const INSTALL_ID = '3f2b6c1e-9d4a-4b7e-8c21-5a6f0e9d1b42';
const STUDIO = { kind: 'builtin', id: 'studio' };
const FOLLOW = { kind: 'follow' };

function failingStorage(): KeyValueStorage {
  const fail = () => {
    throw new Error('mmkv unavailable');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

function silenceWarnings() {
  return vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the stored choice (D59)', () => {
  it('round-trips every built-in style and a theme', () => {
    for (const choice of [
      builtinChoice('studio'),
      builtinChoice('play'),
      builtinChoice('hud'),
      themeChoice(INSTALL_ID),
    ]) {
      expect(parseChoice(serialiseChoice(choice))).toEqual(choice);
    }
  });

  it('writes a versioned value with only the choice fields', () => {
    const extra = { kind: 'builtin', id: 'play', colour: 'red' } as never;
    expect(JSON.parse(serialiseChoice(extra))).toEqual({
      v: CHOICE_VERSION,
      kind: 'builtin',
      id: 'play',
    });
    expect(JSON.parse(serialiseChoice(themeChoice(INSTALL_ID)))).toEqual({
      v: 1,
      kind: 'theme',
      installId: INSTALL_ID,
    });
  });

  it('reads garbage as Studio', () => {
    for (const raw of [null, undefined, '', '{', 'null', '[]', '42', 42, {}, 'play', '"hud"']) {
      expect(parseChoice(raw)).toEqual(STUDIO);
    }
  });

  it('reads old, newer and unknown values as Studio', () => {
    for (const value of [
      { kind: 'builtin', id: 'play' },
      { v: 0, kind: 'builtin', id: 'play' },
      { v: 2, kind: 'builtin', id: 'hud' },
      { v: '1', kind: 'builtin', id: 'hud' },
      { v: 1, kind: 'builtin', id: 'classic' },
      { v: 1, kind: 'builtin', id: 'Play' },
      { v: 1, kind: 'layout', id: 'play' },
      { v: 1, kind: 'theme' },
      { v: 1, kind: 'theme', installId: '' },
      { v: 1, kind: 'theme', installId: '../files' },
      { v: 1, kind: 'theme', installId: 'a/b' },
      { v: 1, kind: 'theme', installId: 'x'.repeat(65) },
      { v: 1, kind: 'theme', installId: 7 },
    ]) {
      expect(parseChoice(JSON.stringify(value))).toEqual(STUDIO);
    }
  });

  it('ignores unknown fields', () => {
    const raw = JSON.stringify({ v: 1, kind: 'builtin', id: 'hud', look: 'ARC' });
    expect(parseChoice(raw)).toEqual({ kind: 'builtin', id: 'hud' });
  });

  it('hands back frozen choices', () => {
    expect(Object.isFrozen(parseChoice(serialiseChoice(builtinChoice('play'))))).toBe(true);
    expect(Object.isFrozen(parseChoice(serialiseChoice(themeChoice(INSTALL_ID))))).toBe(true);
  });
});

describe('the theme fallback (D58)', () => {
  it('keeps a built-in style whatever the server offers', () => {
    expect(resolveChoice(builtinChoice('hud'), [])).toEqual(builtinChoice('hud'));
  });

  it('keeps a theme the workspace still offers', () => {
    const choice = themeChoice(INSTALL_ID);
    expect(resolveChoice(choice, ['other', INSTALL_ID])).toBe(choice);
  });

  it('falls back to Studio when the install is no longer offered', () => {
    expect(resolveChoice(themeChoice(INSTALL_ID), [])).toBe(DEFAULT_CHOICE);
    expect(resolveChoice(themeChoice(INSTALL_ID), ['other'])).toBe(DEFAULT_CHOICE);
  });
});

describe('the choice on the phone (MMKV, never the server)', () => {
  it('saves under styles.choice and reads back', () => {
    const storage = memoryStorage();
    expect(STYLE_CHOICE_KEY).toBe('styles.choice');
    // nothing stored: 'Same as Studio' (D-PHONE-CHOICE, the default since 24 Oct)
    expect(readStyleChoice(storage)).toEqual({ kind: 'follow' });
    expect(saveStyleChoice(storage, builtinChoice('play'))).toBe(true);
    expect(JSON.parse(storage.getItem(STYLE_CHOICE_KEY) ?? '')).toEqual({
      v: 1,
      kind: 'builtin',
      id: 'play',
    });
    expect(readStyleChoice(storage)).toEqual(builtinChoice('play'));
  });

  it('reads a value it does not know as Studio', () => {
    const storage = memoryStorage();
    storage.setItem(STYLE_CHOICE_KEY, 'sepia');
    expect(readStyleChoice(storage)).toEqual(STUDIO);
  });

  it('logs a store that fails and carries on: Studio on read, false on save', () => {
    const warn = silenceWarnings();
    expect(readStyleChoice(failingStorage())).toEqual(STUDIO);
    expect(saveStyleChoice(failingStorage(), builtinChoice('hud'))).toBe(false);
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      expect.stringContaining('could not read the style choice'),
      expect.stringContaining('could not save the style choice'),
    ]);
  });
});

describe('the choice store', () => {
  it('opens the storage only when the choice is first needed, and reads it once', () => {
    const backing = memoryStorage();
    backing.setItem(STYLE_CHOICE_KEY, serialiseChoice(builtinChoice('hud')));
    const getItem = vi.fn((key: string) => backing.getItem(key));
    const storage: KeyValueStorage = { ...backing, getItem };
    const open = vi.fn(() => storage);
    const store = createStyleChoiceStore(open);
    expect(open).not.toHaveBeenCalled();
    expect(store.get()).toEqual(builtinChoice('hud'));
    expect(store.get()).toEqual(builtinChoice('hud'));
    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it('saves a new choice and holds it in memory', () => {
    const storage = memoryStorage();
    const store = createStyleChoiceStore(() => storage);
    expect(store.get()).toEqual(FOLLOW);
    expect(store.set(themeChoice(INSTALL_ID))).toBe(true);
    expect(store.get()).toEqual(themeChoice(INSTALL_ID));
    expect(createStyleChoiceStore(() => storage).get()).toEqual(themeChoice(INSTALL_ID));
  });

  it('keeps the in-memory choice when the write fails, and logs it', () => {
    const warn = silenceWarnings();
    const store = createStyleChoiceStore(failingStorage);
    expect(store.set(builtinChoice('play'))).toBe(false);
    expect(store.get()).toEqual(builtinChoice('play'));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('could not save the style choice'),
      expect.any(Error),
    );
  });

  it('is Studio, and logs, when the storage cannot be opened at all', () => {
    const warn = silenceWarnings();
    const store = createStyleChoiceStore(() => {
      throw new Error('keychain locked');
    });
    expect(store.get()).toEqual(STUDIO);
    expect(store.set(builtinChoice('hud'))).toBe(false);
    expect(store.get()).toEqual(builtinChoice('hud'));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('store is unavailable'),
      expect.any(Error),
    );
  });

  it('holds a choice as the next launch will read it: an id it cannot store is Studio', () => {
    const storage = memoryStorage();
    const store = createStyleChoiceStore(() => storage);
    store.set(themeChoice('../../etc'));
    expect(store.get()).toEqual(STUDIO);
    expect(readStyleChoice(storage)).toEqual(STUDIO);
  });
});

describe("'Same as Studio' (D-PHONE-CHOICE)", () => {
  it('is what a phone with nothing stored has: the default', () => {
    expect(parsePhoneChoice(null)).toBe(FOLLOW_STUDIO);
    expect(parsePhoneChoice(undefined)).toBe(FOLLOW_STUDIO);
    expect(createStyleChoiceStore(() => memoryStorage()).get()).toEqual(FOLLOW);
  });

  it('is stored as its own versioned value and read back once picked again', () => {
    const storage = memoryStorage();
    const store = createStyleChoiceStore(() => storage);
    store.set(builtinChoice('hud'));
    expect(createStyleChoiceStore(() => storage).get()).toEqual(builtinChoice('hud'));
    expect(store.set(FOLLOW_STUDIO)).toBe(true);
    expect(JSON.parse(storage.getItem(STYLE_CHOICE_KEY) ?? '')).toEqual({ v: 1, kind: 'follow' });
    expect(createStyleChoiceStore(() => storage).get()).toEqual(FOLLOW);
  });

  it('round-trips every phone choice; other versions and garbage read as Studio', () => {
    for (const choice of [FOLLOW_STUDIO, builtinChoice('play'), themeChoice(INSTALL_ID)]) {
      expect(parsePhoneChoice(serialisePhoneChoice(choice))).toEqual(choice);
    }
    expect(parsePhoneChoice(JSON.stringify({ v: 2, kind: 'follow' }))).toEqual(STUDIO);
    expect(parsePhoneChoice('{')).toEqual(STUDIO);
    expect(parseChoice(serialisePhoneChoice(FOLLOW_STUDIO))).toEqual(STUDIO);
  });

  it('paints what Studio maps to while following, and the phone pick otherwise', () => {
    expect(paintedChoice(FOLLOW_STUDIO, builtinChoice('play'))).toEqual(builtinChoice('play'));
    expect(paintedChoice(FOLLOW_STUDIO, themeChoice(INSTALL_ID))).toEqual(themeChoice(INSTALL_ID));
    expect(paintedChoice(builtinChoice('hud'), builtinChoice('play'))).toEqual(
      builtinChoice('hud'),
    );
  });
});
