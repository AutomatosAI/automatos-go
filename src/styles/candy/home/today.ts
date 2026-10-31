// P1 Today in Candy (PRD-001 §4.6.2 D-CAN-6, US-023g; CANDY-LAYOUT §4 P1 and the 390 mock; the
// design kit's today/today-words.ts, stat-cards.tsx and needs-window.tsx at 3920359d5), pure: the
// header's words, the orb's figure, the stat cards and the Needs you window's rows. Everything is a
// number or a row the app already reads (D-CAN-6): needs-you's total and rows (useNeedsYou, through
// A2's needsStrip), and the Board's query the Command Centre makes. The components only draw.
//
//   The greeting is the kit's greetingFor: by the phone's hour, with no name (the app reads none,
//   repoContradictions). Under it, needs-you's total in words once it has answered ('3 things need
//   you', 'Nothing needs you' at 0); nothing before.
//   The orb shows needs-you's total with 'need you' (a Board row carries no completion time,
//   openQuestions Q1), '—' until it has answered, as the kit's figureOf says a count still unknown.
//   The stat cards, in the kit's order and sets: Working now (the Board's top-level In progress
//   count, as Arcade's QUEST counts it), Needs you (needs-you's total, the middle card standing
//   taller) and In queue (the Board's top-level Inbox and Assigned count). A card whose number the
//   app has not had yet is left out, never shown as 0.
//   The Needs you window: the first two cards of A2's needsStrip, each with its agent's initial, the
//   request on one line ('Ledger: ' left off a question's words, the agent being named under it),
//   '{agent} · {time ago}' (when.ts agoWords on the row's own time), and the card's target, opened
//   as Studio's strip opens it; VoiceOver hears the card's own label. No rows, no window.
// Pure: no React, React Native, Expo or Skia.

import { filterTickets, topLevelTickets } from '../../../cc/board/board';
import type { BoardTicket } from '../../../cc/board/schemas';
import type { NeedsStrip, StripCard } from '../../../chat/home/needs-strip';
import type { WebLinkTarget } from '../../../navigation/web-links';
import { questCount } from '../../homes/arcade-home';
import { cardSetOf, type CardSet } from '../sets';
import { CANDY_TODAY_COPY } from '../strings';
import { agoWords } from '../when';

// ── The header and the orb ───────────────────────────────────────────────────────────────────

/** The kit's greetingFor: morning before noon, afternoon until six, then evening. */
const AFTERNOON_FROM = 12;
const EVENING_FROM = 18;

/** 'Good morning' before noon, 'Good afternoon' until six, then 'Good evening'. */
export function greetingFor(hour: number): string {
  const { greeting } = CANDY_TODAY_COPY;
  if (hour < AFTERNOON_FROM) return greeting.morning;
  if (hour < EVENING_FROM) return greeting.afternoon;
  return greeting.evening;
}

const known = (count: number | null | undefined): count is number =>
  typeof count === 'number' && Number.isFinite(count) && count >= 0;

/** The line under the greeting: needs-you's total in words, or null until it has answered. */
export function needsLine(total: number | null): string | null {
  if (!known(total)) return null;
  return total === 0 ? CANDY_TODAY_COPY.nothingNeeds : CANDY_TODAY_COPY.needs(total);
}

/** The kit's: a count still unknown. */
export const UNKNOWN_FIGURE = '—';

/** A count as the orb and a card show it: the number, or '—' while it is unknown (the kit's figureOf). */
export function figureOf(count: number | null): string {
  return known(count) ? String(count) : UNKNOWN_FIGURE;
}

// ── The stat cards ───────────────────────────────────────────────────────────────────────────

/** The design's measures (P1): each card's width and height (the middle one taller), the row's gap, the badge and its dot. */
export const STAT_CARD = Object.freeze({
  width: 132,
  height: 156,
  tallHeight: 172,
  gap: 12,
  padding: 14,
  badge: 34,
  dot: 12,
});

/** The Board's In queue count: the top-level tickets in its Inbox and Assigned columns. */
export function queueCount(tickets: readonly BoardTicket[]): number {
  const top = topLevelTickets(tickets);
  return filterTickets(top, 'inbox').length + filterTickets(top, 'assigned').length;
}

export type TodayCounts = {
  readonly working: number | null;
  readonly needs: number | null;
  readonly queue: number | null;
};

export type TodaySources = {
  /** useNeedsYou's total once it has answered; null before. */
  readonly needs: number | null;
  /** The Board's rows once its query has answered; null before. */
  readonly board: readonly BoardTicket[] | null;
};

/** Today's three numbers, each null until the read it comes from has answered. */
export function todayCounts({ needs, board }: TodaySources): TodayCounts {
  return Object.freeze({
    working: board === null ? null : questCount(board),
    needs: known(needs) ? needs : null,
    queue: board === null ? null : queueCount(board),
  });
}

export type StatKey = keyof TodayCounts;

export type StatCard = {
  readonly key: StatKey;
  readonly label: string;
  readonly figure: string;
  /** The card's gradient: its place in the kit's row (1, 2, 3). */
  readonly set: CardSet;
  /** The middle card stands taller. */
  readonly height: number;
  readonly accessibilityLabel: string;
};

const STAT_ORDER: readonly StatKey[] = Object.freeze(['working', 'needs', 'queue']);
const TALL_INDEX = 1;

/** The cards whose numbers the app has, in the kit's order, each in its own place's set. */
export function statCards(counts: TodayCounts): readonly StatCard[] {
  return Object.freeze(
    STAT_ORDER.flatMap((key, index) => {
      const count = counts[key];
      if (count === null) return [];
      const label = CANDY_TODAY_COPY.stats[key];
      const figure = figureOf(count);
      const height = index === TALL_INDEX ? STAT_CARD.tallHeight : STAT_CARD.height;
      const accessibilityLabel = CANDY_TODAY_COPY.statLabel(label, figure);
      return [Object.freeze({ key, label, figure, set: cardSetOf(index), height, accessibilityLabel })];
    }),
  );
}

// ── The Needs you window ─────────────────────────────────────────────────────────────────────

/** P1 shows two rows, each 48 tall with a 38 pt avatar. */
export const NEEDS_WINDOW = Object.freeze({ rows: 2, rowHeight: 48, avatar: 38 });

export type NeedRow = {
  readonly key: string;
  /** The request, on one line. */
  readonly request: string;
  /** '{agent} · {time ago}'. */
  readonly meta: string;
  /** The name the avatar's initial comes from ('' when the row names none: '?'). */
  readonly avatarName: string;
  readonly set: CardSet;
  /** Where the row opens; null when the row names nothing the phone or Studio can open. */
  readonly target: WebLinkTarget | null;
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string | undefined;
};

/** A question's title is '{agent}: {words}' in A2's strip; the agent is named under it here. */
export function requestOf(card: Pick<StripCard, 'kind' | 'title' | 'agent'>): string {
  const prefix = card.agent === null ? null : `${card.agent}: `;
  if (card.kind !== 'question' || prefix === null || !card.title.startsWith(prefix)) {
    return card.title;
  }
  return card.title.slice(prefix.length).trim() || card.title;
}

function rowOf(card: StripCard, index: number, now: number): NeedRow {
  const agent = card.agent ?? CANDY_TODAY_COPY.someAgent;
  return Object.freeze({
    key: card.key,
    request: requestOf(card),
    meta: CANDY_TODAY_COPY.meta(agent, agoWords(card.at, now)),
    avatarName: card.agent ?? '',
    set: cardSetOf(index),
    target: card.target,
    accessibilityLabel: card.accessibilityLabel,
    accessibilityHint: card.accessibilityHint,
  });
}

/** The window's rows: the strip's first two cards; none while nothing needs you. */
export function needRows(strip: NeedsStrip | null, now: number): readonly NeedRow[] {
  if (strip === null) return Object.freeze([]);
  return Object.freeze(
    strip.cards.slice(0, NEEDS_WINDOW.rows).map((card, index) => rowOf(card, index, now)),
  );
}
