// The style store's Candy part (D54, D-CAN-3), as store.test.ts holds Arcade's: Candy's looks
// hydrated from 'styles.candy.looks' so a phone left on Candy paints it on the first frame, in its
// kept look and its palette's tone; the look sync's marks from 'styles.candy.looks.sync'; a new
// phone or a failing store on Blush; setCandyLooks saving through the store and holding what the
// next launch reads back (a look the validator refuses dropped), or holding it for this launch
// when the store fails, logged, never thrown.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../../storage/encrypted-storage';
import { INITIAL_CANDY_LOOKS, type CandyLooks } from '../../candy/candy-looks';
import { CANDY_DEFAULT_LOOK, CANDY_PRESET_LOOKS, type CandyLook } from '../../candy/look-schema';
import { CANDY_LOOKS_KEY, serialiseCandyLooks } from '../../candy/look-store';
import { serialiseChoice } from '../../registry/choice';
import { STYLE_CHOICE_KEY } from '../../registry/choice-store';
import { builtinChoice, paintedChoice } from '../../registry/style-id';
import { LOOK_MARKS_KEYS, serialiseLookMarks } from '../../sync/look-marks';
import { resolveStyle } from '../resolve';
import { appStyleSources, createStyleStore, type StyleState } from '../store';

const NIGHT_BLOOM = CANDY_PRESET_LOOKS[2] as CandyLook;
const MINE: CandyLook = Object.freeze({
  ...NIGHT_BLOOM,
  id: 'mine-1',
  name: 'My look 1',
  sub: 'From Night bloom',
  roundness: '36',
});
const MY_CANDY: CandyLooks = Object.freeze({ saved: Object.freeze([MINE]), active: MINE });

function failingStorage(): KeyValueStorage {
  const fail = () => {
    throw new Error('mmkv unavailable');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

function storeOver(storage: KeyValueStorage) {
  return createStyleStore(appStyleSources(() => storage));
}

function phoneOn(values: Readonly<Record<string, string>>): KeyValueStorage {
  const storage = memoryStorage();
  for (const [key, value] of Object.entries(values)) storage.setItem(key, value);
  return storage;
}

/** What the first frame paints from a store's state. */
function firstFrame(state: StyleState) {
  return resolveStyle({
    choice: paintedChoice(state.choice, state.followed),
    studioScheme: 'light',
    systemScheme: 'light',
    playLook: state.playLook,
    hudLook: state.hudLooks.active,
    arcadeLook: state.arcadeLooks.active,
    candyLook: state.candyLooks.active,
    themePaint: state.themePaint,
    reduceMotion: false,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Candy's looks in the style store", () => {
  it('paints Candy on the first frame of a phone left on Candy, in its kept look', () => {
    const reads: string[] = [];
    const storage = phoneOn({
      [STYLE_CHOICE_KEY]: serialiseChoice(builtinChoice('candy')),
      [CANDY_LOOKS_KEY]: serialiseCandyLooks(MY_CANDY),
    });
    const watched: KeyValueStorage = {
      ...storage,
      getItem: (key: string) => {
        reads.push(key);
        return storage.getItem(key);
      },
    };
    const state = storeOver(watched).getState();
    expect(reads).toEqual(expect.arrayContaining([STYLE_CHOICE_KEY, CANDY_LOOKS_KEY]));
    expect(state.candyLooks).toEqual(MY_CANDY);
    const frame = firstFrame(state);
    expect(frame.layout).toBe('candy');
    expect(frame.candyLook).toEqual(MINE);
    expect(frame.tone).toBe('dark');
  });

  it('starts its look sync from its kept marks', () => {
    const marks = {
      owner: 'api|ws-1|user_1',
      serverSeen: true,
      lookChanged: true,
      savedChanged: false,
    };
    expect(storeOver(memoryStorage()).getState().lookSync.candy).toMatchObject({
      serverSeen: false,
      synced: 'server',
    });
    const kept = storeOver(phoneOn({ [LOOK_MARKS_KEYS.candy]: serialiseLookMarks(marks) }));
    expect(kept.getState().lookSync.candy).toEqual({ ...marks, synced: 'pending', failure: null });
    expect(kept.getState().lookSync.arcade).toMatchObject({ serverSeen: false, synced: 'server' });
  });

  it('starts a new phone, garbage and a failing store on Blush with nothing saved', () => {
    expect(storeOver(memoryStorage()).getState().candyLooks).toEqual(INITIAL_CANDY_LOOKS);
    const garbage = storeOver(phoneOn({ [CANDY_LOOKS_KEY]: '[]' })).getState();
    expect(garbage.candyLooks.active).toEqual(CANDY_DEFAULT_LOOK);
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    expect(storeOver(failingStorage()).getState().candyLooks).toEqual(INITIAL_CANDY_LOOKS);
    expect(warn).toHaveBeenCalled();
  });

  it("stores Candy's looks on the phone and drops one the validator refuses", () => {
    const storage = memoryStorage();
    const store = storeOver(storage);
    const broken = { ...MINE, id: 'mine-2', roundness: '41' };
    expect(store.getState().setCandyLooks({ saved: [MINE, broken], active: MINE })).toBe(true);
    expect(store.getState().candyLooks.saved).toEqual([MINE]);
    expect(storage.getItem(CANDY_LOOKS_KEY)).not.toBeNull();
    expect(storeOver(storage).getState().candyLooks).toEqual(MY_CANDY);
  });

  it("keeps Candy's looks it could not save for this launch, and says so", () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const store = storeOver(failingStorage());
    expect(store.getState().setCandyLooks(MY_CANDY)).toBe(false);
    expect(store.getState().candyLooks).toEqual(MY_CANDY);
  });

  it("changes only Candy's looks, in a new state, telling subscribers once", () => {
    const store = storeOver(memoryStorage());
    const before = store.getState();
    const heard = vi.fn();
    store.subscribe(heard);
    store.getState().setCandyLooks(MY_CANDY);
    const after = store.getState();
    expect(after).not.toBe(before);
    expect(before.candyLooks).toEqual(INITIAL_CANDY_LOOKS);
    expect(after.arcadeLooks).toBe(before.arcadeLooks);
    expect(after.hudLooks).toBe(before.hudLooks);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
