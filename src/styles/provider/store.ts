// The phone's one style store (PRD-001 §4.6, D54, D59): the style choice, Play's look, HUD's looks
// and the cached theme painting, read synchronously from the encrypted MMKV store when the store
// is made, so the first frame paints the chosen style (no flash of Studio at launch). Each part
// lives in its own MMKV store: the choice in US-016a's (styles.choice), HUD's looks in US-018a's
// (styles.hud.looks); Play's look and the theme painting are held in memory here until their
// stores are built (US-017d: Play's looks in step with the web; US-016i: the theme painting), which
// plug in as StyleSources. Pure over zustand's vanilla store and the KeyValueStorage port, so it
// runs in vitest; theme.tsx hands it the foundation's appStorage (src/storage/mmkv.ts).

import { createStore, type StoreApi } from 'zustand/vanilla';

import { DEFAULT_LOOK } from '../../core/web/lib/looks/presets';
import type { Look } from '../../core/web/lib/looks/types';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import type { HudLooks } from '../hud/hud-looks';
import { createHudLooksStore, type HudLooksStore } from '../hud/look-store';
import { createStyleChoiceStore, type StyleChoiceStore } from '../registry/choice-store';
import type { StyleChoice } from '../registry/style-id';
import type { ThemePaint } from './resolve';

/** A part of the style kept somewhere: read once, then held; set returns false when not saved. */
export type StyleSource<Value> = {
  readonly get: () => Value;
  readonly set: (value: Value) => boolean;
};

export type StyleSources = {
  readonly choice: StyleChoiceStore;
  readonly hudLooks: HudLooksStore;
  readonly playLook: StyleSource<Look>;
  readonly themePaint: StyleSource<ThemePaint | null>;
};

export type StyleState = {
  readonly choice: StyleChoice;
  readonly playLook: Look;
  readonly hudLooks: HudLooks;
  readonly themePaint: ThemePaint | null;
  /**
   * One more each time a flip enters Play (flip.ts): Auto's mascot (US-017b) sends the vendored
   * reducer one 'app-open', his hello, for each new value — never on mount.
   */
  readonly playEntries: number;
};

export type FlipOptions = {
  /** This flip enters Play: Auto says hello (playEntries + 1). */
  readonly hello?: boolean;
};

export type StyleActions = {
  /** Stores the choice on the phone (MMKV); false when the save failed (it still applies). */
  readonly setChoice: (choice: StyleChoice, options?: FlipOptions) => boolean;
  readonly setPlayLook: (look: Look) => boolean;
  readonly setHudLooks: (looks: HudLooks) => boolean;
  readonly setThemePaint: (paint: ThemePaint | null) => boolean;
};

export type StyleStore = StyleState & StyleActions;
export type StyleStoreApi = StoreApi<StyleStore>;

/** A part held for this launch only (nothing is written anywhere). */
export function memorySource<Value>(initial: Value): StyleSource<Value> {
  let current = initial;
  return Object.freeze({
    get: () => current,
    set: (value: Value) => {
      current = value;
      return true;
    },
  });
}

/**
 * The phone's sources over one KeyValueStorage, opened lazily (nothing touches the keychain until
 * the first read). Play's look starts on Ember and the theme painting on none until US-017d and
 * US-016i give them stores of their own.
 */
export function appStyleSources(storage: () => KeyValueStorage): StyleSources {
  return Object.freeze({
    choice: createStyleChoiceStore(storage),
    hudLooks: createHudLooksStore(storage),
    playLook: memorySource<Look>(DEFAULT_LOOK),
    themePaint: memorySource<ThemePaint | null>(null),
  });
}

/** Every part read now, synchronously: the state the first frame paints. */
export function hydrateStyleState(sources: StyleSources): StyleState {
  return Object.freeze({
    choice: sources.choice.get(),
    playLook: sources.playLook.get(),
    hudLooks: sources.hudLooks.get(),
    themePaint: sources.themePaint.get(),
    playEntries: 0,
  });
}

/**
 * The store: hydrated from the sources when made; each setter saves through its source first and
 * then holds what the source holds (what the next launch will read back), never the caller's
 * object as given. Every state is new; no input is mutated.
 */
export function createStyleStore(sources: StyleSources): StyleStoreApi {
  return createStore<StyleStore>()((set) => ({
    ...hydrateStyleState(sources),
    setChoice: (choice, options) => {
      const saved = sources.choice.set(choice);
      const hello = options?.hello === true ? 1 : 0;
      set((state) => ({ choice: sources.choice.get(), playEntries: state.playEntries + hello }));
      return saved;
    },
    setPlayLook: (look) => {
      const saved = sources.playLook.set(look);
      set({ playLook: sources.playLook.get() });
      return saved;
    },
    setHudLooks: (looks) => {
      const saved = sources.hudLooks.set(looks);
      set({ hudLooks: sources.hudLooks.get() });
      return saved;
    },
    setThemePaint: (paint) => {
      const saved = sources.themePaint.set(paint);
      set({ themePaint: sources.themePaint.get() });
      return saved;
    },
  }));
}
