// The Deliverables a Play conversation made (Ember 02, US-016k), pure: 'Shelf +N' in the header and
// the report card inside the reply that made it. Only the live turn names them (the turn reducer's
// deliverables, from the document tool's data part; the vendored lib/chat/deliverables.ts: a saved
// reply carries none), so each is filed here with the turn it came in, as A2 files its cards
// (src/chat/cards/model.ts placeCards is the behaviour reference): it stays in the saved reply that
// retires its turn, the first of Auto's at or after the turn's start, and sits after the thread
// when that reply never came. The memory is this conversation's on this visit: another chat starts
// it again, and a draft keeps it when its first message names the chat. Nothing is persisted.

import { shownMessages, type ThreadState } from '../../chat/controller/thread';
import type { DeliverableRef } from '../../core/web/lib/chat/deliverables';

export type FiledReport = {
  /** The saved messages before the turn that made it (the live turn's `since`). */
  readonly since: number;
  readonly ref: DeliverableRef;
};

export type ShelfMemory = {
  readonly chatId: string | null;
  readonly reports: readonly FiledReport[];
};

export const EMPTY_SHELF: ShelfMemory = Object.freeze({ chatId: null, reports: Object.freeze([]) });

/** Where a report the live reply cannot hold, or whose reply never came, is drawn. */
export const LOOSE_REPORTS = 'loose-reports';

type ShelfFacts = Pick<ThreadState, 'chatId' | 'live' | 'messages'>;

/** The memory for the thread's chat: kept when a draft is named, started again for another chat. */
function forChat(memory: ShelfMemory, chatId: string | null): ShelfMemory {
  if (memory.chatId === chatId) return memory;
  if (memory.chatId === null && chatId !== null) return { ...memory, chatId };
  return { chatId, reports: [] };
}

/** Each Deliverable the live turn made, filed once with its turn's start (refiled if it moved). */
export function fileReports(memory: ShelfMemory, state: ShelfFacts): ShelfMemory {
  const current = forChat(memory, state.chatId);
  const { live } = state;
  if (!live || live.turn.deliverables.length === 0) return current;
  const made = new Map(live.turn.deliverables.map((ref) => [ref.id, ref] as const));
  const moved = current.reports.map((report) =>
    made.has(report.ref.id) && report.since !== live.since
      ? { ...report, since: live.since }
      : report,
  );
  const known = new Set(current.reports.map((report) => report.ref.id));
  const added = [...made.values()]
    .filter((ref) => !known.has(ref.id))
    .map((ref) => ({ since: live.since, ref }));
  const changed =
    added.length > 0 || moved.some((report, index) => report !== current.reports[index]);
  return changed ? { ...current, reports: [...moved, ...added] } : current;
}

/** 'Shelf +N': the Deliverables this conversation made on this visit. */
export function shelfCount(memory: ShelfMemory): number {
  return memory.reports.length;
}

/**
 * Each report's row: `liveKey` (the live reply) for the live turn's, else the id of the first
 * saved reply at or after its turn's start, else LOOSE_REPORTS; a row not drawn (`drawn` lacks
 * its key) hands its reports to LOOSE_REPORTS.
 */
export function placeReports(
  memory: ShelfMemory,
  state: ThreadState,
  liveKey: string,
  drawn: ReadonlySet<string>,
): ReadonlyMap<string, readonly DeliverableRef[]> {
  const shown = shownMessages(state);
  const liveSince = state.live?.since ?? null;
  const places = new Map<string, DeliverableRef[]>();
  for (const report of memory.reports) {
    const reply = shown.find(
      (message, index) => index >= report.since && message.role === 'assistant',
    );
    const inLive = liveSince !== null && report.since >= liveSince;
    const key = inLive ? liveKey : (reply?.id ?? LOOSE_REPORTS);
    const place = drawn.has(key) ? key : LOOSE_REPORTS;
    places.set(place, [...(places.get(place) ?? []), report.ref]);
  }
  return places;
}
