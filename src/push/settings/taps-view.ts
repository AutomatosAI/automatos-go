// Recent notification taps as Settings → Notifications shows them, pure: one row per entry of the
// tap log (inbound/tap-log.ts), newest first — what happened in plain words, what the notification
// was about (its link type in words), and when ('2 min', 'Yesterday': the older chats list's
// words). An unverified tap says why it could not be checked. VoiceOver hears each row as one line.
// "now" is passed in, so tests pin it.

import { relativeTime } from '../../chat/history/rows';
import { joinLabel } from '../../ui/paint';
import type { TapEntry } from '../inbound/tap-log';
import { PUSH_TAPS_COPY } from '../strings';

export type TapRowView = Readonly<{
  key: string;
  /** What happened: 'Opened its screen', "Couldn't be checked: …". */
  title: string;
  /** What it was about and when: 'Ticket · 2 min'. */
  meta: string;
  accessibilityLabel: string;
}>;

const META_SEPARATOR = ' · ';

/** A word of the log in its table's words, or the fallback for a word this version does not know. */
function wordsFor(table: Readonly<Record<string, string>>, word: string | null, fallback: string) {
  return (word === null ? undefined : table[word]) ?? fallback;
}

function openedWords(entry: TapEntry): string {
  const { outcome } = PUSH_TAPS_COPY;
  const where = wordsFor(outcome, entry.reason, outcome.screen ?? '');
  return entry.detail === 'moved' ? `${where}: ${(outcome.moved ?? '').toLowerCase()}` : where;
}

function outcomeWords(entry: TapEntry): string {
  const { outcome, check, answer } = PUSH_TAPS_COPY;
  if (entry.kind === 'answer') return wordsFor(answer, entry.reason, outcome.answer ?? '');
  if (entry.kind === 'open') return openedWords(entry);
  const what = wordsFor(outcome, entry.reason, outcome.failed ?? '');
  const why = entry.reason === 'unverified' ? wordsFor(check, entry.detail, '') : '';
  return why ? `${what}: ${why}` : what;
}

function linkWords(entry: TapEntry): string {
  return entry.linkType
    ? (PUSH_TAPS_COPY.link[entry.linkType] ?? PUSH_TAPS_COPY.link.other ?? '')
    : PUSH_TAPS_COPY.noLink;
}

export function tapRows(entries: readonly TapEntry[], now: Date): readonly TapRowView[] {
  return entries.map((entry, index) => {
    const title = outcomeWords(entry);
    const time = relativeTime(new Date(entry.at), now);
    const meta = [linkWords(entry), time].filter((part) => part !== '').join(META_SEPARATOR);
    return Object.freeze({
      key: `${entry.at}-${index}`,
      title,
      meta,
      accessibilityLabel: joinLabel(title, linkWords(entry), time),
    });
  });
}
