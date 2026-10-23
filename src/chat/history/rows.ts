// One older chat as its row shows it, pure: the title on one line, the time it last moved and the
// newest message, ported from the web's Play list (frontend/lib/play/conversations.ts at the pin:
// conversationTitle, lastActive, relativeTime, previewLine). The preview is the newest message of
// either side, so it carries no speaker. A chat Auto started unprompted (kind 'auto', PRD-205) is
// listed with the rest and says so in a word. "now" is always passed in, so tests pin it.

import { joinLabel } from '../../ui/paint';
import type { HistoryRow } from '../schemas';
import { HISTORY_COPY } from '../strings';

export type ChatRowView = {
  readonly id: string;
  readonly title: string;
  /** '2 min', 'Yesterday', '9 Oct'; '' when the server sent no readable time. */
  readonly time: string;
  readonly preview: string | null;
  /** Auto started this chat: the row carries HISTORY_COPY.autoMarker. */
  readonly auto: boolean;
  readonly accessibilityLabel: string;
};

const WEEK_DAYS = 7;
const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const DAY_MS = 24 * HOUR_MINUTES * MINUTE_MS;
/** The web's locale for these dates; the copy is English in v1. */
const LOCALE = 'en-GB';

const weekday = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function parseDate(iso: string | null): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** When the chat last moved (the history is ordered by it), else when it began. */
export function lastActive(row: HistoryRow): Date | null {
  return parseDate(row.updatedAt) ?? parseDate(row.createdAt);
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole calendar days from date to now: 0 today, 1 yesterday; rounded, so a DST day is one. */
function daysAgo(date: Date, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
}

function sameDayTime(date: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / MINUTE_MS));
  if (minutes < 1) return HISTORY_COPY.justNow;
  if (minutes < HOUR_MINUTES) return HISTORY_COPY.minutes(minutes);
  return HISTORY_COPY.hours(Math.floor(minutes / HOUR_MINUTES));
}

/** 'Just now', '2 min', '3 h', 'Yesterday', 'Mon', '9 Oct' (with the year when not this one). */
export function relativeTime(date: Date | null, now: Date): string {
  if (!date) return '';
  const days = daysAgo(date, now);
  if (days <= 0) return sameDayTime(date, now);
  if (days === 1) return HISTORY_COPY.yesterday;
  if (days < WEEK_DAYS) return weekday.format(date);
  return date.getFullYear() === now.getFullYear()
    ? dayMonth.format(date)
    : dayMonthYear.format(date);
}

function oneLine(text: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** The title on one line, or the web's 'New chat' for a chat with no title yet. */
export function chatTitle(row: HistoryRow): string {
  return oneLine(row.title) || HISTORY_COPY.untitled;
}

/** The newest message on one line, or null when the chat has none yet. */
export function previewLine(row: HistoryRow): string | null {
  return oneLine(row.lastMessagePreview) || null;
}

export function chatRowView(row: HistoryRow, now: Date): ChatRowView {
  const title = chatTitle(row);
  const time = relativeTime(lastActive(row), now);
  const preview = previewLine(row);
  const auto = row.kind === 'auto';
  return {
    id: row.id,
    title,
    time,
    preview,
    auto,
    accessibilityLabel: joinLabel(title, auto ? HISTORY_COPY.autoMarkerLabel : null, time, preview),
  };
}

/** The list's rows in the server's order (newest activity first). */
export function chatRowViews(rows: readonly HistoryRow[], now: Date): ChatRowView[] {
  return rows.map((row) => chatRowView(row, now));
}
