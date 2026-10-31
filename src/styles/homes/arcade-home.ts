// Arcade's home over A2's one thread (PRD-001 §4.6.1 D-ARC-6, US-022g; the design kit's
// chat/saying.ts, frame/today.tsx and frame/controls.tsx at 034fa629c), pure: what the dialogue
// window says, today's counters and where each D-pad target goes. The components only draw.
//
//   The dialogue says Auto's newest reply, the one the story leaves out (sayingRowKey's row: the
//   newest of Auto's messages after the user's last, so a second message is never lost), as HUD's
//   transcript reads a reply (hud-turn.ts sayingTurn: plain words, A2's notice for a turn that
//   failed or stopped): '…' while a turn runs and has no words yet
//   (A2's isWorking), the kit's greeting before anything is said, 'Your move.' after a message no
//   reply came to. A reply is keyed by its turn (the chat and the index its question has among the
//   saved messages, which the live turn's `since` is), so the live reply and its saved copy are one
//   reply to the typewriter, typed once and said once. A reply typed on this screen (a live turn
//   was seen for its key) types; one already there when the chat opened shows whole and is not said
//   again (the window cannot tell a chat switch, so the home does). A later message after the same
//   question is its own reply (keyed by its id too): typed when it lands on screen, whole when the
//   chat opened with it (openedChat). A suggestion Auto posted (PRD-268 §6.5.1, where discovery
//   lists `suggestions`) is one of his replies here: when it is the newest, the dialogue says its
//   words as it says any reply (sayingOf reads its Auto row, arcade-story.ts autoRowOf), and the
//   story keeps only its card.
//   The day's brief (PRD-268 US-G06, D-ARC-7): where the reply the dialogue says carries one
//   (threadRows' row.brief, only where discovery lists `brief`), the dialogue says its greeting and
//   Auto's Read as plain words (hud-turn.ts plainText), keyed by its message, and offers OPEN
//   BRIEF. A brief already there when the chat opened shows whole; one that lands while the chat is
//   on screen (the brief on open) types, as a reply does (openedChat remembers which messages the
//   chat showed first).
//   The counters (D-ARC-6, the kit's today.tsx): ! is needs-you's total as served (useNeedsYou, the
//   header menu's number); QUEST the Board's In progress count, as its pill counts it (the top-level
//   tickets, from the query the Command Centre already makes); XP would be the tickets done today
//   in the phone's timezone, but a Board row carries no completion time (BOARD_TICKET_FIELDS has
//   created_at and updated_at only), so XP is left out (null), never guessed from updated_at. A
//   number the app has not had yet is null and left out too, never shown as 0.
//   The D-pad (D-ARC-6) switches the handheld's screen, as the web handheld does: ▲ Quests shows
//   the overworld map in the screen (US-022m), ▶ Inventory the Deliverables as items (US-022n),
//   neither a route; ◀ Chat the chat again (on the chat, the home: here already on home, else back
//   to it); ▼ Menu the header menu. Routes only from routes.ts.
// Pure: no React, React Native, Expo or Skia.

import type { Brief } from '../../brief/schema';
import type { ThreadState } from '../../chat/controller/thread';
import type { StoredMessage } from '../../chat/schemas';
import { isWorking, type ChatRow } from '../../chat/view-model';
import { filterTickets, topLevelTickets } from '../../cc/board/board';
import type { BoardTicket } from '../../cc/board/schemas';
import { routes } from '../../navigation/routes';
import type { CounterValues } from '../arcade/parts/counters';
import type { DialogueReply } from '../arcade/parts/dialogue';
import type { DPadId } from '../arcade/parts/pad-grid';
import { ARCADE_HOME_COPY } from '../strings';
import { autoRowOf } from './arcade-story';
import { plainText, sayingTurn } from './hud-turn';

// ── The dialogue ─────────────────────────────────────────────────────────────────────────────

/** A conversation before its first message names it. */
const DRAFT = 'draft';
/** What the dialogue says when no reply is its to say: each its own line to the typewriter. */
const LINE_IDS = Object.freeze({ loading: 'loading', greeting: 'greeting', yourMove: 'your-move' });

type TurnFacts = Pick<ThreadState, 'chatId' | 'live' | 'messages'>;

function lastQuestion(messages: readonly StoredMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') return index;
  }
  return -1;
}

/** The newest turn's key: the chat, and where its question sits (or will sit) in the saved list. */
export function dialogueKey(state: TurnFacts): string {
  // with no live turn every saved message shows (thread.ts shownMessages)
  const at = state.live ? state.live.since : lastQuestion(state.messages);
  return `${state.chatId ?? DRAFT}:${at}`;
}

/** The turns typed on this screen: the live turn's key joins once it is seen. */
export function withTyped(typed: ReadonlySet<string>, state: TurnFacts): ReadonlySet<string> {
  if (!state.live) return typed;
  const key = dialogueKey(state);
  return typed.has(key) ? typed : new Set([...typed, key]);
}

export type DialogueSay = {
  readonly reply: DialogueReply;
  /** A turn runs with no words yet: '…'. */
  readonly thinking: boolean;
  /** The day's brief the dialogue says (OPEN BRIEF opens it); absent otherwise. */
  readonly brief?: Brief;
};

function line(id: string, text: string): DialogueSay {
  return Object.freeze({
    reply: Object.freeze({ id, text, streaming: false, whole: true }),
    thinking: false,
  });
}

/**
 * The reply the dialogue says, as the story's rows have it (sayingRowKey's row): its saved
 * message's id (null for the reply still being written) and the day's brief it carries, where
 * threadRows kept one (discovery lists `brief`). A suggestion's post is read as its Auto row.
 */
export type Saying = { readonly messageId: string | null; readonly brief: Brief | null };

/** The saying row's message and brief; null when no row is the dialogue's. */
export function sayingOf(rows: readonly ChatRow[], sayingKey: string | null): Saying | null {
  if (sayingKey === null) return null;
  const found = rows.find((each) => each.key === sayingKey);
  const row = found ? autoRowOf(found) : null;
  if (row === null) return null;
  return Object.freeze({ messageId: row.messageId, brief: row.brief });
}

/** The brief as the dialogue says it: the greeting, then Auto's Read as plain words. */
export function briefWords(brief: Pick<Brief, 'greeting' | 'prose'>): string {
  return [brief.greeting.trim(), plainText(brief.prose)].filter(Boolean).join('\n');
}

/** The chat as it first showed on this screen: its id and the saved messages it held then. */
export type OpenedChat = {
  readonly chatId: string | null;
  readonly ids: ReadonlySet<string>;
} | null;

/** Remembers the messages a chat held when it first showed loaded, until the chat changes. */
export function openedChat(
  current: OpenedChat,
  state: Pick<ThreadState, 'status' | 'chatId' | 'messages'>,
): OpenedChat {
  if (state.status === 'loading') return current;
  if (current !== null && current.chatId === state.chatId) return current;
  const ids = new Set(state.messages.map((message) => message.id));
  return Object.freeze({ chatId: state.chatId, ids });
}

/** What the dialogue knows beyond the thread: the row it says, and the chat as it opened. */
export type DialogueMemory = { readonly saying: Saying | null; readonly opened: OpenedChat };

const NO_MEMORY: DialogueMemory = Object.freeze({ saying: null, opened: null });

/** A saved message that landed while the chat was on screen types; one it opened with is whole. */
function landedWhole(opened: OpenedChat, messageId: string): boolean {
  return opened?.ids.has(messageId) ?? true;
}

/** The brief said as a reply is: whole when the chat opened with it, typed when it landed later. */
function briefSay(brief: Brief, messageId: string, opened: OpenedChat): DialogueSay {
  const text = briefWords(brief);
  const whole = landedWhole(opened, messageId);
  const reply = Object.freeze({ id: `brief:${messageId}`, text, streaming: false, whole });
  return Object.freeze({ reply, thinking: false, brief });
}

/**
 * The saved reply the dialogue says when it is not the first of Auto's messages after the user's
 * last (a second message, after the turn's own reply): its id; null for the first, or a live turn.
 */
export function laterReplyId(state: ThreadState, saying: Saying | null): string | null {
  const id = saying?.messageId ?? null;
  if (state.live !== null || id === null) return null;
  const messages = state.messages;
  const first = messages
    .slice(lastQuestion(messages) + 1)
    .find((message) => message.role === 'assistant');
  return first === undefined || first.id === id ? null : id;
}

/**
 * The reply's place to the typewriter: the turn's key for its first reply (so the live reply and
 * its saved copy are one), its own for a later message, whole when the chat opened with it.
 */
function replyPlace(state: ThreadState, typed: ReadonlySet<string>, memory: DialogueMemory) {
  const id = dialogueKey(state);
  const later = laterReplyId(state, memory.saying);
  if (later !== null) return { id: `${id}:${later}`, whole: landedWhole(memory.opened, later) };
  return { id, whole: state.live === null && !typed.has(id) };
}

/** The saved or streaming reply the turn says, or the greeting or 'Your move.' when it says none. */
function replySay(state: ThreadState, typed: ReadonlySet<string>, memory: DialogueMemory) {
  const turn = sayingTurn(state, memory.saying?.messageId ?? null);
  if (turn.auto !== null) {
    const { id, whole } = replyPlace(state, typed, memory);
    const reply = Object.freeze({ id, text: turn.auto, streaming: turn.streaming, whole });
    return Object.freeze({ reply, thinking: false });
  }
  const said = ARCADE_HOME_COPY;
  return turn.you === null
    ? line(LINE_IDS.greeting, said.greeting)
    : line(LINE_IDS.yourMove, said.yourMove);
}

/**
 * What the dialogue window says now; `typed` is withTyped's memory for this screen, `memory` the
 * saying row (sayingOf: the same reply the story leaves out) and openedChat's memory.
 */
export function dialogueSay(
  state: ThreadState,
  typed: ReadonlySet<string>,
  memory: DialogueMemory = NO_MEMORY,
): DialogueSay {
  if (state.status === 'loading') return line(LINE_IDS.loading, '');
  if (isWorking(state)) {
    const reply = Object.freeze({
      id: dialogueKey(state),
      text: '',
      streaming: true,
      whole: false,
    });
    return Object.freeze({ reply, thinking: true });
  }
  const { saying, opened } = memory;
  if (saying?.brief && saying.messageId) return briefSay(saying.brief, saying.messageId, opened);
  return replySay(state, typed, memory);
}

// ── The status bar's counters ────────────────────────────────────────────────────────────────

/** The Board's In progress count, as its pill counts it: the top-level tickets in that column. */
export function questCount(tickets: readonly BoardTicket[]): number {
  return filterTickets(topLevelTickets(tickets), 'in_progress').length;
}

export type CounterSources = {
  /** useNeedsYou's total once it has answered; null before. */
  readonly needs: number | null;
  /** The Board's rows once its query has answered; null before. */
  readonly board: readonly BoardTicket[] | null;
};

/** XP, ! and QUEST: XP is never known (no completion time on a Board row), the rest once served. */
export function arcadeCounters({ needs, board }: CounterSources): CounterValues {
  return Object.freeze({ xp: null, needs, quest: board === null ? null : questCount(board) });
}

// ── The D-pad ────────────────────────────────────────────────────────────────────────────────

/** What the handheld's screen shows: the chat, the Quests map (US-022m) or the bag (US-022n). */
export type HandheldScreen = 'chat' | 'quests' | 'inventory';

export type PadAction =
  /** Show this in the handheld's screen, in place (no route). */
  | { readonly kind: 'screen'; readonly screen: HandheldScreen }
  /** Back to the home (from a conversation's own route). */
  | { readonly kind: 'home'; readonly route: string }
  /** Open the header menu. */
  | { readonly kind: 'menu' }
  /** The page on screen: nothing to do. */
  | { readonly kind: 'here' };

const QUESTS: PadAction = Object.freeze({ kind: 'screen', screen: 'quests' });
const CHAT: PadAction = Object.freeze({ kind: 'screen', screen: 'chat' });
const INVENTORY: PadAction = Object.freeze({ kind: 'screen', screen: 'inventory' });
const HOME: PadAction = Object.freeze({ kind: 'home', route: routes.home });
const MENU: PadAction = Object.freeze({ kind: 'menu' });
const HERE: PadAction = Object.freeze({ kind: 'here' });

/**
 * What a D-pad target does; `pathname` is the route's (expo-router's usePathname), `screen` what
 * the handheld shows now.
 */
export function padAction(
  id: DPadId,
  pathname: string,
  screen: HandheldScreen = 'chat',
): PadAction {
  switch (id) {
    case 'quests':
      return QUESTS;
    case 'inventory':
      return INVENTORY;
    case 'menu':
      return MENU;
    case 'chat':
      if (screen !== 'chat') return CHAT;
      return pathname === routes.home ? HERE : HOME;
  }
}
