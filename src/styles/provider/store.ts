// The phone's one style store (PRD-001 §4.6, D54, D59): the style choice, Play's look, HUD's and
// Arcade's looks and the cached theme painting, read synchronously from the encrypted MMKV store
// when the store is made, so the first frame paints the chosen style (no flash of Studio at
// launch). Each part lives in its own MMKV store: the choice in US-016a's (styles.choice; nothing
// stored is 'Same as Studio'), HUD's looks in US-018a's (styles.hud.looks), Arcade's in US-022c's
// (styles.arcade.looks) with Arcade's pause beside them (US-022e, styles.arcade.motionPaused,
// arcade/motion-pause.ts), what 'Same as Studio' painted and the theme painting in US-016i's
// (styles.theme.followed, styles.theme.paint, themes/cache.ts), Play's looks in US-017d's
// (styles.play.looks, play/look-store.ts) with each theme's look sync marks beside them
// (styles.*.looks.sync, sync/look-marks.ts). The installs the last read offered, the
// fonts loaded for the painting and the look sync's standing with the server are this launch's
// only (ThemeSync, themes/fonts.ts and LookSync fill them). Pure over zustand's vanilla store and
// the KeyValueStorage port, so it runs in vitest; theme.tsx hands it the foundation's appStorage.

import { createStore, type StoreApi } from 'zustand/vanilla';

import type { Look } from '../../core/frozen/lib/looks/types';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import type { ArcadeLooks } from '../arcade/arcade-looks';
import { createArcadeLooksStore, type ArcadeLooksStore } from '../arcade/look-store';
import { createMotionPauseSource } from '../arcade/motion-pause';
import type { HudLooks } from '../hud/hud-looks';
import { createHudLooksStore, type HudLooksStore } from '../hud/look-store';
import { NO_MARKS, statusFromMarks, type LookMarks, type LookSyncStatus } from '../play/look-sync';
import { createPlayLooksStore } from '../play/look-store';
import type { PlayLooks } from '../play/play-looks';
import { createStyleChoiceStore, type StyleChoiceStore } from '../registry/choice-store';
import { DEFAULT_CHOICE } from '../registry/registry';
import type { PhoneChoice, StyleChoice } from '../registry/style-id';
import { themeFollowedPart, themePaintPart } from '../themes/cache';
import type { OfferedTheme } from '../themes/installed';
import type { LoadedThemeFonts, ThemePaint } from '../themes/types';
import { LOOK_THEME_KEYS, lookMarksParts, type LookThemeKey } from '../sync/look-marks';

/** A part of the style kept somewhere: read once, then held; set returns false when not saved. */
export type StyleSource<Value> = {
  readonly get: () => Value;
  readonly set: (value: Value) => boolean;
};

export type StyleSources = {
  readonly choice: StyleChoiceStore;
  readonly hudLooks: HudLooksStore;
  readonly arcadeLooks: ArcadeLooksStore;
  readonly playLooks: StyleSource<PlayLooks>;
  readonly themePaint: StyleSource<ThemePaint | null>;
  /** What 'Same as Studio' painted at the last read; Studio when none is kept. */
  readonly followed?: StyleSource<StyleChoice>;
  /** Each theme's look sync marks; none kept when absent. */
  readonly lookMarks?: Readonly<Record<LookThemeKey, StyleSource<LookMarks>>>;
  /** Arcade's pause (WCAG 2.2.2); this launch only, not paused, when absent. */
  readonly arcadeMotionPaused?: StyleSource<boolean>;
};

/** Each theme's look sync standing (sync/look-sync-run.ts keeps it). */
export type LookSyncStatuses = Readonly<Record<LookThemeKey, LookSyncStatus>>;

export type StyleState = {
  /** The phone's own choice: a style or theme picked on the phone, or 'Same as Studio'. */
  readonly choice: PhoneChoice;
  /** What 'Same as Studio' paints (themes/follow.ts followStudio over the last read). */
  readonly followed: StyleChoice;
  /** Play's active look (playLooks.active), the one Play paints. */
  readonly playLook: Look;
  readonly playLooks: PlayLooks;
  readonly hudLooks: HudLooks;
  readonly arcadeLooks: ArcadeLooks;
  /** Arcade's animation paused by the person: the sprite, cursor and typing hold still. */
  readonly arcadeMotionPaused: boolean;
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
  /** Each theme's looks against the server: the marks (kept) and this launch's standing. */
  readonly lookSync: LookSyncStatuses;
};

export type FlipOptions = {
  /** This flip enters Play: Auto says hello (playEntries + 1). */
  readonly hello?: boolean;
};

export type StyleActions = {
  /** Stores the choice on the phone (MMKV); false when the save failed (it still applies). */
  readonly setChoice: (choice: PhoneChoice, options?: FlipOptions) => boolean;
  /** Play's active look; its saved looks stay. */
  readonly setPlayLook: (look: Look) => boolean;
  readonly setPlayLooks: (looks: PlayLooks) => boolean;
  readonly setHudLooks: (looks: HudLooks) => boolean;
  readonly setArcadeLooks: (looks: ArcadeLooks) => boolean;
  /** Arcade's pause, kept on the phone; false when the save failed (it still applies). */
  readonly setArcadeMotionPaused: (paused: boolean) => boolean;
  /** One theme's look sync standing; its marks are kept on the phone (false: not saved). */
  readonly setLookSync: (key: LookThemeKey, status: LookSyncStatus) => boolean;
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
 * the first read).
 */
export function appStyleSources(storage: () => KeyValueStorage): StyleSources {
  return Object.freeze({
    choice: createStyleChoiceStore(storage),
    hudLooks: createHudLooksStore(storage),
    arcadeLooks: createArcadeLooksStore(storage),
    playLooks: createPlayLooksStore(storage),
    themePaint: themePaintPart(storage),
    followed: themeFollowedPart(storage),
    lookMarks: lookMarksParts(storage),
    arcadeMotionPaused: createMotionPauseSource(storage),
  });
}

const NO_THEMES: readonly OfferedTheme[] = Object.freeze([]);

function marksSources(sources: StyleSources) {
  const kept = sources.lookMarks;
  if (kept) return kept;
  const memory = () => memorySource<LookMarks>(NO_MARKS);
  return Object.freeze({ play: memory(), hud: memory(), arcade: memory() });
}

function lookSyncOf(marks: Readonly<Record<LookThemeKey, StyleSource<LookMarks>>>) {
  const statuses = LOOK_THEME_KEYS.map((key) => [key, statusFromMarks(marks[key].get())]);
  return Object.freeze(Object.fromEntries(statuses) as Record<LookThemeKey, LookSyncStatus>);
}

/** Every part read now, synchronously: the state the first frame paints. */
export function hydrateStyleState(sources: StyleSources): StyleState {
  const playLooks = sources.playLooks.get();
  return Object.freeze({
    choice: sources.choice.get(),
    followed: sources.followed?.get() ?? DEFAULT_CHOICE,
    playLook: playLooks.active,
    playLooks,
    hudLooks: sources.hudLooks.get(),
    arcadeLooks: sources.arcadeLooks.get(),
    arcadeMotionPaused: sources.arcadeMotionPaused?.get() ?? false,
    themePaint: sources.themePaint.get(),
    themes: NO_THEMES,
    themeFonts: null,
    playEntries: 0,
    lookSync: lookSyncOf(marksSources(sources)),
  });
}

function helloOf(options?: FlipOptions): number {
  return options?.hello === true ? 1 : 0;
}

type SetStyle = StoreApi<StyleStore>['setState'];

/** Arcade's looks and its pause, each saved through its source first (the pause: this launch's). */
function arcadeActions(
  sources: StyleSources,
  set: SetStyle,
): Pick<StyleActions, 'setArcadeLooks' | 'setArcadeMotionPaused'> {
  const pause = sources.arcadeMotionPaused ?? memorySource(false);
  return {
    setArcadeLooks: (looks) => {
      const saved = sources.arcadeLooks.set(looks);
      set({ arcadeLooks: sources.arcadeLooks.get() });
      return saved;
    },
    setArcadeMotionPaused: (paused) => {
      const saved = pause.set(paused);
      set({ arcadeMotionPaused: pause.get() });
      return saved;
    },
  };
}

/**
 * The store: hydrated from the sources when made; each setter saves through its source first and
 * then holds what the source holds (what the next launch will read back), never the caller's
 * object as given. Every state is new; no input is mutated.
 */
export function createStyleStore(sources: StyleSources): StyleStoreApi {
  const followed = sources.followed ?? memorySource<StyleChoice>(DEFAULT_CHOICE);
  const marks = marksSources(sources);
  return createStore<StyleStore>()((set, get) => ({
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
    setPlayLook: (look) => get().setPlayLooks({ ...get().playLooks, active: look }),
    setPlayLooks: (looks) => {
      const saved = sources.playLooks.set(looks);
      const held = sources.playLooks.get();
      set({ playLooks: held, playLook: held.active });
      return saved;
    },
    setHudLooks: (looks) => {
      const saved = sources.hudLooks.set(looks);
      set({ hudLooks: sources.hudLooks.get() });
      return saved;
    },
    ...arcadeActions(sources, set),
    setThemePaint: (paint) => {
      const saved = sources.themePaint.set(paint);
      set({ themePaint: sources.themePaint.get() });
      return saved;
    },
    setLookSync: (key, status) => {
      const { owner, serverSeen, lookChanged, savedChanged } = status;
      const saved = marks[key].set({ owner, serverSeen, lookChanged, savedChanged });
      const held = Object.freeze({ ...status, ...marks[key].get() });
      set((state) => ({ lookSync: Object.freeze({ ...state.lookSync, [key]: held }) }));
      return saved;
    },
  }));
}
