// Arcade's looks on the phone (D-ARC-3): a round trip under 'styles.arcade.looks', every read
// through the vendored validateLook (invalid saved looks dropped, an invalid active look
// Overworld), the 100-look cap, garbage and other versions as Overworld, and a failing store
// logged, never thrown. HUD's store tests are the model (hud/__tests__/look-store.test.ts).

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../../storage/encrypted-storage';
import {
  INITIAL_ARCADE_LOOKS,
  MAX_ARCADE_SAVED_LOOKS,
  saveAsNew,
  type ArcadeLooks,
} from '../arcade-looks';
import { ARCADE_DEFAULT_LOOK, ARCADE_PRESET_LOOKS, type ArcadeLook } from '../look-schema';
import {
  ARCADE_LOOKS_KEY,
  ARCADE_LOOKS_VERSION,
  createArcadeLooksStore,
  parseArcadeLooks,
  readArcadeLooks,
  saveArcadeLooks,
  serialiseArcadeLooks,
} from '../look-store';

const OVERWORLD = ARCADE_DEFAULT_LOOK;
const SCANLINES = ['off', 'soft', 'strong'] as const;

function savedLook(n: number, values: Partial<ArcadeLook> = {}): ArcadeLook {
  const scanlines = SCANLINES[n % SCANLINES.length] ?? 'soft';
  return { ...OVERWORLD, id: `mine-${n}`, name: `Save slot ${n}`, scanlines, ...values };
}

function stored(saved: readonly unknown[], active: unknown): string {
  return JSON.stringify({ v: ARCADE_LOOKS_VERSION, saved, active });
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
  it("is kept under 'styles.arcade.looks', version 1", () => {
    expect(ARCADE_LOOKS_KEY).toBe('styles.arcade.looks');
    expect(ARCADE_LOOKS_VERSION).toBe(1);
  });

  it('round-trips saved looks and an edited active look', () => {
    const looks: ArcadeLooks = {
      saved: [savedLook(1), savedLook(2)],
      active: savedLook(2, { palette: 'handheld' }),
    };
    expect(parseArcadeLooks(serialiseArcadeLooks(looks))).toEqual(looks);
    expect(JSON.parse(serialiseArcadeLooks(looks))).toEqual({ v: 1, ...looks });
  });

  it('reads garbage, other versions and nothing at all as Overworld with nothing saved', () => {
    const raws = [null, undefined, '', '{', 'null', '[]', '42', 42, {}, '"overworld"'];
    const versions = [
      { saved: [], active: OVERWORLD },
      { v: 0, saved: [], active: OVERWORLD },
    ];
    for (const raw of [...raws, ...versions.map((value) => JSON.stringify(value))]) {
      expect(parseArcadeLooks(raw)).toEqual(INITIAL_ARCADE_LOOKS);
    }
  });
});

describe('the read filter (the vendored validateLook)', () => {
  it('drops invalid saved looks and keeps the rest in order', () => {
    const hud = { ...savedLook(3), schema: 'automatos-interface-look/v1', interface: 'command' };
    const forest = { ...savedLook(2), palette: 'forest' };
    const raw = stored([savedLook(1), forest, hud, { ...savedLook(4), x: 1 }, savedLook(5)], OVERWORLD);
    expect(parseArcadeLooks(raw).saved.map((look) => look.id)).toEqual(['mine-1', 'mine-5']);
  });

  it("drops a saved look under a preset's id, and a second look with the same id", () => {
    const twice = [savedLook(2), savedLook(2, { textSpeed: 'slow' })];
    const raw = stored([{ ...savedLook(1), id: 'neon' }, ...twice], OVERWORLD);
    expect(parseArcadeLooks(raw).saved).toEqual([savedLook(2)]);
  });

  it('reads an invalid active look as Overworld', () => {
    const bad = [null, 'neon', { ...OVERWORLD, pixelScale: '4' }, { ...OVERWORLD, schema: 'x/v0' }];
    for (const active of bad) {
      expect(parseArcadeLooks(stored([savedLook(1)], active))).toEqual({
        saved: [savedLook(1)],
        active: OVERWORLD,
      });
    }
  });

  it('reads saved looks that are not a list as none', () => {
    const raw = JSON.stringify({ v: 1, saved: 'many', active: savedLook(1) });
    expect(parseArcadeLooks(raw)).toEqual({ saved: [], active: savedLook(1) });
  });

  it('keeps at most MAX_ARCADE_SAVED_LOOKS (100), the first ones', () => {
    const many = Array.from({ length: 120 }, (_, i) => savedLook(i + 1));
    const { saved } = parseArcadeLooks(stored(many, OVERWORLD));
    expect(saved).toHaveLength(MAX_ARCADE_SAVED_LOOKS);
    expect(saved[99]?.id).toBe('mine-100');
  });

  it('keeps every preset valid as an active look', () => {
    for (const preset of ARCADE_PRESET_LOOKS) {
      expect(parseArcadeLooks(stored([], preset)).active).toEqual(preset);
    }
  });
});

describe('the store', () => {
  it('reads what it saved', () => {
    const storage = memoryStorage();
    const looks = saveAsNew(INITIAL_ARCADE_LOOKS);
    if (!looks.ok) throw new Error('saved');
    expect(saveArcadeLooks(storage, looks.looks)).toBe(true);
    expect(readArcadeLooks(storage)).toEqual(looks.looks);
  });

  it('reads a failing store as Overworld and refuses a failing write, logged, never thrown', () => {
    const warn = silenceWarnings();
    expect(readArcadeLooks(failingStorage())).toEqual(INITIAL_ARCADE_LOOKS);
    expect(saveArcadeLooks(failingStorage(), INITIAL_ARCADE_LOOKS)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('opens the storage lazily, once read, and holds what the next launch reads back', () => {
    const storage = memoryStorage();
    const open = vi.fn(() => storage);
    const store = createArcadeLooksStore(open);
    expect(open).not.toHaveBeenCalled();
    expect(store.get()).toEqual(INITIAL_ARCADE_LOOKS);
    const bad = { ...savedLook(1), palette: 'forest' } as unknown as ArcadeLook;
    expect(store.set({ saved: [savedLook(2), bad], active: bad })).toBe(true);
    expect(store.get()).toEqual({ saved: [savedLook(2)], active: OVERWORLD });
    expect(createArcadeLooksStore(() => storage).get()).toEqual(store.get());
  });

  it('keeps the looks in memory for this launch when the store is unavailable', () => {
    silenceWarnings();
    const store = createArcadeLooksStore(() => {
      throw new Error('keychain locked');
    });
    expect(store.get()).toEqual(INITIAL_ARCADE_LOOKS);
    const looks: ArcadeLooks = { saved: [savedLook(1)], active: savedLook(1) };
    expect(store.set(looks)).toBe(false);
    expect(store.get()).toEqual(looks);
  });
});
