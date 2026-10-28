// The notifications inbox as its rows show it, pure: the bell's notifications newest first, the one
// a push asked for (its notification_id, the route's focus) first of all, each with its title, its
// message, a relative time ('2 min', 'Yesterday', '9 Oct': the older chats list's own words), and
// whether it is unread. VoiceOver hears one label per row: 'Unread' first when it is, then the
// title, the message and the time. The menu's number is the server's unread count. "now" is
// always passed in, so tests pin it.

import { relativeTime } from '../../chat/history/rows';
import { joinLabel } from '../../ui/paint';
import { badgeText, countPhrase } from '../../ui/variants';
import { PUSH_INBOX_COPY } from '../strings';
import type { InboxNotification } from './schemas';

export type InboxRowView = Readonly<{
  id: string;
  title: string;
  /** The notification's message on its own lines; null when it has none. */
  message: string | null;
  /** '2 min', 'Yesterday', '9 Oct'; '' when the server sent no readable time. */
  time: string;
  unread: boolean;
  /** The row a push asked for: shown first. */
  focused: boolean;
  accessibilityLabel: string;
}>;

function parseDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function textOf(value: string | null): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function rowView(row: InboxNotification, now: Date, focus: string | null): InboxRowView {
  const title = row.title.trim() || PUSH_INBOX_COPY.title;
  const message = textOf(row.message);
  const time = relativeTime(parseDate(row.created_at), now);
  const unread = row.read_at === null;
  return Object.freeze({
    id: row.id,
    title,
    message,
    time,
    unread,
    focused: focus !== null && row.id.toLowerCase() === focus,
    accessibilityLabel: joinLabel(unread ? PUSH_INBOX_COPY.unread : null, title, message, time),
  });
}

/** The rows in the server's order (newest first), the focused one moved to the top. */
export function inboxRows(
  rows: readonly InboxNotification[],
  now: Date,
  focus: string | null = null,
): readonly InboxRowView[] {
  const views = rows.map((row) => rowView(row, now, focus));
  const first = views.filter((view) => view.focused);
  const rest = views.filter((view) => !view.focused);
  return Object.freeze([...first, ...rest]);
}

/** The inbox has something to mark read: one row at least is unread. */
export function hasUnread(rows: readonly InboxNotification[]): boolean {
  return rows.some((row) => row.read_at === null);
}

/** The same rows with these read now (a new array; the read ones keep their own time). */
export function withRead(
  rows: readonly InboxNotification[],
  ids: ReadonlySet<string> | 'all',
  at: string,
): readonly InboxNotification[] {
  return rows.map((row) =>
    row.read_at === null && (ids === 'all' || ids.has(row.id))
      ? Object.freeze({ ...row, read_at: at })
      : row,
  );
}

/** The unread number to draw, or null when there is none to show. */
export function unreadBadge(count: number): number | null {
  return badgeText(count) === null ? null : Math.floor(count);
}

/** 'Notifications', or 'Notifications, 3 unread' for VoiceOver. */
export function inboxButtonLabel(count: number): string {
  const shown = unreadBadge(count);
  return joinLabel(
    PUSH_INBOX_COPY.menu,
    shown === null ? null : countPhrase(shown, PUSH_INBOX_COPY.unreadCount),
  );
}
