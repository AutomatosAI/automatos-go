// HIDE AUTO on HUD's home (15 Nov 2026): the core folded away is the phone's choice, kept in MMKV
// under styles.hud.coreFolded beside HUD's looks and held by the style store, so it survives a
// relaunch; only 'true' is folded; a store that fails shows the core (a read) or keeps the choice for
// this launch (a write); and the button says what a tap does. HudCore draws no core while folded
// (its source, read here), so nothing in it moves.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../../storage/encrypted-storage';
import { appStyleSources, createStyleStore, memorySource } from '../../provider/store';
import { HUD_CORE_COPY } from '../../strings';
import { HUD_CORE_FOLDED_KEY, createHudCoreFoldSource, foldButtonView } from '../core-fold';

function failing(): KeyValueStorage {
  return {
    getItem: () => {
      throw new Error('keychain locked');
    },
    setItem: () => {
      throw new Error('keychain locked');
    },
    removeItem: () => {
      throw new Error('keychain locked');
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HUD's core fold on the phone", () => {
  it("is kept under its own key, beside HUD's looks; only 'true' is folded", () => {
    const storage = memoryStorage();
    const source = createHudCoreFoldSource(() => storage);
    expect(HUD_CORE_FOLDED_KEY).toBe('styles.hud.coreFolded');
    expect(source.get()).toBe(false);
    expect(source.set(true)).toBe(true);
    expect(storage.getItem(HUD_CORE_FOLDED_KEY)).toBe('true');
    storage.setItem(HUD_CORE_FOLDED_KEY, 'yes');
    expect(createHudCoreFoldSource(() => storage).get()).toBe(false);
  });

  it('shows the core when the store cannot be read, and keeps a flip for this launch when it cannot be written', () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const source = createHudCoreFoldSource(failing);
    expect(source.get()).toBe(false);
    expect(source.set(true)).toBe(false);
    expect(source.get()).toBe(true);
  });
});

describe('the style store holds the fold', () => {
  it("reads it at launch and keeps a change for the next launch, apart from the styles' pauses", () => {
    const storage = memoryStorage();
    const store = createStyleStore(appStyleSources(() => storage));
    expect(store.getState().hudCoreFolded).toBe(false);
    expect(store.getState().setHudCoreFolded(true)).toBe(true);
    expect(store.getState().hudCoreFolded).toBe(true);
    expect(store.getState().candyMotionPaused).toBe(false);
    const next = createStyleStore(appStyleSources(() => storage)).getState();
    expect(next.hudCoreFolded).toBe(true);
    next.setHudCoreFolded(false);
    expect(createStyleStore(appStyleSources(() => storage)).getState().hudCoreFolded).toBe(false);
  });

  it('holds it for this launch when the sources keep none, and hydrates from any source', () => {
    const { hudCoreFolded: _kept, ...rest } = appStyleSources(() => memoryStorage());
    const store = createStyleStore(rest);
    store.getState().setHudCoreFolded(true);
    expect(store.getState().hudCoreFolded).toBe(true);
    const sources = { ...appStyleSources(() => memoryStorage()), hudCoreFolded: memorySource(true) };
    expect(createStyleStore(sources).getState().hudCoreFolded).toBe(true);
  });
});

describe('HIDE AUTO', () => {
  it('says what a tap does: hide while the core shows, show while it is folded', () => {
    expect(foldButtonView(false)).toEqual({
      text: HUD_CORE_COPY.hideAuto,
      label: HUD_CORE_COPY.hideAutoLabel,
    });
    expect(foldButtonView(true)).toEqual({
      text: HUD_CORE_COPY.showAuto,
      label: HUD_CORE_COPY.showAutoLabel,
    });
  });

  it("is HUD's home's alone, and HudCore draws no core while it is folded", () => {
    const read = (file: string) => readFileSync(path.resolve(__dirname, file), 'utf8');
    const core = read('../core/HudCore.tsx');
    expect(core).toMatch(/\{props\.fold\?\.folded \? null : \(/);
    expect(core).toMatch(/entering=\{CORE_IN\} exiting=\{CORE_OUT\}/);
    expect(read('../../homes/HudHome.tsx')).toMatch(/fold=\{fold\}/);
  });
});
