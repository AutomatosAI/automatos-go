// Play's looks on the phone (US-017d): a round trip under 'styles.play.looks', every read through
// the vendored validateLook (invalid saved looks dropped, an invalid active look Ember), the
// 100-look cap, garbage and other versions as Ember, and a failing store logged, never thrown.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_LOOK, OBSIDIAN } from '../../../core/web/lib/looks/presets';
import type { Look } from '../../../core/web/lib/looks/types';
import { logger } from '../../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../../storage/encrypted-storage';
import {
  PLAY_LOOKS_KEY,
  PLAY_LOOKS_VERSION,
  createPlayLooksStore,
  parsePlayLooks,
  serialisePlayLooks,
} from '../look-store';
import { MAX_SAVED_LOOKS } from '../looks-schemas';
import { INITIAL_PLAY_LOOKS, freshPlayLookId, type PlayLooks } from '../play-looks';

function mine(n: number, values: Partial<Look> = {}): Look {
  return { ...OBSIDIAN, id: `look-${n}`, name: `My look ${n}`, sub: 'Your look', ...values };
}

function stored(saved: readonly unknown[], active: unknown): string {
  return JSON.stringify({ v: PLAY_LOOKS_VERSION, saved, active });
}

function failingStorage(): KeyValueStorage {
  const fail = () => {
    throw new Error('mmkv unavailable');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Play's looks on the phone", () => {
  it("is kept under 'styles.play.looks' and round-trips", () => {
    expect(PLAY_LOOKS_KEY).toBe('styles.play.looks');
    const looks: PlayLooks = { saved: [mine(1), mine(2)], active: mine(2, { glow: 3 }) };
    expect(parsePlayLooks(serialisePlayLooks(looks))).toEqual(looks);
  });

  it('reads garbage, other versions and nothing at all as Ember with nothing saved', () => {
    const raws = [null, undefined, '', '{', 'null', '[]', '42', 42, {}];
    const versions = [{ saved: [], active: OBSIDIAN }, { v: 0, saved: [], active: OBSIDIAN }];
    for (const raw of [...raws, ...versions.map((value) => JSON.stringify(value))]) {
      expect(parsePlayLooks(raw)).toEqual(INITIAL_PLAY_LOOKS);
    }
  });

  it('drops invalid saved looks, preset ids and repeated ids; an invalid active look is Ember', () => {
    const raw = stored([mine(1), { ...mine(2), glow: 99 }, OBSIDIAN, mine(1, { glow: 2 }), mine(3)], {
      ...mine(4),
      font: 'comic',
    });
    const looks = parsePlayLooks(raw);
    expect(looks.saved.map((look) => look.id)).toEqual(['look-1', 'look-3']);
    expect(looks.active).toBe(DEFAULT_LOOK);
  });

  it('keeps at most MAX_SAVED_LOOKS', () => {
    const many = Array.from({ length: MAX_SAVED_LOOKS + 5 }, (_, n) => mine(n + 1));
    expect(parsePlayLooks(stored(many, OBSIDIAN)).saved).toHaveLength(MAX_SAVED_LOOKS);
  });

  it('is read and written through the store, held as the next launch reads it back', () => {
    const storage = memoryStorage();
    const store = createPlayLooksStore(() => storage);
    expect(store.get()).toEqual(INITIAL_PLAY_LOOKS);
    expect(store.set({ saved: [mine(1), { ...mine(2), glow: 99 }], active: mine(1) })).toBe(true);
    expect(store.get().saved).toEqual([mine(1)]);
    expect(createPlayLooksStore(() => storage).get().active).toEqual(mine(1));
  });

  it('logs a failing store, and keeps the looks for this launch', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const store = createPlayLooksStore(failingStorage);
    expect(store.get()).toEqual(INITIAL_PLAY_LOOKS);
    expect(store.set({ saved: [], active: OBSIDIAN })).toBe(false);
    expect(store.get().active).toEqual(OBSIDIAN);
    expect(warn).toHaveBeenCalled();
  });
});

describe("the editor's fresh-id rule", () => {
  it("is 'look-N' with the lowest N no saved look uses", () => {
    expect(freshPlayLookId([])).toBe('look-1');
    expect(freshPlayLookId([mine(1), mine(3)])).toBe('look-2');
  });
});
