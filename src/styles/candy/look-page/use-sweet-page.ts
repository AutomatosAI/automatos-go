// Make it sweet's state in React (US-023m): the phone's Candy looks from the style store, and each
// change candy-looks.ts makes handed back through setCandyLooks — which repaints Candy at once (the
// whole app when it is on Candy, and the page itself through its StyleScope), keeps the looks on
// the phone (US-023c's store) and is sent by the look sync where Candy is installed in the
// workspace (a 404 keeps them on the phone, with words). Every change is at once, a pick too. What
// Save look and Reset did, or why a change was refused or not kept, is said under them; after a
// save the phone kept, Auto celebrates in the preview for a moment (look-editor.tsx useCelebration;
// sweet.ts celebratesSave: never beside 'This phone couldn't keep that change').

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useStyleRoot, useStyleStore } from '../../provider/context';
import {
  deleteLook,
  pickLook,
  renameLook,
  resetLook,
  saveAsNew,
  setKnob,
  setNumber,
  sliderKey,
  type CandyLooks,
  type CandyLooksChange,
} from '../candy-looks';
import type { CandyChoiceKnob, CandyLook } from '../look-schema';
import { motionValue } from './knobs';
import {
  CELEBRATE_MS,
  NOT_KEPT,
  celebratesSave,
  resetSaid,
  savedSaid,
  type SweetSaid,
} from './sweet';

export type SweetPage = {
  readonly looks: CandyLooks;
  /** What the last action did, or why it was not made or not kept; null after a plain change. */
  readonly said: SweetSaid | null;
  /** Auto celebrates in the preview for CELEBRATE_MS after Save look. */
  readonly celebrating: boolean;
  /** The phone's Reduce Motion: the Motion row is off and cannot be changed. */
  readonly reduceMotion: boolean;
  readonly choose: (knob: CandyChoiceKnob, value: string) => void;
  readonly slideRoundness: (value: number) => void;
  readonly slideGlow: (value: number) => void;
  readonly switchMotion: (on: boolean) => void;
  readonly pick: (id: string) => void;
  readonly saveLook: () => void;
  readonly reset: () => void;
  /** The sheet's actions answer the change, so it can say a refusal where it was asked. */
  readonly rename: (id: string, name: string) => CandyLooksChange;
  readonly remove: (id: string) => CandyLooksChange;
};

/**
 * The page's one writer: the store keeps the looks; `after` is what the page says once kept. Each
 * answers whether the phone kept the change (nothing changed, or setCandyLooks kept it).
 */
function useApply() {
  const { store } = useStyleRoot();
  const [said, setSaid] = useState<SweetSaid | null>(null);
  const current = useCallback(() => store.getState().candyLooks, [store]);
  const apply = useCallback(
    (next: CandyLooks, after: SweetSaid | null = null): boolean => {
      if (next === current()) {
        setSaid(after);
        return true;
      }
      const kept = store.getState().setCandyLooks(next);
      setSaid(kept ? after : NOT_KEPT);
      return kept;
    },
    [store, current],
  );
  /** Save look says what it saved under the buttons; the sheet's actions say theirs in the sheet. */
  const applyChange = useCallback(
    (change: CandyLooksChange, after: SweetSaid | null): boolean => {
      if (change.ok) return apply(change.looks, after);
      if (after !== null) setSaid(after);
      return true;
    },
    [apply],
  );
  return { current, apply, applyChange, said };
}

/** On for CELEBRATE_MS from the latest save, off at once on any other change. */
function useCelebration() {
  const [round, setRound] = useState<number | null>(null);
  useEffect(() => {
    if (round === null) return undefined;
    const timer = setTimeout(() => setRound(null), CELEBRATE_MS);
    return () => clearTimeout(timer);
  }, [round]);
  const start = useCallback(() => setRound((was) => (was ?? 0) + 1), []);
  const stop = useCallback(() => setRound(null), []);
  return { on: round !== null, start, stop };
}

export function useSweetPage(): SweetPage {
  const looks = useStyleStore((state) => state.candyLooks);
  const { reduceMotion } = useStyleRoot().input;
  const { current, apply, applyChange, said } = useApply();
  const celebration = useCelebration();
  const { start, stop } = celebration;
  const actions = useMemo(() => {
    const change = (next: (looks: CandyLooks) => CandyLooks) => {
      stop();
      apply(next(current()));
    };
    /** The sheet reads the change itself (LookSheet's contract), so it can say a refusal there. */
    const answer = (made: CandyLooksChange) => {
      applyChange(made, null);
      return made;
    };
    return {
      choose: (knob: CandyChoiceKnob, value: string) => change((was) => setKnob(was, knob, value)),
      slideRoundness: (value: number) =>
        change((was) => setKnob(was, 'roundness', sliderKey(value))),
      slideGlow: (value: number) => change((was) => setNumber(was, 'glow', value)),
      switchMotion: (on: boolean) => change((was) => setKnob(was, 'motion', motionValue(on))),
      pick: (id: string) => change((was) => pickLook(was, id)),
      saveLook: () => {
        const saved = saveAsNew(current());
        const kept = applyChange(saved, savedSaid(saved));
        if (celebratesSave(saved, kept)) start();
      },
      reset: () => {
        stop();
        apply(resetLook(current()), resetSaid(current()));
      },
      rename: (id: string, name: string) => answer(renameLook(current(), id, name)),
      remove: (id: string) => {
        stop();
        return answer(deleteLook(current(), id));
      },
    };
  }, [apply, applyChange, current, start, stop]);
  return { looks, said, celebrating: celebration.on, reduceMotion, ...actions };
}

/** The look a long press opened the sheet for, while it is still one of the saved looks. */
export function useHeldCandyLook(looks: CandyLooks, id: string | null): CandyLook | null {
  return useMemo(
    () => (id === null ? null : (looks.saved.find((look) => look.id === id) ?? null)),
    [looks.saved, id],
  );
}
