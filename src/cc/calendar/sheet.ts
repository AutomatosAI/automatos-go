// The item sheet's view, pure (handoff §2 'Calendar' tap → sheet, D-PAUSE, D-ROLES): the kind with
// its words, the title, when it runs, and what can be done. A routine and an agent-scheduled task
// pause and resume here for a role that may pause (pause.ts pauseOffer), with the line saying what
// that does; a viewer is told who does. Every other kind is managed in Studio, in the system browser
// (web-links.ts studioUrl, D-NO-WEBVIEW): a build with no Studio address says so instead of a dead
// button. An item that belongs to a ticket (a deadline) opens it on the Board, by its number when
// the Board knows it. Nothing here cancels (D63) or pauses a playbook or a social post (D27).

import type { WorkspaceRole } from '../../api/workspace';
import { routes } from '../../navigation/routes';
import { studioUrl } from '../../navigation/web-links';
import { ticketNumberOf } from '../board/board';
import type { BoardTicket } from '../board/schemas';
import { CALENDAR_COPY } from '../strings';
import type { BandItem, CalendarRow, DayModel, KindWord } from './day-model';
import { pauseOffer, type SentPause } from './pause';
import type { ScheduleEntry } from './schemas';
import { bandLineView, dayLabel, rowView, type ItemFlag, type StripCellView } from './view-model';

const SEPARATOR = ` ${CALENDAR_COPY.separator} `;

/** The day a row is on, in the words of its strip cell. */
export type SheetDay = Pick<StripCellView, 'weekday' | 'day' | 'month'>;

/** Where the sheet was opened from: a row of a day, or a line of the always-on band. */
export type SheetOrigin =
  { readonly row: CalendarRow; readonly day: SheetDay } | { readonly band: BandItem };

export type ItemSheetInput = {
  readonly item: ScheduleEntry;
  readonly origin: SheetOrigin;
  readonly role: WorkspaceRole | null | undefined;
  /** The ticket's board number (#0427) when the Board has it; null otherwise. */
  readonly ticketNumber: string | null;
  /** Studio's base URL; the build's EXPO_PUBLIC_WEB_URL when not given. */
  readonly webUrl?: string;
};

export type PauseButtonView = {
  readonly label: string;
  /** Resume (the play icon) rather than Pause. */
  readonly resumes: boolean;
  /** What pressing it does. */
  readonly effect: string;
  /** Pausing today: the item may leave the feed (PRD-266 §4.9 not yet served). */
  readonly note: string | null;
  readonly action: SentPause;
};

export type ItemSheetView = {
  readonly kind: KindWord;
  readonly flags: readonly ItemFlag[];
  readonly title: string;
  /** 'Fri 23 Oct · 09:00 · Ledger · weekdays'; 'Every day · every 15 min · Relay' for the band. */
  readonly when: string;
  readonly paused: boolean;
  readonly pause: PauseButtonView | null;
  /** D-ROLES: a viewer on a routine or a scheduled task. */
  readonly readOnly: string | null;
  /** Managed in Studio: its page, or null when this build has no Studio address. */
  readonly studio: { readonly url: string | null } | null;
  readonly board: { readonly label: string; readonly href: string } | null;
};

function joined(parts: readonly (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(SEPARATOR);
}

function headOf(origin: SheetOrigin) {
  if ('band' in origin) {
    const line = bandLineView(origin.band);
    const when = joined([CALENDAR_COPY.sheet.everyDay, line.every, origin.band.agent]);
    return { kind: line.kind, flags: line.flags, title: origin.band.title, when };
  }
  const row = rowView(origin.row);
  const when = joined([dayLabel(origin.day), origin.row.time, row.meta]);
  return { kind: row.kind, flags: row.flags, title: row.title, when };
}

/** The Pause or Resume button for a pause the server is asked for. */
export function pauseButton(action: SentPause, paused: boolean): PauseButtonView {
  const words = CALENDAR_COPY.sheet;
  const which = action.kind === 'routine' ? 'routine' : 'task';
  const resumes = action.kind === 'routine' ? paused : action.next === 'active';
  return {
    label: resumes ? words.resume[which] : words.pause[which],
    resumes,
    effect: resumes ? words.effect.resume : words.effect[which],
    note: resumes ? null : words.leavesFeed,
    action,
  };
}

function boardLink(item: ScheduleEntry, ticketNumber: string | null) {
  if (item.board_task_id === null) return null;
  const words = CALENDAR_COPY.sheet;
  return {
    label: ticketNumber ? words.onBoard(ticketNumber) : words.onBoardUnnumbered,
    href: routes.cc.ticket(item.board_task_id),
  };
}

export function itemSheetView(input: ItemSheetInput): ItemSheetView {
  const { item, role } = input;
  const offer = pauseOffer(item, role);
  // an undefined webUrl takes studioUrl's default, the build's EXPO_PUBLIC_WEB_URL
  const studio =
    offer.kind === 'manage_in_studio' ? { url: studioUrl(offer.link, input.webUrl) } : null;
  return {
    ...headOf(input.origin),
    paused: item.paused,
    pause:
      offer.kind === 'routine' || offer.kind === 'scheduled_task'
        ? pauseButton(offer, item.paused)
        : null,
    readOnly: offer.kind === 'read_only' ? CALENDAR_COPY.sheet.readOnly : null,
    studio,
    board: boardLink(item, input.ticketNumber),
  };
}

/** What the tab opened: a row of the chosen day (its key) or a band line (no row key). */
export type OpenedItem = { readonly itemId: string; readonly rowKey: string | null };

export type SheetTarget = { readonly item: ScheduleEntry; readonly origin: SheetOrigin };

/**
 * The opened item as the feed and the day show it now, or null once it has gone (a pause the
 * server drops from the feed, a day that left the strip at midnight): the sheet then closes.
 */
export function sheetTarget(
  items: readonly ScheduleEntry[] | undefined,
  model: Pick<DayModel, 'rows' | 'band'>,
  day: SheetDay,
  opened: OpenedItem,
): SheetTarget | null {
  const item = items?.find((each) => each.id === opened.itemId);
  if (!item) return null;
  if (opened.rowKey === null) {
    const band = model.band.find((line) => line.itemId === opened.itemId);
    return band ? { item, origin: { band } } : null;
  }
  const row = model.rows.find((each) => each.key === opened.rowKey);
  return row ? { item, origin: { row, day } } : null;
}

/** The ticket's number (#0427) when the Board's list has it; null otherwise (never its row id). */
export function boardNumberOf(
  tickets: readonly BoardTicket[] | undefined,
  taskId: number,
): string | null {
  const ticket = tickets?.find((each) => each.id === taskId);
  return ticket ? ticketNumberOf(ticket) : null;
}

/** The toast once the server has answered: paused or resumed, as it says (else as asked). */
export function pausedMessage(
  pausedNow: boolean | null,
  button: Pick<PauseButtonView, 'resumes'>,
  title: string,
): string {
  const paused = pausedNow ?? !button.resumes;
  return paused ? CALENDAR_COPY.sheet.paused(title) : CALENDAR_COPY.sheet.resumed(title);
}
