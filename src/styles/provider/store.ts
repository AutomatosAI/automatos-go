// The phone's one style store (PRD-001 §4.6, D54, D59): the style choice, Play's look, HUD's looks
// and the cached theme painting, read synchronously from the encrypted MMKV store when the store
// is made, so the first frame paints the chosen style (no flash of Studio at launch). Each part
// lives in its own MMKV store: the choice in US-016a's (styles.choice; nothing stored is 'Same as
// Studio'), HUD's looks in US-018a's (styles.hud.looks), what 'Same as Studio' painted and the
// theme painting in US-016i's (styles.theme.followed, styles.theme.paint, themes/cache.ts); Play's
// look is held in memory here until US-017d gives it a store of its own, which plugs in as a
// StyleSource. The installs the last read offered and the fonts loaded for the painting are this
// launch's only (ThemeSync and themes/fonts.ts fill them). Pure over zustand's vanilla store and
// the KeyValueStorage port, so it runs in vitest; theme.tsx hands it the foundation's appStorage.

import { createStore, type StoreApi } from 'zustand/vanilla';

import { DEFAULT_LOOK } from '../../core/web/lib/looks/presets';
import type { Look } from '../../core/web/lib/looks/types';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import type { HudLooks } from '../hud/hud-looks';
import { createHudLooksStore, type HudLooksStore } from '../hud/look-store';
import { createStyleChoiceStore, type StyleChoiceStore } from '../registry/choice-store';
import { DEFAULT_CHOICE } from '../registry/registry';
import type { PhoneChoice, StyleChoice } from '../registry/style-id';
import { themeFollowedPart, themePaintPart } from '../themes/cache';
import type { OfferedTheme } from '../themes/installed';
import type { LoadedThemeFonts, ThemePaint } from '../themes/types';

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
  /** What 'Same as Studio' painted at the last read; Studio when none is kept. */
  readonly followed?: StyleSource<StyleChoice>;
};

export type StyleState = {
  /** The phone's own choice: a style or theme picked on the phone, or 'Same as Studio'. */
  readonly choice: PhoneChoice;
  /** What 'Same as Studio' paints (themes/follow.ts followStudio over the last read). */
  readonly followed: StyleChoice;
  readonly playLook: Look;
  readonly hudLooks: HudLooks;
  readonly themePaint: ThemePaint | null;
  /** The installs the last read offered (the picker's rows under Studio), this launch only. */
  readonly themes: readonly OfferedTheme[];
  /** The theme fonts loaded for the painting (themes/fonts.ts), this launch only. */
  readonly themeFonts: LoadedThemeFonts | null;
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
  readonly setChoice: (choice: PhoneChoice, options?: FlipOptions) => boolean;
  readonly setPlayLook: (look: Look) => boolean;
  readonly setHudLooks: (looks: HudLooks) => boolean;
  readonly setThemePaint: (paint: ThemePaint | null) => boolean;
  /** What 'Same as Studio' paints now, kept for the next launch's first frame. */
  readonly setFollowed: (followed: StyleChoice, options?: FlipOptions) => boolean;
  readonly setThemes: (themes: readonly OfferedTheme[]) => void;
  readonly setThemeFonts: (fonts: LoadedThemeFonts | null) => void;
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
 * the first read). Play's look starts on Ember until US-017d gives it a store of its own.
 */
export function appStyleSources(storage: () => KeyValueStorage): StyleSources {
  return Object.freeze({
    choice: createStyleChoiceStore(storage),
    hudLooks: createHudLooksStore(storage),
    playLook: memorySource<Look>(DEFAULT_LOOK),
    themePaint: themePaintPart(storage),
    followed: themeFollowedPart(storage),
  });
}

const NO_THEMES: readonly OfferedTheme[] = Object.freeze([]);

/** Every part read now, synchronously: the state the first frame paints. */
export function hydrateStyleState(sources: StyleSources): StyleState {
  return Object.freeze({
    choice: sources.choice.get(),
    followed: sources.followed?.get() ?? DEFAULT_CHOICE,
    playLook: sources.playLook.get(),
    hudLooks: sources.hudLooks.get(),
    themePaint: sources.themePaint.get(),
    themes: NO_THEMES,
    themeFonts: null,
    playEntries: 0,
  });
}

function helloOf(options?: FlipOptions): number {
  return options?.hello === true ? 1 : 0;
}

/**
 * The store: hydrated from the sources when made; each setter saves through its source first and
 * then holds what the source holds (what the next launch will read back), never the caller's
 * object as given. Every state is new; no input is mutated.
 */
export function createStyleStore(sources: StyleSources): StyleStoreApi {
  const followed = sources.followed ?? memorySource<StyleChoice>(DEFAULT_CHOICE);
  return createStore<StyleStore>()((set) => ({
    ...hydrateStyleState(sources),
    setChoice: (choice, options) => {
      const saved = sources.choice.set(choice);
      const hello = helloOf(options);
      set((state) => ({ choice: sources.choice.get(), playEntries: state.playEntries + hello }));
      return saved;
    },
    setFollowed: (choice, options) => {
      const saved = followed.set(choice);
      const hello = helloOf(options);
      set((state) => ({ followed: followed.get(), playEntries: state.playEntries + hello }));
      return saved;
    },
    setThemes: (themes) => set({ themes: Object.freeze([...themes]) }),
    setThemeFonts: (fonts) => set({ themeFonts: fonts }),
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
