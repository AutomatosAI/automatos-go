// The Looks drawer's state in React (US-018c): the phone's HUD looks from the style store, and each
// change drawer-model.ts and hud-looks.ts make handed back through setHudLooks — which repaints
// HUD at once behind the drawer and stores the looks on the phone (US-018a's store), and which the
// look sync sees and sends where HUD is installed in the workspace (US-017d; a 404 keeps them on
// the phone). Every change is at once, a pick too (the drawing re-themes live). A change the
// phone could not keep, or one refused, says why.

import { useCallback, useMemo, useState } from 'react';

import { useStyleRoot, useStyleStore } from '../../provider/context';
import type { ResolvedStyle } from '../../provider/resolve';
import { HUD_DRAWER_COPY, PLAY_LOOK_COPY } from '../../strings';
import { useStyle } from '../../theme';
import type { HudVars } from '../../tokens/hud';
import { refusalCopy } from '../../play/look-page';
import type { LookSheetCopy } from '../../play/look-page/LookSheet';
import {
  flipSwitch,
  hudDrawer,
  pickOption,
  slide,
  type DrawerPick,
  type DrawerSlider,
  type HudDrawer,
  type HudSwitchKnob,
} from '../drawer-model';
import {
  deleteLook,
  pickLook,
  renameLook,
  resetLook,
  saveAsNew,
  type HudLooks,
  type HudLooksChange,
} from '../hud-looks';
import { HUD_DEFAULT_LOOK, type HudLook } from '../look-schema';

/** HUD's paint for the drawer: the README's variables and the resolved style; null outside HUD. */
export type DrawerPaint = { readonly vars: HudVars; readonly style: ResolvedStyle };

export function useDrawerPaint(): DrawerPaint | null {
  const style = useStyle();
  return useMemo(() => (style.hud ? { vars: style.hud, style } : null), [style]);
}

/** The sheet a long press opens, in HUD's words: Rename and Delete, back to ARC. */
export const HUD_SHEET_COPY: LookSheetCopy = Object.freeze({
  sheet: PLAY_LOOK_COPY.sheet,
  renamed: PLAY_LOOK_COPY.renamed,
  duplicated: PLAY_LOOK_COPY.duplicated,
  deleted: HUD_DRAWER_COPY.deleted,
  refusal: refusalCopy,
  backTo: HUD_DEFAULT_LOOK.name,
});

export type LooksDrawerState = {
  readonly looks: HudLooks;
  readonly drawer: HudDrawer;
  /** Why the last change was not made or not kept; null when it was. */
  readonly problem: string | null;
  readonly pick: (id: string) => void;
  readonly choose: (pick: DrawerPick) => void;
  readonly slide: (knob: DrawerSlider['knob'], value: number) => void;
  readonly flip: (knob: HudSwitchKnob) => void;
  readonly saveAsNew: () => void;
  readonly reset: () => void;
  /** The sheet's actions answer the change, so it can say a refusal where it was asked. */
  readonly rename: (id: string, name: string) => HudLooksChange;
  readonly remove: (id: string) => HudLooksChange;
};

/** The drawer's one writer: the store keeps the looks, the problem line says what went wrong. */
function useApply() {
  const { store } = useStyleRoot();
  const [problem, setProblem] = useState<string | null>(null);
  const current = useCallback(() => store.getState().hudLooks, [store]);
  const apply = useCallback(
    (next: HudLooks) => {
      if (next === current()) return;
      const kept = store.getState().setHudLooks(next);
      setProblem(kept ? null : PLAY_LOOK_COPY.notKept);
    },
    [store, current],
  );
  /** The drawer's own actions say a refusal under them; the sheet's say it in the sheet. */
  const applyChange = useCallback(
    (change: HudLooksChange, sayRefusal: boolean) => {
      if (change.ok) apply(change.looks);
      else if (sayRefusal) setProblem(refusalCopy(change.reason));
      return change;
    },
    [apply],
  );
  return { current, apply, applyChange, problem };
}

export function useLooksDrawer(): LooksDrawerState {
  const { input } = useStyleRoot();
  const { reduceMotion } = input;
  const looks = useStyleStore((state) => state.hudLooks);
  const { current, apply, applyChange, problem } = useApply();
  const drawer = useMemo(() => hudDrawer(looks, reduceMotion), [looks, reduceMotion]);
  const actions = useMemo(
    () => ({
      pick: (id: string) => apply(pickLook(current(), id)),
      choose: (choice: DrawerPick) => apply(pickOption(current(), choice)),
      slide: (knob: DrawerSlider['knob'], value: number) => apply(slide(current(), knob, value)),
      flip: (knob: HudSwitchKnob) => apply(flipSwitch(current(), knob, reduceMotion)),
      saveAsNew: () => void applyChange(saveAsNew(current()), true),
      reset: () => apply(resetLook(current())),
      rename: (id: string, name: string) => applyChange(renameLook(current(), id, name), false),
      remove: (id: string) => applyChange(deleteLook(current(), id), false),
    }),
    [apply, applyChange, current, reduceMotion],
  );
  return { looks, drawer, problem, ...actions };
}

/** The look a long press opened the sheet for, while it is still one of the saved looks. */
export function useHeldHudLook(looks: HudLooks, id: string | null): HudLook | null {
  return useMemo(
    () => (id === null ? null : (looks.saved.find((look) => look.id === id) ?? null)),
    [looks.saved, id],
  );
}
