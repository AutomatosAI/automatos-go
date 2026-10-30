// HUD's approval (PRD-268 §6.12.5, US-G08), pure: HUD draws no thread cards, so the sheet is its only
// way to answer. The card it opens on is the newest one waiting with an ApprovalView@1 (a tool
// approval or a Mission plan, live or saved); none, and HUD is as today.

import type { PlanRow, ToolApprovalRow } from '../chat/cards/view';
import type { ChatRow } from '../chat/view-model';

export type SheetCard = ToolApprovalRow | PlanRow;

function waits(card: SheetCard): boolean {
  if (card.view === null) return false;
  return card.kind === 'tool' ? !card.decided : card.decided === null;
}

/** The newest card waiting with a view, from the thread's rows; null when none waits. */
export function waitingSheetCard(rows: readonly ChatRow[]): SheetCard | null {
  const cards = rows.flatMap((row) =>
    row.type === 'auto' || row.type === 'cards' ? row.cards : [],
  );
  const waiting = cards.filter(
    (card): card is SheetCard => (card.kind === 'tool' || card.kind === 'plan') && waits(card),
  );
  return waiting[waiting.length - 1] ?? null;
}
