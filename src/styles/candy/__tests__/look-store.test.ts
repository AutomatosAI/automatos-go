// Candy's looks on the phone (D-CAN-3): a round trip under 'styles.candy.looks', every read
// through the vendored validateLook (invalid saved looks dropped, an invalid active look Blush),
// the 100-look cap, garbage and other versions as Blush, and a failing store logged, never thrown.
// Arcade's store tests are the model (arcade/__tests__/look-store.test.ts).

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../../storage/encrypted-storage';
import {
  INITIAL_CANDY_LOOKS,
  MAX_CANDY_SAVED_LOOKS,
  saveAsNew,
  type CandyLooks,
} from '../candy-looks';
import { CANDY_DEFAULT_LOOK, CANDY_PRESET_LOOKS, type CandyLook } from '../look-schema';
import {
  CANDY_LOOKS_KEY,
  CANDY_LOOKS_VERSION,
  createCandyLooksStore,
  parseCandyLooks,
  readCandyLooks,
  saveCandyLooks,
  serialiseCandyLooks,
} from '../look-store';

const BLUSH = CANDY_DEFAULT_LOOK;
const GRADIENTS = ['soft', 'rich', 'vivid'] as const;

function savedLook(n: number, values: Partial<CandyLook> = {}): CandyLook {
  const gradient = GRADIENTS[n % GRADIENTS.length] ?? 'rich';
  return { ...BLUSH, id: `mine-${n}`, name: `My look ${n}`, gradient, ...values };
}

function stored(saved: readonly unknown[], active: unknown): string {
  return JSON.stringify({ v: CANDY_LOOKS_VERSION, saved, active });
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
  it("is kept under 'styles.candy.looks', version 1", () => {
    expect(CANDY_LOOKS_KEY).toBe('styles.candy.looks');
    expect(CANDY_LOOKS_VERSION).toBe(1);
  });

  it('round-trips saved looks and an edited active look', () => {
    const looks: CandyLooks = {
      saved: [savedLook(1), savedLook(2, { roundness: '40', glow: 0 })],
      active: savedLook(2, { palette: 'nightbloom', motion: 'paused' }),
    };
    expect(parseCandyLooks(serialiseCandyLooks(looks))).toEqual(looks);
    expect(JSON.parse(serialiseCandyLooks(looks))).toEqual({ v: 1, ...looks });
  });

  it('reads garbage, other versions and nothing at all as Blush with nothing saved', () => {
    const raws = [null, undefined, '', '{', 'null', '[]', '42', 42, {}, '"blush"'];
    const versions = [
      { saved: [], active: BLUSH },
      { v: 0, saved: [], active: BLUSH },
      { v: 2, saved: [], active: BLUSH },
    ];
    for (const raw of [...raws, ...versions.map((value) => JSON.stringify(value))]) {
      expect(parseCandyLooks(raw)).toEqual(INITIAL_CANDY_LOOKS);
    }
  });
});

describe('the read filter (the vendored validateLook)', () => {
  it('drops invalid saved looks and keeps the rest in order', () => {
    const arcade = { ...savedLook(3), schema: 'arcade-look/v1', interface: 'arcade' };
    const mint = { ...savedLook(2), palette: 'mint' };
    const round = { ...savedLook(4), roundness: '41' };
    const half = { ...savedLook(6), glow: 6.5 };
    const raw = stored([savedLook(1), mint, arcade, round, half, savedLook(5)], BLUSH);
    expect(parseCandyLooks(raw).saved.map((look) => look.id)).toEqual(['mine-1', 'mine-5']);
  });

  it("drops a saved look under a preset's id, and a second look with the same id", () => {
    const twice = [savedLook(2), savedLook(2, { cards: 'single' })];
    const raw = stored([{ ...savedLook(1), id: 'lilac' }, ...twice], BLUSH);
    expect(parseCandyLooks(raw).saved).toEqual([savedLook(2)]);
  });

  it('reads an invalid active look as Blush', () => {
    const bad = [null, 'lilac', { ...BLUSH, glow: 12 }, { ...BLUSH, schema: 'x/v0' }];
    for (const active of bad) {
      expect(parseCandyLooks(stored([savedLook(1)], active))).toEqual({
        saved: [savedLook(1)],
        active: BLUSH,
      });
    }
  });

  it('reads saved looks that are not a list as none', () => {
    const raw = JSON.stringify({ v: 1, saved: 'many', active: savedLook(1) });
    expect(parseCandyLooks(raw)).toEqual({ saved: [], active: savedLook(1) });
  });

  it('keeps at most MAX_CANDY_SAVED_LOOKS (100), the first ones', () => {
    const many = Array.from({ length: 120 }, (_, i) => savedLook(i + 1));
    const { saved } = parseCandyLooks(stored(many, BLUSH));
    expect(saved).toHaveLength(MAX_CANDY_SAVED_LOOKS);
    expect(saved[99]?.id).toBe('mine-100');
  });

  it('keeps every preset valid as an active look', () => {
    for (const preset of CANDY_PRESET_LOOKS) {
      expect(parseCandyLooks(stored([], preset)).active).toEqual(preset);
    }
  });
});

describe('the store', () => {
  it('reads what it saved', () => {
    const storage = memoryStorage();
    const looks = saveAsNew(INITIAL_CANDY_LOOKS);
    if (!looks.ok) throw new Error('saved');
    expect(saveCandyLooks(storage, looks.looks)).toBe(true);
    expect(readCandyLooks(storage)).toEqual(looks.looks);
  });

  it('reads a failing store as Blush and refuses a failing write, logged, never thrown', () => {
    const warn = silenceWarnings();
    expect(readCandyLooks(failingStorage())).toEqual(INITIAL_CANDY_LOOKS);
    expect(saveCandyLooks(failingStorage(), INITIAL_CANDY_LOOKS)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('opens the storage lazily, once read, and holds what the next launch reads back', () => {
    const storage = memoryStorage();
    const open = vi.fn(() => storage);
    const store = createCandyLooksStore(open);
    expect(open).not.toHaveBeenCalled();
    expect(store.get()).toEqual(INITIAL_CANDY_LOOKS);
    const bad = { ...savedLook(1), palette: 'mint' } as unknown as CandyLook;
    expect(store.set({ saved: [savedLook(2), bad], active: bad })).toBe(true);
    expect(store.get()).toEqual({ saved: [savedLook(2)], active: BLUSH });
    expect(createCandyLooksStore(() => storage).get()).toEqual(store.get());
  });

  it('keeps the looks in memory for this launch when the store is unavailable', () => {
    silenceWarnings();
    const store = createCandyLooksStore(() => {
      throw new Error('keychain locked');
    });
    expect(store.get()).toEqual(INITIAL_CANDY_LOOKS);
    const looks: CandyLooks = { saved: [savedLook(1)], active: savedLook(1) };
    expect(store.set(looks)).toBe(false);
    expect(store.get()).toEqual(looks);
  });
});
