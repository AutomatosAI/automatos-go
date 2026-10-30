// Options' state in React (US-022j): the phone's Arcade looks from the style store, and each change
// arcade-looks.ts makes handed back through setArcadeLooks — which repaints Arcade at once (the
// whole app when it is on Arcade, and the page itself through its StyleScope), keeps the looks on
// the phone (US-022c's store) and is sent by the look sync where Arcade is installed in the
// workspace (a 404 keeps them on the phone, with words). Every change is at once, a pick too. What
// SAVE LOOK and RESET did, or why a change was refused or not kept, is said under them; the row
// last changed carries the ▶ cursor.

import { useCallback, useMemo, useState } from 'react';

import { useStyleRoot, useStyleStore } from '../../provider/context';
import {
  deleteLook,
  pickLook,
  renameLook,
  resetLook,
  saveAsNew,
  setKnob,
  type ArcadeLooks,
  type ArcadeLooksChange,
} from '../arcade-looks';
import { ARCADE_KNOBS, type ArcadeKnob, type ArcadeLook } from '../look-schema';
import { NOT_KEPT, resetSaid, savedSaid, type OptionsSaid } from './options';

export type OptionsPage = {
  readonly looks: ArcadeLooks;
  /** What the last action did, or why it was not made or not kept; null after a plain change. */
  readonly said: OptionsSaid | null;
  /** The row last changed (the first until one is): the ▶ cursor's row. */
  readonly cursor: ArcadeKnob;
  readonly change: (knob: ArcadeKnob, value: string) => void;
  readonly pick: (id: string) => void;
  readonly saveLook: () => void;
  readonly reset: () => void;
  /** The sheet's actions answer the change, so it can say a refusal where it was asked. */
  readonly rename: (id: string, name: string) => ArcadeLooksChange;
  readonly remove: (id: string) => ArcadeLooksChange;
};

/** The page's one writer: the store keeps the looks; `after` is what the page says once kept. */
function useApply() {
  const { store } = useStyleRoot();
  const [said, setSaid] = useState<OptionsSaid | null>(null);
  const current = useCallback(() => store.getState().arcadeLooks, [store]);
  const apply = useCallback(
    (next: ArcadeLooks, after: OptionsSaid | null = null) => {
      if (next === current()) return setSaid(after);
      const kept = store.getState().setArcadeLooks(next);
      setSaid(kept ? after : NOT_KEPT);
    },
    [store, current],
  );
  /** SAVE LOOK says what it saved under the buttons; the sheet's actions say theirs in the sheet. */
  const applyChange = useCallback(
    (change: ArcadeLooksChange, after: OptionsSaid | null) => {
      if (change.ok) apply(change.looks, after);
      else if (after !== null) setSaid(after);
      return change;
    },
    [apply],
  );
  return { current, apply, applyChange, said };
}

export function useOptionsPage(): OptionsPage {
  const looks = useStyleStore((state) => state.arcadeLooks);
  const { current, apply, applyChange, said } = useApply();
  const [cursor, setCursor] = useState<ArcadeKnob>(ARCADE_KNOBS[0]);
  const actions = useMemo(
    () => ({
      change: (knob: ArcadeKnob, value: string) => {
        setCursor(knob);
        apply(setKnob(current(), knob, value));
      },
      pick: (id: string) => apply(pickLook(current(), id)),
      saveLook: () => {
        const change = saveAsNew(current());
        void applyChange(change, savedSaid(change));
      },
      reset: () => apply(resetLook(current()), resetSaid(current())),
      rename: (id: string, name: string) => applyChange(renameLook(current(), id, name), null),
      remove: (id: string) => applyChange(deleteLook(current(), id), null),
    }),
    [apply, applyChange, current],
  );
  return { looks, said, cursor, ...actions };
}

/** The look a long press opened the sheet for, while it is still one of the saved looks. */
export function useHeldArcadeLook(looks: ArcadeLooks, id: string | null): ArcadeLook | null {
  return useMemo(
    () => (id === null ? null : (looks.saved.find((look) => look.id === id) ?? null)),
    [looks.saved, id],
  );
}
