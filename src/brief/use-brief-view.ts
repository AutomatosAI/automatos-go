// The brief card's state, wired (the rules are model.ts's): the card's view over the foundation's
// useNeedsYou (one cached answer: the header badge, the strip and the card read the same number, and
// a board_changed live event or the 60 s poll refetches it, so the card's count follows the board),
// which sections are unfolded, and which rows were pressed (a row with done words then says them in
// place, §6.12.3). A pressed row goes where model.ts's briefTarget says, through the thread's link
// opener. Memory only: a card drawn again starts folded.

import { useCallback, useMemo, useState } from 'react';

import { useNeedsYou } from '../api/needs-you';
import type { WebLinkTarget } from '../navigation/web-links';
import { briefView, type BriefRowView, type BriefView } from './model';
import type { Brief, BriefSectionName } from './schema';

export type BriefCardState = {
  readonly view: BriefView;
  readonly unfolded: ReadonlySet<BriefSectionName>;
  readonly unfold: (name: BriefSectionName) => void;
  readonly pressed: ReadonlySet<string>;
  readonly press: (row: BriefRowView) => void;
};

/** The strip's total once it has loaded; null before (the card says the brief's own). */
export function useStripTotal(): number | null {
  const { total, query } = useNeedsYou();
  return query.isSuccess ? total : null;
}

export function useBriefCard(
  brief: Brief,
  onLink: (target: WebLinkTarget) => void,
): BriefCardState {
  const needsYou = useStripTotal();
  const view = useMemo(() => briefView(brief, { needsYou }), [brief, needsYou]);
  const [unfolded, setUnfolded] = useState<ReadonlySet<BriefSectionName>>(() => new Set());
  const [pressed, setPressed] = useState<ReadonlySet<string>>(() => new Set());
  const unfold = useCallback(
    (name: BriefSectionName) => setUnfolded((current) => new Set([...current, name])),
    [],
  );
  const press = useCallback(
    (row: BriefRowView) => {
      if (!row.target) return;
      setPressed((current) => new Set([...current, row.key]));
      onLink(row.target);
    },
    [onLink],
  );
  return { view, unfolded, unfold, pressed, press };
}
