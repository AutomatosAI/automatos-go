// Arcade's pause control, pure (PRD-001 §4.6.1, D-ARC-5, D-A11Y; WCAG 2.2.2: anything that moves,
// blinks or loops for more than five seconds can be paused). The kit's motion/use-motion.ts and
// pause-toggle.tsx at 034fa629c, on the phone: Arcade moves (the sprite steps, the ▶ / ▼ cursor
// blinks, the dialogue box types) only while the style's loops may run (no Reduce Motion) and the
// person has not paused it; paused, the sprite holds frame 1, the cursor stays on and each line
// shows whole. Under Reduce Motion nothing moves, so there is no control (the kit's rule). The
// choice is the phone's, in the app's encrypted MMKV store under 'styles.arcade.motionPaused'
// beside Arcade's looks, held by the style store (provider/store.ts) so every moving part reads the
// one value. A store that fails is logged: a failed read is not paused, a failed write keeps the
// choice for this launch. Pure over the KeyValueStorage port: no React, React Native, Expo or Skia.

import { logger } from '../../lib/logger';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { ARCADE_PAUSE_COPY } from '../strings';

/** The MMKV key (beside styles.arcade.looks). */
export const ARCADE_MOTION_PAUSED_KEY = 'styles.arcade.motionPaused';

const PAUSED = 'true';
const MOVING = 'false';

/** The stored value back: only 'true' is paused; nothing stored, or anything else, is not. */
export function parseMotionPaused(raw: unknown): boolean {
  return raw === PAUSED;
}

export function serialiseMotionPaused(paused: boolean): string {
  return paused ? PAUSED : MOVING;
}

export type MotionPauseSource = {
  /** The choice in memory, read from the store the first time. */
  readonly get: () => boolean;
  /** Holds the choice and saves it; false when the save failed (logged). */
  readonly set: (paused: boolean) => boolean;
};

/** One style's pause under its own key: read, save and the source over a store. */
export type KeyedMotionPause = {
  readonly key: string;
  readonly read: (storage: KeyValueStorage) => boolean;
  readonly save: (storage: KeyValueStorage, paused: boolean) => boolean;
  readonly source: (storage: () => KeyValueStorage) => MotionPauseSource;
};

/**
 * The pause kept under `key` (Arcade's, and Candy's under 'styles.candy.motionPaused', US-023e):
 * parsed and serialised as above, a failing store logged in `owner`'s name ("Arcade's pause").
 */
export function keyedMotionPause(key: string, owner: string): KeyedMotionPause {
  const read = (storage: KeyValueStorage): boolean => {
    try {
      return parseMotionPaused(storage.getItem(key));
    } catch (error) {
      logger.warn(`[styles] could not read ${owner}; the animation plays`, error);
      return false;
    }
  };
  const save = (storage: KeyValueStorage, paused: boolean): boolean => {
    try {
      storage.setItem(key, serialiseMotionPaused(paused));
      return true;
    } catch (error) {
      logger.warn(`[styles] could not save ${owner}; it applies until the app closes`, error);
      return false;
    }
  };
  const source = (storage: () => KeyValueStorage) => pauseSourceOver(storage, owner, read, save);
  return Object.freeze({ key, read, save, source });
}

/** The choice over one store, opened on the first read or write (as the looks stores are). */
function pauseSourceOver(
  storage: () => KeyValueStorage,
  owner: string,
  read: KeyedMotionPause['read'],
  save: KeyedMotionPause['save'],
): MotionPauseSource {
  let current: boolean | null = null;
  const open = (): KeyValueStorage | null => {
    try {
      return storage();
    } catch (error) {
      logger.warn(`[styles] ${owner} store is unavailable`, error);
      return null;
    }
  };
  return Object.freeze({
    get: () => {
      if (current === null) {
        const opened = open();
        current = opened ? read(opened) : false;
      }
      return current;
    },
    set: (paused: boolean) => {
      current = paused;
      const opened = open();
      return opened ? save(opened, paused) : false;
    },
  });
}

const ARCADE_PAUSE = keyedMotionPause(ARCADE_MOTION_PAUSED_KEY, "Arcade's pause");

export function readMotionPaused(storage: KeyValueStorage): boolean {
  return ARCADE_PAUSE.read(storage);
}

/** true when the choice was saved; false (logged) when the store refused it. */
export function saveMotionPaused(storage: KeyValueStorage, paused: boolean): boolean {
  return ARCADE_PAUSE.save(storage, paused);
}

/** Arcade's choice over one store, opened on the first read or write (as the looks stores are). */
export function createMotionPauseSource(storage: () => KeyValueStorage): MotionPauseSource {
  return ARCADE_PAUSE.source(storage);
}

/** Whether Arcade moves, and why not. */
export type ArcadeMotion = {
  /** The sprite steps, the cursor blinks and the dialogue box types. */
  readonly moving: boolean;
  /** The person paused the animation (kept while Reduce Motion is on, for when it goes off). */
  readonly paused: boolean;
  /** The phone's Reduce Motion (or the style's loops are off): nothing moves, no control. */
  readonly reduced: boolean;
};

/** Arcade's motion from the style's loops (useStyle().motion.loops) and the pause. */
export function arcadeMotion(loops: boolean, paused: boolean): ArcadeMotion {
  return Object.freeze({ moving: loops && !paused, paused, reduced: !loops });
}

/** The control as drawn: its word and what VoiceOver hears (the action a tap takes). */
export type PauseControl = {
  readonly word: string;
  readonly label: string;
  readonly paused: boolean;
};

/** PAUSE while moving, PLAY while paused; none under Reduce Motion, where nothing moves. */
export function pauseControlOf(motion: ArcadeMotion): PauseControl | null {
  if (motion.reduced) return null;
  const { pause, play, pauseLabel, playLabel } = ARCADE_PAUSE_COPY;
  return Object.freeze({
    word: motion.paused ? play : pause,
    label: motion.paused ? playLabel : pauseLabel,
    paused: motion.paused,
  });
}
