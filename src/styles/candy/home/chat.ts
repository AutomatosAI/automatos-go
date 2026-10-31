// P2 Chat over A2's one thread (PRD-001 §4.6.2 D-CAN-6, US-023h; CANDY-LAYOUT §4 P2 and the kit's
// chat/lines.ts and thread.tsx at 3920359d5), pure: A2's view-model rows (threadRows) as the Chat
// view's entries, oldest first, under the AI label the thread opens with, as homes/play-thread.ts
// and homes/arcade-story.ts take them.
//
//   you        the user's bubble: their words and the files that went with them (userWords)
//   auto       what the reply did as chips (the kit's rule: its receipts in A2's words, a done one
//              ✓ with its link, a refused one ✕; for a reply with none, its tool lines: ✓ done,
//              ● running, ✕ failed; a skipped call and one waiting on its approval card show none),
//              then Auto's bubble (A2's markdown), a row for each Deliverable the turn made
//              (shelf.ts files them; its square in its kind's gradient, kinds.ts), and A2's own
//              notices, ticket cards and cards, placed as A2 draws them
//   writing    'Auto is writing' while A2's isWorking has no words yet (its 'working' row)
//   notice     A2's one notice under the thread (a stop, a failure with Try again)
//   loose      cards whose reply never came, and the Deliverables no drawn reply holds
// Then the stage's words: its title (the chat's own, else 'New chat'), the state pill and where its
// back circle goes; and what the voice window over the message box shows on this view. Pure: no
// React, React Native, Expo or Skia.

import type { CardRow } from '../../../chat/cards/view';
import type { ThreadState } from '../../../chat/controller/thread';
import type { ChatThread } from '../../../chat/schemas';
import type {
  AutoRow,
  ChatRow,
  Notice,
  ReceiptRow,
  ToolLineRow,
} from '../../../chat/view-model';
import {
  KIND_WORDS,
  isDeliverableId,
  type DeliverableRef,
} from '../../../core/web/lib/chat/deliverables';
import type { WebLinkTarget } from '../../../navigation/web-links';
import type { VoiceLine } from '../../../voice/screen/core-props';
import { userWords } from '../../homes/play-thread';
import { LOOSE_REPORTS } from '../../homes/shelf';
import type { ChipView } from '../../hud/core/model';
import type { Stage, StageVoice } from '../auto/stage';
import { deliverableSetOf } from '../kinds';
import type { CardSet } from '../sets';
import { CANDY_CHAT_COPY } from '../strings';

export type ChipTone = 'done' | 'running' | 'failed';

export type ToolChip = {
  readonly key: string;
  readonly tone: ChipTone;
  /** ✓, ● or ✕, hidden from VoiceOver: the label says it. */
  readonly glyph: string;
  /** A2's words. */
  readonly text: string;
  readonly label: string;
  /** A done receipt's link, opened as A2 opens it. */
  readonly link: WebLinkTarget | null;
};

export type DeliverableRow = {
  readonly key: string;
  readonly id: string;
  readonly title: string;
  /** 'Document', 'Image', 'Video'. */
  readonly kind: string;
  /** The square's gradient (kinds.ts). */
  readonly set: CardSet;
  readonly label: string;
  /** Open shows: the id is one the Deliverables route takes. */
  readonly openable: boolean;
};

export type ChatEntry =
  | { readonly kind: 'you'; readonly key: string; readonly text: string; readonly label: string }
  | {
      readonly kind: 'auto';
      readonly key: string;
      readonly row: AutoRow;
      readonly chips: readonly ToolChip[];
      readonly deliverables: readonly DeliverableRow[];
    }
  | { readonly kind: 'writing'; readonly key: string }
  | { readonly kind: 'notice'; readonly key: string; readonly notice: Notice }
  | {
      readonly kind: 'loose';
      readonly key: string;
      readonly cards: readonly CardRow[];
      readonly deliverables: readonly DeliverableRow[];
    };

const NO_REFS: readonly DeliverableRef[] = Object.freeze([]);
const SHOWN_TONES: ReadonlySet<string> = new Set<ChipTone>(['done', 'running', 'failed']);

function chip(key: string, tone: ChipTone, text: string, label: string, link: WebLinkTarget | null) {
  const glyph = CANDY_CHAT_COPY.chipGlyph[tone];
  return Object.freeze({ key, tone, glyph, text, label, link });
}

function receiptChip(row: ReceiptRow): ToolChip[] {
  if (row.status === 'waiting' || row.status === 'skipped') return [];
  const failed = row.status === 'refused';
  const tone = failed ? 'failed' : 'done';
  return [chip(row.key, tone, row.text, row.accessibilityLabel, failed ? null : row.link)];
}

function lineChip(line: ToolLineRow): ToolChip[] {
  if (!SHOWN_TONES.has(line.tone)) return [];
  return [chip(line.key, line.tone as ChipTone, line.text, line.accessibilityLabel, null)];
}

/** What a reply did, as the chips over Auto's bubble: its receipts, else its tool lines. */
export function toolChipsOf(row: Pick<AutoRow, 'toolLines' | 'receipts'>): readonly ToolChip[] {
  const receipts = row.receipts?.lines ?? [];
  const chips = receipts.length > 0 ? receipts.flatMap(receiptChip) : row.toolLines.flatMap(lineChip);
  return Object.freeze(chips);
}

/** A Deliverable the turn made, as its row says it. */
export function deliverableRow(ref: DeliverableRef): DeliverableRow {
  const kind = KIND_WORDS[ref.kind];
  return Object.freeze({
    key: ref.id,
    id: ref.id,
    title: ref.title,
    kind,
    set: deliverableSetOf(ref.kind),
    label: CANDY_CHAT_COPY.deliverableLabel(ref.title, kind),
    openable: isDeliverableId(ref.id),
  });
}

type Places = ReadonlyMap<string, readonly DeliverableRef[]>;

function autoEntry(row: AutoRow, places: Places): ChatEntry {
  return {
    kind: 'auto',
    key: row.key,
    row,
    chips: toolChipsOf(row),
    deliverables: (places.get(row.key) ?? NO_REFS).map(deliverableRow),
  };
}

function entryOf(row: ChatRow, places: Places): ChatEntry {
  switch (row.type) {
    case 'user':
      return { kind: 'you', key: row.key, text: userWords(row), label: row.accessibilityLabel };
    case 'auto':
      return autoEntry(row, places);
    case 'working':
      return { kind: 'writing', key: row.key };
    case 'notice':
      return { kind: 'notice', key: row.key, notice: row.notice };
    case 'cards':
      return { kind: 'loose', key: row.key, cards: row.cards, deliverables: [] };
    case 'suggestion':
      return autoEntry(row.text, places); // its words until Candy draws the card (PRD-268 §6.5.1)
  }
}

/**
 * The Chat view's entries, oldest first: each of A2's rows, then the Deliverables no drawn reply
 * holds (shelf.ts's LOOSE_REPORTS) as one more entry. `places` is placeReports' map.
 */
export function chatEntries(rows: readonly ChatRow[], places: Places): readonly ChatEntry[] {
  const entries = rows.map((row) => entryOf(row, places));
  const loose = places.get(LOOSE_REPORTS) ?? NO_REFS;
  if (loose.length === 0) return Object.freeze(entries);
  const rest: ChatEntry = {
    kind: 'loose',
    key: LOOSE_REPORTS,
    cards: [],
    deliverables: loose.map(deliverableRow),
  };
  return Object.freeze([...entries, rest]);
}

// ── The stage ──────────────────────────────────────────────────────────────────────────────

/** The stage's title: the chat's own once A2's check has it, else 'New chat'. */
export function chatTitle(
  state: Pick<ThreadState, 'chatId'>,
  checked: ChatThread | null | undefined,
): string {
  const title = state.chatId !== null && checked?.id === state.chatId ? checked.title?.trim() : '';
  return title || CANDY_CHAT_COPY.newChat;
}

/** The state pill's words: the glyph and the word ('● Listening'); VoiceOver hears the word. */
export function statePill(stage: Pick<Stage, 'glyph' | 'word'>): { text: string; label: string } {
  return Object.freeze({ text: CANDY_CHAT_COPY.state(stage.glyph, stage.word), label: stage.word });
}

/** Where the back circle goes: the route's Back, Today in place on the home, else the home. */
export type StageBack = 'onBack' | 'today' | 'home';

export function stageBack(onHomeRoute: boolean, hasOnBack: boolean): StageBack {
  if (hasOnBack) return 'onBack';
  return onHomeRoute ? 'today' : 'home';
}

// ── The voice on the Chat view ─────────────────────────────────────────────────────────────

type WindowVoice = {
  readonly stage: StageVoice;
  readonly caption: ChipView | null;
  readonly line: VoiceLine | null;
  readonly stopEnabled: boolean;
};

/** The mic is held or Auto has the voice's turn (hud-home-voice.ts's rule, mirrored). */
const VOICE_WORKS: ReadonlySet<StageVoice['phase']> = new Set<StageVoice['phase']>([
  'listening',
  'thinking',
  'speaking',
]);

/**
 * What the voice window over the message box shows on the Chat view: the voice's words while it
 * works and its line ('See it in the chat' left out: the chat is on screen), with Stop only while
 * the voice works (a typed turn's Stop is the box's own button).
 */
export function chatViewVoice(voice: WindowVoice): Omit<WindowVoice, 'stage'> {
  const works = voice.stage.micOpen || VOICE_WORKS.has(voice.stage.phase);
  return Object.freeze({
    caption: works ? voice.caption : null,
    line: voice.line?.kind === 'chat' ? null : voice.line,
    stopEnabled: works && voice.stopEnabled,
  });
}
