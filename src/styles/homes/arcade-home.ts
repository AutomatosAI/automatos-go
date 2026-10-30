// Arcade's home over A2's one thread (PRD-001 §4.6.1 D-ARC-6, US-022g; the design kit's
// chat/saying.ts, frame/today.tsx and frame/controls.tsx at 034fa629c), pure: what the dialogue
// window says, today's counters and where each D-pad target goes. The components only draw.
//
//   The dialogue says Auto's newest reply as HUD's transcript reads it (hud-turn.ts: plain words,
//   A2's notice for a turn that failed or stopped): '…' while a turn runs and has no words yet
//   (A2's isWorking), the kit's greeting before anything is said, 'Your move.' after a message no
//   reply came to. A reply is keyed by its turn (the chat and the index its question has among the
//   saved messages, which the live turn's `since` is), so the live reply and its saved copy are one
//   reply to the typewriter, typed once and said once. A reply typed on this screen (a live turn
//   was seen for its key) types; one already there when the chat opened shows whole and is not said
//   again (the window cannot tell a chat switch, so the home does).
//   The counters (D-ARC-6, the kit's today.tsx): ! is needs-you's total as served (useNeedsYou, the
//   header menu's number); QUEST the Board's In progress count, as its pill counts it (the top-level
//   tickets, from the query the Command Centre already makes); XP would be the tickets done today
//   in the phone's timezone, but a Board row carries no completion time (BOARD_TICKET_FIELDS has
//   created_at and updated_at only), so XP is left out (null), never guessed from updated_at. A
//   number the app has not had yet is null and left out too, never shown as 0.
//   The D-pad (D-ARC-6): ▲ Quests the Board, ▶ Inventory the Deliverables, ▼ Menu the header menu,
//   ◀ Chat the home: here already on home, else back to it. Routes only from routes.ts.
// Pure: no React, React Native, Expo or Skia.

import type { ThreadState } from '../../chat/controller/thread';
import type { StoredMessage } from '../../chat/schemas';
import { isWorking } from '../../chat/view-model';
import { filterTickets, topLevelTickets } from '../../cc/board/board';
import type { BoardTicket } from '../../cc/board/schemas';
import { routes } from '../../navigation/routes';
import type { CounterValues } from '../arcade/parts/counters';
import type { DialogueReply } from '../arcade/parts/dialogue';
import type { DPadId } from '../arcade/parts/pad-grid';
import { ARCADE_HOME_COPY } from '../strings';
import { hudTurn } from './hud-turn';

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
};

function line(id: string, text: string): DialogueSay {
  return Object.freeze({
    reply: Object.freeze({ id, text, streaming: false, whole: true }),
    thinking: false,
  });
}

/** What the dialogue window says now; `typed` is withTyped's memory for this screen. */
export function dialogueSay(state: ThreadState, typed: ReadonlySet<string>): DialogueSay {
  if (state.status === 'loading') return line(LINE_IDS.loading, '');
  const id = dialogueKey(state);
  if (isWorking(state)) {
    const reply = Object.freeze({ id, text: '', streaming: true, whole: false });
    return Object.freeze({ reply, thinking: true });
  }
  const turn = hudTurn(state);
  if (turn.auto !== null) {
    const whole = state.live === null && !typed.has(id);
    const reply = Object.freeze({ id, text: turn.auto, streaming: turn.streaming, whole });
    return Object.freeze({ reply, thinking: false });
  }
  const said = ARCADE_HOME_COPY;
  return turn.you === null
    ? line(LINE_IDS.greeting, said.greeting)
    : line(LINE_IDS.yourMove, said.yourMove);
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

export type PadAction =
  /** Push this screen. */
  | { readonly kind: 'go'; readonly route: string }
  /** Back to the home (from a conversation's own route). */
  | { readonly kind: 'home'; readonly route: string }
  /** Open the header menu. */
  | { readonly kind: 'menu' }
  /** The page on screen: nothing to do. */
  | { readonly kind: 'here' };

const QUESTS: PadAction = Object.freeze({ kind: 'go', route: routes.cc.board });
const INVENTORY: PadAction = Object.freeze({ kind: 'go', route: routes.cc.deliverables });
const HOME: PadAction = Object.freeze({ kind: 'home', route: routes.home });
const MENU: PadAction = Object.freeze({ kind: 'menu' });
const HERE: PadAction = Object.freeze({ kind: 'here' });

/** What a D-pad target does; `pathname` is the screen's (expo-router's usePathname). */
export function padAction(id: DPadId, pathname: string): PadAction {
  switch (id) {
    case 'quests':
      return QUESTS;
    case 'inventory':
      return INVENTORY;
    case 'menu':
      return MENU;
    case 'chat':
      return pathname === routes.home ? HERE : HOME;
  }
}
