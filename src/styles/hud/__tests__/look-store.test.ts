// HUD's looks on the phone (D59): a round trip under 'styles.hud.looks', every read through the
// vendored validateLook (invalid saved looks dropped, an invalid active look ARC), the 100-look
// cap, garbage and other versions as ARC, and a failing store logged, never thrown.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../../storage/encrypted-storage';
import { INITIAL_HUD_LOOKS, MAX_HUD_SAVED_LOOKS, saveAsNew, type HudLooks } from '../hud-looks';
import { HUD_DEFAULT_LOOK, HUD_PRESET_LOOKS, type HudLook } from '../look-schema';
import {
  HUD_LOOKS_KEY,
  HUD_LOOKS_VERSION,
  createHudLooksStore,
  parseHudLooks,
  readHudLooks,
  saveHudLooks,
  serialiseHudLooks,
} from '../look-store';

const ARC = HUD_DEFAULT_LOOK;

function savedLook(n: number, values: Partial<HudLook> = {}): HudLook {
  return { ...ARC, id: `mine-${n}`, name: `MINE ${n}`, grid: n % 31, ...values };
}

function stored(saved: readonly unknown[], active: unknown): string {
  return JSON.stringify({ v: HUD_LOOKS_VERSION, saved, active });
}

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

describe('the stored looks', () => {
  it("is kept under 'styles.hud.looks'", () => {
    expect(HUD_LOOKS_KEY).toBe('styles.hud.looks');
  });

  it('round-trips saved looks and an edited active look', () => {
    const looks: HudLooks = {
      saved: [savedLook(1), savedLook(2)],
      active: savedLook(2, { glow: 3 }),
    };
    expect(parseHudLooks(serialiseHudLooks(looks))).toEqual(looks);
    expect(JSON.parse(serialiseHudLooks(looks))).toEqual({ v: 1, ...looks });
  });

  it('reads garbage, other versions and nothing at all as ARC with nothing saved', () => {
    const raws = [null, undefined, '', '{', 'null', '[]', '42', 42, {}, '"arc"'];
    const versions = [{ saved: [], active: ARC }, { v: 0, saved: [], active: ARC }];
    for (const raw of [...raws, ...versions.map((value) => JSON.stringify(value))]) {
      expect(parseHudLooks(raw)).toEqual(INITIAL_HUD_LOOKS);
    }
  });
});

describe('the read filter (the vendored validateLook)', () => {
  it('drops invalid saved looks and keeps the rest in order', () => {
    const v0 = { id: 'mine-3', name: 'MINE 3', ground: 'void', grid: 3, scan: true };
    const raw = stored(
      [savedLook(1), { ...savedLook(2), glow: 99 }, v0, { ...savedLook(4), x: 1 }, savedLook(5)],
      ARC,
    );
    expect(parseHudLooks(raw).saved.map((look) => look.id)).toEqual(['mine-1', 'mine-5']);
  });

  it("drops a saved look under a preset's id, and a second look with the same id", () => {
    const twice = [savedLook(2), savedLook(2, { glow: 1 })];
    const raw = stored([{ ...savedLook(1), id: 'arc' }, ...twice], ARC);
    expect(parseHudLooks(raw).saved).toEqual([savedLook(2)]);
  });

  it('reads an invalid active look as ARC', () => {
    for (const active of [null, 'arc', { ...ARC, accent: 'teal' }, { ...ARC, schema: 'x/v0' }]) {
      expect(parseHudLooks(stored([savedLook(1)], active))).toEqual({
        saved: [savedLook(1)],
        active: ARC,
      });
    }
  });

  it('reads saved looks that are not a list as none', () => {
    expect(parseHudLooks(JSON.stringify({ v: 1, saved: 'many', active: savedLook(1) }))).toEqual({
      saved: [],
      active: savedLook(1),
    });
  });

  it('keeps at most MAX_HUD_SAVED_LOOKS (100), the first ones', () => {
    expect(MAX_HUD_SAVED_LOOKS).toBe(100);
    const many = Array.from({ length: 120 }, (_, i) => savedLook(i + 1));
    const { saved } = parseHudLooks(stored(many, ARC));
    expect(saved).toHaveLength(100);
    expect(saved[99]?.id).toBe('mine-100');
  });

  it('keeps every preset valid as an active look', () => {
    for (const preset of HUD_PRESET_LOOKS) {
      expect(parseHudLooks(stored([], preset)).active).toEqual(preset);
    }
  });
});

describe('the store', () => {
  it('reads what it saved', () => {
    const storage = memoryStorage();
    const looks = saveAsNew(INITIAL_HUD_LOOKS);
    if (!looks.ok) throw new Error('saved');
    expect(saveHudLooks(storage, looks.looks)).toBe(true);
    expect(readHudLooks(storage)).toEqual(looks.looks);
  });

  it('reads a failing store as ARC and refuses a failing write, logged, never thrown', () => {
    const warn = silenceWarnings();
    expect(readHudLooks(failingStorage())).toEqual(INITIAL_HUD_LOOKS);
    expect(saveHudLooks(failingStorage(), INITIAL_HUD_LOOKS)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('opens the storage lazily, once read, and holds what the next launch reads back', () => {
    const storage = memoryStorage();
    const open = vi.fn(() => storage);
    const store = createHudLooksStore(open);
    expect(open).not.toHaveBeenCalled();
    expect(store.get()).toEqual(INITIAL_HUD_LOOKS);
    const bad = { ...savedLook(1), grid: 31 };
    expect(store.set({ saved: [savedLook(2), bad], active: bad })).toBe(true);
    expect(store.get()).toEqual({ saved: [savedLook(2)], active: ARC });
    expect(createHudLooksStore(() => storage).get()).toEqual(store.get());
  });

  it('keeps the looks in memory for this launch when the store is unavailable', () => {
    silenceWarnings();
    const store = createHudLooksStore(() => {
      throw new Error('keychain locked');
    });
    expect(store.get()).toEqual(INITIAL_HUD_LOOKS);
    const looks: HudLooks = { saved: [savedLook(1)], active: savedLook(1) };
    expect(store.set(looks)).toBe(false);
    expect(store.get()).toEqual(looks);
  });
});
