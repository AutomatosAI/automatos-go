// The look page's state in React (US-017e): the phone's Play looks from the style store, and each
// change look-page.ts makes handed back through setPlayLooks — which repaints Play at once (the
// US-016e store) and which the look sync sees and sends, one save at a time (US-017d). A knob
// repaints at once; a pick from the looks row crossfades the whole app as a flip does, at once
// under Reduce Motion (D-A11Y). A change the phone could not keep, or one refused, says why.

import { useCallback, useMemo, useState } from 'react';

import type { Look } from '../../../core/frozen/lib/looks/types';
import { useStyleRoot, useStyleStore } from '../../provider/context';
import { PLAY_LOOK_COPY } from '../../strings';
import {
  canReset,
  deleteLook,
  duplicateLook,
  pickCrossfadeMs,
  pickLook,
  refusalCopy,
  renameLook,
  resetLook,
  saveAsNew,
  setValues,
  type LookValues,
  type PlayLooksChange,
} from '../look-page';
import type { PlayLooks } from '../play-looks';

export type LookPage = {
  readonly looks: PlayLooks;
  readonly canReset: boolean;
  /** Why the last change was not made or not kept; null when it was. */
  readonly problem: string | null;
  readonly change: (values: Partial<LookValues>) => void;
  readonly pick: (id: string) => void;
  readonly saveAsNew: () => void;
  readonly reset: () => void;
  /** The sheet's actions answer the change, so it can say a refusal where it was asked. */
  readonly rename: (id: string, name: string) => PlayLooksChange;
  readonly duplicate: (id: string) => PlayLooksChange;
  readonly remove: (id: string) => PlayLooksChange;
};

/** The page's one writer: the store keeps the looks, the problem line says what went wrong. */
function useApply() {
  const { store } = useStyleRoot();
  const [problem, setProblem] = useState<string | null>(null);
  const current = useCallback(() => store.getState().playLooks, [store]);
  const apply = useCallback(
    (next: PlayLooks) => {
      if (next === current()) return;
      const kept = store.getState().setPlayLooks(next);
      setProblem(kept ? null : PLAY_LOOK_COPY.notKept);
    },
    [store, current],
  );
  /** The page's own actions say a refusal under them; the sheet's say it in the sheet. */
  const applyChange = useCallback(
    (change: PlayLooksChange, sayRefusal: boolean) => {
      if (change.ok) apply(change.looks);
      else if (sayRefusal) setProblem(refusalCopy(change.reason));
      return change;
    },
    [apply],
  );
  return { current, apply, applyChange, problem };
}

export function useLookPage(): LookPage {
  const { input, crossfade } = useStyleRoot();
  const looks = useStyleStore((state) => state.playLooks);
  const { current, apply, applyChange, problem } = useApply();
  const fadeMs = pickCrossfadeMs(input.reduceMotion);

  const change = useCallback(
    (values: Partial<LookValues>) => apply(setValues(current(), values)),
    [apply, current],
  );
  const pick = useCallback(
    (id: string) => {
      const next = pickLook(current(), id);
      if (next.active === current().active) return;
      crossfade(() => apply(pickLook(current(), id)), fadeMs);
    },
    [apply, current, crossfade, fadeMs],
  );
  const actions = useMemo(
    () => ({
      saveAsNew: () => void applyChange(saveAsNew(current()), true),
      reset: () => apply(resetLook(current())),
      rename: (id: string, name: string) => applyChange(renameLook(current(), id, name), false),
      duplicate: (id: string) => applyChange(duplicateLook(current(), id), false),
      remove: (id: string) => applyChange(deleteLook(current(), id), false),
    }),
    [apply, applyChange, current],
  );
  return { looks, canReset: canReset(looks), problem, change, pick, ...actions };
}

/** The look a long press opened the sheet for, while it is still one of the saved looks. */
export function useHeldLook(looks: PlayLooks, id: string | null): Look | null {
  return useMemo(
    () => (id === null ? null : (looks.saved.find((look) => look.id === id) ?? null)),
    [looks.saved, id],
  );
}
