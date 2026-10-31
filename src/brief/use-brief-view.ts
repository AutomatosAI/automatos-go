// The brief card's state, wired (the rules are model.ts's): the card's view over the foundation's
// useNeedsYou (one cached answer: the header badge, the strip and the card read the same number, and
// a board_changed live event or the 60 s poll refetches it, so the card's count follows the board),
// which sections are unfolded, and which rows were pressed (a row with done words then says them in
// place, §6.12.3). A pressed row goes where model.ts's briefTarget says, through the thread's link
// opener. A suggestion row's Start (model.ts briefStartOf) goes through src/suggestions' one Start
// (useSuggestionActions: refused at once offline, Face ID first, one Start at a time on every
// surface); the row says its done words only once the server agreed, and a refusal is one line
// under it. Memory only: a card drawn again starts folded.

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNeedsYou } from '../api/needs-you';
import type { WebLinkTarget } from '../navigation/web-links';
import { useSuggestionActions } from '../suggestions/use-suggestions';
import { briefView, doneWordsOf, startedRowKeys, type BriefRowView, type BriefView } from './model';
import type { Brief, BriefSectionName } from './schema';

export type BriefCardState = {
  readonly view: BriefView;
  readonly unfolded: ReadonlySet<BriefSectionName>;
  readonly unfold: (name: BriefSectionName) => void;
  readonly pressed: ReadonlySet<string>;
  readonly press: (row: BriefRowView) => void;
  /** What a pressed row says in place of its action ('Started'); null while it offers one. */
  readonly doneWords: (row: BriefRowView) => string | null;
  /** The role may Start a suggestion row (owners, admins, editors). */
  readonly canStart: boolean;
  /** The row whose Start is asking Face ID or being sent. */
  readonly starting: (row: BriefRowView) => boolean;
  /** Why the row's Start was refused, in one line; null when it was not. */
  readonly refusal: (row: BriefRowView) => string | null;
};

/** The strip's total once it has loaded; null before (the card says the brief's own). */
export function useStripTotal(): number | null {
  const { total, query } = useNeedsYou();
  return query.isSuccess ? total : null;
}

function allRows(view: BriefView): readonly BriefRowView[] {
  return view.sections.flatMap((section) => [...section.shown, ...section.folded]);
}

/** A Start that went through marks its rows pressed: they say their done words from then on. */
function useStartedRows(view: BriefView, startedId: string | null, mark: (keys: string[]) => void) {
  useEffect(() => {
    if (startedId === null) return;
    const keys = startedRowKeys(allRows(view), startedId);
    if (keys.length > 0) mark([...keys]);
  }, [view, startedId, mark]);
}

export function useBriefCard(
  brief: Brief,
  onLink: (target: WebLinkTarget) => void,
): BriefCardState {
  const needsYou = useStripTotal();
  const view = useMemo(() => briefView(brief, { needsYou }), [brief, needsYou]);
  const actions = useSuggestionActions();
  const [unfolded, setUnfolded] = useState<ReadonlySet<BriefSectionName>>(() => new Set());
  const [pressed, setPressed] = useState<ReadonlySet<string>>(() => new Set());
  const unfold = useCallback(
    (name: BriefSectionName) => setUnfolded((current) => new Set([...current, name])),
    [],
  );
  const mark = useCallback(
    (keys: string[]) => setPressed((current) => new Set([...current, ...keys])),
    [],
  );
  useStartedRows(view, actions.started?.id ?? null, mark);
  const { start } = actions;
  const press = useCallback(
    (row: BriefRowView) => {
      if (row.start) {
        start(row.start);
        return;
      }
      if (!row.target) return;
      mark([row.key]);
      onLink(row.target);
    },
    [onLink, start, mark],
  );
  const { busyId, refusal } = actions;
  return {
    view,
    unfolded,
    unfold,
    pressed,
    press,
    doneWords: (row) => doneWordsOf(row, pressed.has(row.key)),
    canStart: actions.allowed,
    starting: (row) => row.start !== null && busyId === row.start.id,
    refusal: (row) => (row.start !== null && refusal?.id === row.start.id ? refusal.text : null),
  };
}
