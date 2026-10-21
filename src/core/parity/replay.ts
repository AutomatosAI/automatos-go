// Replays a corpus file the way the app reads the wire: chat chunks through pushChunk, parseLine
// and turnReducer; board-stream chunks through the vendored parseSSEFrames, the buffer carried
// across chunks. A partial line left when the body ends is dropped, as the web's reader drops
// it (frontend/lib/chat/hooks.ts:275-281), and reported as `rest`.
//
// A recorded turn is then held to what the server saved (GET /api/chat/{id}/messages), read by
// the web's own rules (vendored message-text.ts, receipts.ts): the answer, with the lines the
// receipts put above it, and the receipts; or, for a failed turn, the saved error note.

import { parseLine, pushChunk, type Frame } from '../ai-sdk-stream';
import { initialTurn, turnReducer, type TurnState } from '../turn-reducer';
import { parseSSEFrames } from '../web/hooks/use-board-event-stream';
import { messageText, savedTurnError } from '../web/lib/chat/message-text';
import { receiptsOf } from '../web/lib/chat/receipts';
import type { ChatMessage, Receipt } from '../web/types';
import type { PersistedMessage } from './corpus';

/** consumers/chatbot/receipts.py with_lines_above: the lines above, then the answer. */
const ABOVE_SEPARATOR = '\n\n';
const ASSISTANT = 'assistant';

export type SseEvent = ReturnType<typeof parseSSEFrames>['events'][number];

export type TurnReplay = {
  readonly frames: readonly Frame[];
  readonly turn: TurnState;
  readonly rest: string;
};

export type SseReplay = { readonly events: readonly SseEvent[]; readonly rest: string };

/** What a turn left in the conversation: its answer and receipts, or the error it failed with. */
export type TurnOutcome =
  | {
      readonly outcome: 'answer';
      readonly answer: string;
      readonly receipts: readonly Receipt[] | undefined;
    }
  | { readonly outcome: 'failed'; readonly message: string };

const EMPTY_TURN: TurnReplay = { frames: [], turn: initialTurn, rest: '' };
const EMPTY_SSE: SseReplay = { events: [], rest: '' };

function foldFrames(turn: TurnState, frames: readonly Frame[]): TurnState {
  // a wrapper, so reduce's index never reaches turnReducer's `at`
  return frames.reduce((state, frame) => turnReducer(state, frame), turn);
}

/** The chunks of one POST /api/chat body, as the app reads them. */
export function replayTurn(chunks: readonly string[]): TurnReplay {
  return chunks.reduce<TurnReplay>((replay, chunk) => {
    const { lines, rest } = pushChunk(replay.rest, chunk);
    const frames = lines.map(parseLine);
    return { frames: [...replay.frames, ...frames], turn: foldFrames(replay.turn, frames), rest };
  }, EMPTY_TURN);
}

/** The chunks of one GET /api/v1/tasks/stream body, as the app reads them. */
export function replaySse(chunks: readonly string[]): SseReplay {
  return chunks.reduce<SseReplay>((replay, chunk) => {
    const { events, rest } = parseSSEFrames(replay.rest + chunk);
    return { events: [...replay.events, ...events], rest };
  }, EMPTY_SSE);
}

/** The answer as the server saves it: the receipts' lines above, then the streamed text. */
export function withLinesAbove(text: string, above: readonly string[] | undefined): string {
  return above && above.length > 0 ? [...above, text].join(ABOVE_SEPARATOR) : text;
}

/** What the replayed turn says the server saved. */
export function liveOutcome(turn: TurnState): TurnOutcome {
  if (turn.error) return { outcome: 'failed', message: turn.error.message.trim() };
  return {
    outcome: 'answer',
    answer: withLinesAbove(turn.text, turn.receiptsAbove),
    receipts: turn.receipts,
  };
}

/** The newest reply the server saved, as the web reads a stored row (lib/chat/api.ts:57-70). */
export function persistedReply(rows: readonly PersistedMessage[]): ChatMessage | null {
  const reply = rows.filter((row) => row.role === ASSISTANT).at(-1);
  // the web hands these rows to its readers as ChatMessage unchanged
  return reply ? (reply as unknown as ChatMessage) : null;
}

/** What the server saved for the turn: a failed turn is its error note (service.py:3009-3019). */
export function savedOutcome(reply: ChatMessage): TurnOutcome {
  const failed = savedTurnError(reply);
  if (failed !== null) return { outcome: 'failed', message: failed };
  return { outcome: 'answer', answer: messageText(reply), receipts: receiptsOf(reply) };
}
