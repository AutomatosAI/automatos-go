// Play's Conversations (Ember 03), pure: the sections by calendar day (Today, This week, Earlier),
// the relative time, the title, the preview with its speaker and the report badge. The rules are
// the web's Play list (frontend/lib/play/conversations.ts at the pin: groupOf, relativeTime,
// conversationTitle, previewLine), with the timezone a parameter beside now ({now, timeZone}), so a
// row reads the phone's own calendar and tests pin both. A zone the engine refuses falls back to
// the phone's clock, which runs in the same zone (as src/cc/calendar/zone.ts does). Ember's
// 'Auto: …' / 'You: …' speaker is shown when the row knows it; A2's history preview carries none.

import { logger } from '../../../lib/logger';
import { joinLabel } from '../../../ui/paint';
import { countPhrase } from '../../../ui/variants';
import { PLAY_CONVERSATIONS_COPY } from '../../strings';

export type Clock = { readonly now: Date; readonly timeZone: string | null };

export type SectionKey = 'today' | 'week' | 'earlier';

export type ConversationPreview = {
  readonly text: string;
  /** Who wrote it; null when the server does not say (the core's preview is either side's). */
  readonly from: 'auto' | 'user' | null;
};

/** One conversation as the list reads it (phase 2 maps A2's history rows to it). */
export type PlayConversation = {
  readonly id: string;
  readonly title: string | null;
  readonly updatedAt: string | null;
  readonly createdAt?: string | null;
  readonly preview: ConversationPreview | null;
  /** Reports Auto made in it; the badge shows from one. */
  readonly reports: number;
};

export type ConversationRowView = {
  readonly id: string;
  readonly title: string;
  /** '2 min', 'Mon', '9 Oct'; '' when the row has no readable time. */
  readonly time: string;
  readonly preview: string | null;
  /** '1 Report', '2 Reports'; null at none. */
  readonly badge: string | null;
  readonly label: string;
};

export type ConversationSection = {
  readonly key: SectionKey;
  readonly title: string;
  readonly data: readonly ConversationRowView[];
};

const SECTION_ORDER: readonly SectionKey[] = ['today', 'week', 'earlier'];
/** "This week" is the six calendar days before today. */
const WEEK_DAYS = 7;
const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const DAY_MS = 24 * HOUR_MINUTES * MINUTE_MS;
/** The web's locale for these dates; the copy is English in v1. */
const LOCALE = 'en-GB';
/** Reads a calendar day as numbers only; never shown. */
const DAY_LOCALE = 'en-CA';

type FormatKind = 'day' | 'weekday' | 'dayMonth' | 'dayMonthYear';

const FORMATS: Readonly<Record<FormatKind, Intl.DateTimeFormatOptions>> = Object.freeze({
  day: { year: 'numeric', month: 'numeric', day: 'numeric' },
  weekday: { weekday: 'short' },
  dayMonth: { day: 'numeric', month: 'short' },
  dayMonthYear: { day: 'numeric', month: 'short', year: 'numeric' },
});

/** One formatter per zone and kind, made once (Hermes makes an Intl formatter slowly). */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(kind: FormatKind, timeZone: string | null): Intl.DateTimeFormat {
  const zone = timeZone?.trim() || null;
  const key = `${kind}|${zone ?? ''}`;
  const known = formatters.get(key);
  if (known) return known;
  const locale = kind === 'day' ? DAY_LOCALE : LOCALE;
  const options = zone ? { ...FORMATS[kind], timeZone: zone } : FORMATS[kind];
  let made: Intl.DateTimeFormat;
  try {
    made = new Intl.DateTimeFormat(locale, options);
  } catch (error) {
    logger.debug(`[styles/play] the clock in ${zone} could not be read; using the phone's`, error);
    made = new Intl.DateTimeFormat(locale, FORMATS[kind]);
  }
  formatters.set(key, made);
  return made;
}

type CalendarDate = { readonly year: number; readonly month: number; readonly day: number };

/** The zone's calendar date of a moment; the phone's own when the parts cannot be read. */
function calendarDate(date: Date, timeZone: string | null): CalendarDate {
  const parts = formatter('day', timeZone).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((each) => each.type === type)?.value);
  const zoned = { year: part('year'), month: part('month'), day: part('day') };
  if ([zoned.year, zoned.month, zoned.day].every(Number.isInteger)) return zoned;
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

/** Whole calendar days from date to now on the zone's calendar: 0 today, 1 yesterday. */
function daysAgo(date: Date, clock: Clock): number {
  const dayNumber = (at: Date) => {
    const { year, month, day } = calendarDate(at, clock.timeZone);
    return Date.UTC(year, month - 1, day) / DAY_MS;
  };
  return dayNumber(clock.now) - dayNumber(date);
}

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** When the conversation last moved (the history is ordered by it), else when it began. */
export function lastActive(conversation: Pick<PlayConversation, 'updatedAt' | 'createdAt'>) {
  return parseDate(conversation.updatedAt) ?? parseDate(conversation.createdAt);
}

/** Today from the zone's midnight; This week for the six days before; Earlier, or with no date. */
export function sectionOf(date: Date | null, clock: Clock): SectionKey {
  if (!date) return 'earlier';
  const days = daysAgo(date, clock);
  if (days <= 0) return 'today';
  return days < WEEK_DAYS ? 'week' : 'earlier';
}

function sameDayTime(date: Date, now: Date): string {
  const said = PLAY_CONVERSATIONS_COPY;
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / MINUTE_MS));
  if (minutes < 1) return said.justNow;
  if (minutes < HOUR_MINUTES) return said.minutes(minutes);
  return said.hours(Math.floor(minutes / HOUR_MINUTES));
}

function sameYear(date: Date, clock: Clock): boolean {
  return calendarDate(date, clock.timeZone).year === calendarDate(clock.now, clock.timeZone).year;
}

/** '2 min', '3 h', 'Yesterday', 'Mon', '9 Oct' (with the year when not this one); '' unknown. */
export function relativeTime(date: Date | null, clock: Clock): string {
  if (!date) return '';
  const days = daysAgo(date, clock);
  if (days <= 0) return sameDayTime(date, clock.now);
  if (days === 1) return PLAY_CONVERSATIONS_COPY.yesterday;
  if (days < WEEK_DAYS) return formatter('weekday', clock.timeZone).format(date);
  const kind = sameYear(date, clock) ? 'dayMonth' : 'dayMonthYear';
  return formatter(kind, clock.timeZone).format(date);
}

function oneLine(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** The title on one line, or 'New chat' for a conversation with no title yet. */
export function conversationTitle(title: string | null): string {
  return oneLine(title) || PLAY_CONVERSATIONS_COPY.untitled;
}

/** 'Auto: …' or 'You: …' when the speaker is known; the words alone otherwise; null when blank. */
export function previewText(preview: ConversationPreview | null): string | null {
  const text = oneLine(preview?.text);
  if (!preview || !text) return null;
  const said = PLAY_CONVERSATIONS_COPY.preview;
  if (preview.from === null) return text;
  return `${preview.from === 'auto' ? said.auto : said.user}${said.joiner}${text}`;
}

/** '1 Report', '2 Reports'; null below one. */
export function reportBadge(count: number): string | null {
  if (!Number.isFinite(count) || count < 1) return null;
  return countPhrase(Math.floor(count), PLAY_CONVERSATIONS_COPY.reports);
}

function rowView(conversation: PlayConversation, clock: Clock): ConversationRowView {
  const title = conversationTitle(conversation.title);
  const time = relativeTime(lastActive(conversation), clock);
  const preview = previewText(conversation.preview);
  const badge = reportBadge(conversation.reports);
  const label = joinLabel(title, time, preview, badge);
  return { id: conversation.id, title, time, preview, badge, label };
}

/** The sections in Ember's order, empty ones left out; the history's order is kept inside each. */
export function conversationSections(
  conversations: readonly PlayConversation[],
  clock: Clock,
): readonly ConversationSection[] {
  const rows = conversations.map((conversation) => ({
    key: sectionOf(lastActive(conversation), clock),
    row: rowView(conversation, clock),
  }));
  return SECTION_ORDER.map((key) => ({
    key,
    title: PLAY_CONVERSATIONS_COPY.sections[key],
    data: rows.filter((each) => each.key === key).map((each) => each.row),
  })).filter((section) => section.data.length > 0);
}
