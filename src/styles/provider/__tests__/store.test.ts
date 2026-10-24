// The style store (D54, D59): hydrated synchronously from the phone's storage (the style choice
// under styles.choice, HUD's looks under styles.hud.looks, the theme 'Same as Studio' followed and
// its painting under styles.theme.*) so the first frame paints the chosen style; every setter
// saves through its source and holds what the next launch reads back; a failing store is logged,
// never thrown; a flip into Play counts Auto's hello. A new phone follows Studio (D-PHONE-CHOICE).

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_LOOK, OBSIDIAN } from '../../../core/web/lib/looks/presets';
import { logger } from '../../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../../storage/encrypted-storage';
import { INITIAL_HUD_LOOKS, type HudLooks } from '../../hud/hud-looks';
import { HUD_DEFAULT_LOOK, HUD_PRESET_LOOKS, type HudLook } from '../../hud/look-schema';
import { HUD_LOOKS_KEY, serialiseHudLooks } from '../../hud/look-store';
import { serialiseChoice } from '../../registry/choice';
import { STYLE_CHOICE_KEY } from '../../registry/choice-store';
import { FOLLOW_STUDIO, builtinChoice, paintedChoice, themeChoice } from '../../registry/style-id';
import { THEME_FOLLOWED_KEY, THEME_PAINT_KEY } from '../../themes/cache';
import { playTokens } from '../../tokens/play';
import { resolveStyle, type ThemePaint } from '../resolve';
import {
  appStyleSources,
  createStyleStore,
  hydrateStyleState,
  memorySource,
  type StyleState,
} from '../store';

const MINE: HudLook = Object.freeze({ ...HUD_DEFAULT_LOOK, id: 'mine-1', name: 'MINE 1', grid: 3 });
const MY_LOOKS: HudLooks = Object.freeze({ saved: Object.freeze([MINE]), active: MINE });
const INSTALL_ID = '3f2b6c1e-9d4a-4b7e-8c21-5a6f0e9d1b42';

function failingStorage(): KeyValueStorage {
  const fail = () => {
    throw new Error('mmkv unavailable');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

function silenceWarnings() {
  return vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
}

function storeOver(storage: KeyValueStorage) {
  return createStyleStore(appStyleSources(() => storage));
}

function phoneOn(values: Readonly<Record<string, string>>): KeyValueStorage {
  const storage = memoryStorage();
  for (const [key, value] of Object.entries(values)) storage.setItem(key, value);
  return storage;
}

/** The storage with every key read recorded. */
function recording(storage: KeyValueStorage): { storage: KeyValueStorage; reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    storage: {
      ...storage,
      getItem: (key: string) => {
        reads.push(key);
        return storage.getItem(key);
      },
    },
  };
}

function painting(): ThemePaint {
  const colours = playTokens(OBSIDIAN);
  return {
    installId: INSTALL_ID,
    colours: { light: colours, dark: colours },
    tone: null,
    mascot: false,
  };
}

/** What the first frame paints from a store's state. */
function firstFrame(state: StyleState) {
  return resolveStyle({
    choice: paintedChoice(state.choice, state.followed),
    studioScheme: 'system',
    systemScheme: 'light',
    playLook: state.playLook,
    hudLook: state.hudLooks.active,
    themePaint: state.themePaint,
    reduceMotion: false,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('hydration: the first frame paints the chosen style (D54)', () => {
  it('reads the choice and the HUD looks from the storage while the store is made', () => {
    const storage = phoneOn({
      [STYLE_CHOICE_KEY]: serialiseChoice(builtinChoice('hud')),
      [HUD_LOOKS_KEY]: serialiseHudLooks(MY_LOOKS),
    });
    const { storage: watched, reads } = recording(storage);
    const store = storeOver(watched);
    expect(reads).toEqual(expect.arrayContaining([STYLE_CHOICE_KEY, HUD_LOOKS_KEY]));
    const state = store.getState();
    expect(state.choice).toEqual(builtinChoice('hud'));
    expect(state.hudLooks.active).toEqual(MINE);
    expect(state.hudLooks.saved).toEqual([MINE]);
    expect(firstFrame(state).layout).toBe('hud');
    expect(firstFrame(state).hudLook).toEqual(MINE);
  });

  it('paints Play on the first frame of a phone left on Play', () => {
    const store = storeOver(
      phoneOn({ [STYLE_CHOICE_KEY]: serialiseChoice(builtinChoice('play')) }),
    );
    expect(firstFrame(store.getState()).layout).toBe('play');
  });

  it("starts a new phone on 'Same as Studio' (painting Studio), ARC, Ember and no theme painting", () => {
    const state = storeOver(memoryStorage()).getState();
    expect(state.choice).toEqual(FOLLOW_STUDIO);
    expect(state.followed).toEqual(builtinChoice('studio'));
    expect(firstFrame(state).layout).toBe('studio');
    expect(state.themes).toEqual([]);
    expect(state.themeFonts).toBeNull();
    expect(state.hudLooks).toEqual(INITIAL_HUD_LOOKS);
    expect(state.playLook).toBe(DEFAULT_LOOK);
    expect(state.themePaint).toBeNull();
    expect(state.playEntries).toBe(0);
  });

  it('reads garbage as Studio and ARC', () => {
    const state = storeOver(phoneOn({ [STYLE_CHOICE_KEY]: '{', [HUD_LOOKS_KEY]: '[]' })).getState();
    expect(state.choice).toEqual(builtinChoice('studio'));
    expect(state.hudLooks.active).toEqual(HUD_DEFAULT_LOOK);
  });

  it('starts on Studio and ARC, logged, when the storage fails', () => {
    const warn = silenceWarnings();
    const state = storeOver(failingStorage()).getState();
    expect(state.choice).toEqual(builtinChoice('studio'));
    expect(state.hudLooks.active).toEqual(HUD_DEFAULT_LOOK);
    expect(warn).toHaveBeenCalled();
  });

  it('starts on Studio, logged, when the storage cannot even be opened', () => {
    const warn = silenceWarnings();
    const store = createStyleStore(
      appStyleSources(() => {
        throw new Error('keychain locked');
      }),
    );
    expect(store.getState().choice).toEqual(builtinChoice('studio'));
    expect(warn).toHaveBeenCalled();
  });

  it('hydrates from any sources (the stores US-017d and US-016i plug in)', () => {
    const paint = painting();
    const sources = {
      ...appStyleSources(() => memoryStorage()),
      playLook: memorySource(OBSIDIAN),
      themePaint: memorySource<ThemePaint | null>(paint),
    };
    const state = hydrateStyleState(sources);
    expect(state.playLook).toBe(OBSIDIAN);
    expect(state.themePaint).toBe(paint);
    expect(Object.isFrozen(state)).toBe(true);
  });
});

describe('the setters', () => {
  it('stores the choice on the phone: the next launch reads it back', () => {
    const storage = memoryStorage();
    const store = storeOver(storage);
    expect(store.getState().setChoice(builtinChoice('play'))).toBe(true);
    expect(store.getState().choice).toEqual(builtinChoice('play'));
    expect(storeOver(storage).getState().choice).toEqual(builtinChoice('play'));
  });

  it('holds what the next launch will read, not what it was handed', () => {
    const store = storeOver(memoryStorage());
    store.getState().setChoice(themeChoice('not a valid id/'));
    expect(store.getState().choice).toEqual(builtinChoice('studio'));
  });

  it('counts a hello only for a flip that asks for one', () => {
    const store = storeOver(memoryStorage());
    store.getState().setChoice(builtinChoice('hud'));
    expect(store.getState().playEntries).toBe(0);
    store.getState().setChoice(builtinChoice('play'), { hello: true });
    expect(store.getState().playEntries).toBe(1);
    store.getState().setChoice(builtinChoice('studio'), { hello: false });
    store.getState().setChoice(builtinChoice('play'), { hello: true });
    expect(store.getState().playEntries).toBe(2);
  });

  it('keeps a choice it could not save for this launch, and says so', () => {
    silenceWarnings();
    const store = storeOver(failingStorage());
    expect(store.getState().setChoice(builtinChoice('hud'))).toBe(false);
    expect(store.getState().choice).toEqual(builtinChoice('hud'));
  });

  it("stores HUD's looks on the phone and drops one the validator refuses", () => {
    const storage = memoryStorage();
    const store = storeOver(storage);
    const broken = { ...MINE, id: 'mine-2', grid: 99 } as HudLook;
    store.getState().setHudLooks({ saved: [MINE, broken], active: MINE });
    expect(store.getState().hudLooks.saved).toEqual([MINE]);
    expect(storeOver(storage).getState().hudLooks.active).toEqual(MINE);
  });

  it("holds Play's look for this launch until its store exists", () => {
    const storage = memoryStorage();
    const store = storeOver(storage);
    expect(store.getState().setPlayLook(OBSIDIAN)).toBe(true);
    expect(store.getState().playLook).toBe(OBSIDIAN);
    expect(storeOver(storage).getState().playLook).toBe(DEFAULT_LOOK);
  });

  it('keeps the theme painting on the phone for the next launch (US-016i)', () => {
    const storage = memoryStorage();
    const store = storeOver(storage);
    const paint = painting();
    expect(store.getState().setThemePaint(paint)).toBe(true);
    expect(store.getState().themePaint).toEqual(paint);
    expect(storage.getItem(THEME_PAINT_KEY)).not.toBeNull();
    expect(storeOver(storage).getState().themePaint).toEqual(paint);
    store.getState().setThemePaint(null);
    expect(store.getState().themePaint).toBeNull();
    expect(storeOver(storage).getState().themePaint).toBeNull();
  });

  it("keeps what 'Same as Studio' painted, so the next launch opens on it", () => {
    const storage = memoryStorage();
    const store = storeOver(storage);
    expect(store.getState().setFollowed(builtinChoice('play'), { hello: true })).toBe(true);
    expect(store.getState().playEntries).toBe(1);
    expect(storage.getItem(THEME_FOLLOWED_KEY)).not.toBeNull();
    const next = storeOver(storage).getState();
    expect(next.followed).toEqual(builtinChoice('play'));
    expect(firstFrame(next).layout).toBe('play');
  });

  it('a style picked on the phone overrides the follow; Same as Studio picked again returns', () => {
    const storage = memoryStorage();
    const store = storeOver(storage);
    store.getState().setFollowed(builtinChoice('hud'));
    store.getState().setChoice(builtinChoice('play'));
    expect(firstFrame(storeOver(storage).getState()).layout).toBe('play');
    store.getState().setChoice(FOLLOW_STUDIO);
    expect(storeOver(storage).getState().choice).toEqual(FOLLOW_STUDIO);
    expect(firstFrame(storeOver(storage).getState()).layout).toBe('hud');
  });

  it('holds the offered themes and the loaded fonts for this launch only', () => {
    const storage = memoryStorage();
    const store = storeOver(storage);
    const fonts = { installId: INSTALL_ID, families: { sans: `theme-${INSTALL_ID}-sans` } };
    store.getState().setThemeFonts(fonts);
    expect(store.getState().themeFonts).toBe(fonts);
    expect(storeOver(storage).getState().themeFonts).toBeNull();
  });

  it('makes a new state on every change and leaves the old one as it was', () => {
    const store = storeOver(memoryStorage());
    const before = store.getState();
    const snapshot = JSON.stringify(before);
    store.getState().setChoice(builtinChoice('play'), { hello: true });
    store.getState().setHudLooks({ saved: [], active: HUD_PRESET_LOOKS[1] });
    expect(store.getState()).not.toBe(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('tells subscribers about each change', () => {
    const store = storeOver(memoryStorage());
    const heard = vi.fn();
    const unsubscribe = store.subscribe(heard);
    store.getState().setChoice(builtinChoice('hud'));
    expect(heard).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
