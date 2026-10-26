// Play's thread over A2's view-model (Ember 01-02, US-016k), pure: A2's rows (src/chat/view-model.ts
// threadRows) drawn with US-017c's pieces. A tool line is Play's chip in the same words, tone and
// spoken label; a receipt is Play's "What Auto did" line, its badge toned as the web's receipts.tsx
// tones it (Done in the accent, Not done the error, Skipped faded) and a done write drawn in the
// text colour; a receipt with a link stays a link. The message just sent and the reply being
// written rise in (history never replays); the reply carries the caret only while this phone reads
// it. The header's title is the chat's own (A2's check of GET /api/chat/{id}), else 'New chat' for
// a draft. The user's message names the files that went with it, as A2's bubble does; a report card
// says its kind ('Report' for a document, Ember's word).

import type { ThreadState } from '../../chat/controller/thread';
import type { ChatThread } from '../../chat/schemas';
import { CHAT_COPY } from '../../chat/strings';
import {
  LIVE_AUTO_KEY,
  LIVE_USER_KEY,
  type ReceiptRow,
  type ReceiptsView,
  type ToolLineRow,
  type UserRow,
} from '../../chat/view-model';
import { KIND_WORDS, type DeliverableRef } from '../../core/web/lib/chat/deliverables';
import {
  reportEyebrow,
  type BadgeTone,
  type ReceiptRow as PlayReceiptRow,
  type ToolChipView,
} from '../play/companion/model';
import { PLAY_HOME_COPY } from '../strings';

/** A2's tool lines as Play's chips: the same words, tone and spoken label. */
export function toolChipsOf(lines: readonly ToolLineRow[]): readonly ToolChipView[] {
  return lines.map((line) => ({
    key: line.key,
    kind: line.tone,
    mark: line.mark,
    text: line.text,
    label: line.accessibilityLabel,
  }));
}

function badgeToneOf(row: ReceiptRow): BadgeTone | null {
  if (row.badge === null) return null;
  if (row.status === 'refused') return 'error';
  return row.status === 'skipped' ? 'faded' : 'accent';
}

/** A2's "What Auto did" as Play's lines; none for a reply from before receipts. */
export function playReceiptRows(view: ReceiptsView | null): readonly PlayReceiptRow[] {
  if (!view) return [];
  return view.lines.map((row) => ({
    key: row.key,
    mark: row.mark,
    text: row.text,
    badge: row.badge,
    badgeTone: badgeToneOf(row),
    // A2's badge on a done receipt is Done, which only a done write carries
    emphasis: row.status === 'done' && row.badge !== null,
    label: row.accessibilityLabel,
    linked: row.link !== null,
  }));
}

/** The message just sent and the reply being written rise in; history never replays. */
export function risesIn(key: string): boolean {
  return key === LIVE_USER_KEY || key === LIVE_AUTO_KEY;
}

/** The caret follows the reply while this phone reads it. */
export function caretOn(key: string, state: Pick<ThreadState, 'status'>): boolean {
  return key === LIVE_AUTO_KEY && state.status === 'streaming';
}

/** The chat's own title once A2's check has it, else 'New chat' (a draft) or Play's untitled. */
export function playTitle(
  state: Pick<ThreadState, 'chatId'>,
  checked: ChatThread | null | undefined,
): string {
  if (state.chatId === null) return PLAY_HOME_COPY.newChat;
  const title = checked?.id === state.chatId ? checked.title?.trim() : '';
  return title || PLAY_HOME_COPY.untitled;
}

/** The user's words, then the files that went with them ('Attached: notes.pdf'). */
export function userWords(row: Pick<UserRow, 'text' | 'files'>): string {
  const attached = row.files.length > 0 ? `${CHAT_COPY.attached}: ${row.files.join(', ')}` : '';
  return [row.text, attached].filter(Boolean).join('\n');
}

/** 'Report · just now' for a document (Ember's word), 'Image · just now', 'Video · just now'. */
export function reportEyebrowOf(ref: Pick<DeliverableRef, 'kind'>): string {
  return ref.kind === 'document' ? reportEyebrow() : reportEyebrow(KIND_WORDS[ref.kind]);
}
