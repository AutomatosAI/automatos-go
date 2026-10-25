// The chat's frames as Auto's events (D37: the same rules as the web), pure. Behaviour reference:
// automatos-ai frontend/lib/mascot/data-events.ts @ 630fc1c85 (not vendored: it imports
// @automatos/theme-sdk at runtime). The web reads its data parts there and the words, the
// reasoning and a cap off the newest reply (core lib/mascot/events.ts); the phone's chat hands
// each line of the stream to onFrame as the foundation's Frame (src/core/ai-sdk-stream.ts), so
// every one Auto reacts to maps here: a tool's start and end (an ask is waiting, a skipped call
// no failure), the turn's receipts (their own frame, or tool-data under `receipts`), the words,
// the reasoning, a cap, the finish and a failure. As on the web, words and reasoning while a tool
// runs map to nothing (the tool's state wins, and its end settles Auto): the caller says whether
// one runs (the driver's mascot.openTools). The reducer takes a repeated text or reasoning event
// as the web's one (unchanged state), so the per-frame mapping moves Auto as the per-reply one.
// The frames are zod-checked by the parser already; anything else maps to nothing, and a frame
// the parser did not know is the vendored unknown event. A send is the composer's {type: 'send'};
// a chat that only reads its status (an awaited detached reply) uses mascotEventsFromStatus and
// mascotEventsFromReply, re-exported below, instead of the frames: one source per turn.

import type { Frame, LiveReceipts, ToolEndFrame } from '../../core/ai-sdk-stream';
import type { JsonObject, MascotEvent } from '../../core/web/lib/mascot/types';

export {
  mascotEventsFromReply,
  mascotEventsFromStatus,
  NO_REPLY,
  type ChatStatus,
  type ReplyProgress,
} from '../../core/web/lib/mascot/events';

/** The unknown frame's event: the parser keeps no type name for a frame it could not read. */
export const UNKNOWN_FRAME_TYPE = 'unknown';

function recordOf(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function toolEnd(frame: ToolEndFrame): MascotEvent {
  return {
    type: 'tool-end',
    toolCallId: frame.toolCallId,
    toolName: frame.toolName,
    success: frame.success,
    error: frame.error ?? null,
    durationMs: frame.durationMs ?? null,
    summary: frame.summary ?? null,
    skipped: frame.skipped,
    waiting: frame.waiting,
  };
}

/** The frames carry no model name; the reducer reads only the receipts' statuses. */
function receipts(live: LiveReceipts): MascotEvent {
  return { type: 'receipts', receipts: live.receipts, model: null, above: live.above ?? [] };
}

/** The words and the reasoning: nothing while a tool runs. */
function answerEvent(frame: Frame, toolRunning: boolean): MascotEvent | null {
  if (toolRunning) return null;
  if (frame.kind === 'text') return { type: 'text', text: frame.text };
  return frame.kind === 'reasoning' ? { type: 'reasoning', delta: frame.delta } : null;
}

function toolEvent(frame: Frame): MascotEvent | null {
  switch (frame.kind) {
    case 'tool-start':
      return {
        type: 'tool-start',
        toolCallId: frame.toolCallId,
        toolName: frame.toolName,
        input: recordOf(frame.input),
      };
    case 'tool-end':
      return toolEnd(frame);
    case 'receipts':
      return receipts(frame);
    case 'tool-data':
      return frame.receipts ? receipts(frame.receipts) : null;
    default:
      return null;
  }
}

function endEvent(frame: Frame): MascotEvent | null {
  switch (frame.kind) {
    case 'limit_reached':
      return { type: 'limit_reached', ...frame.limit };
    case 'finish':
      return { type: 'finish', finishReason: frame.finishReason };
    case 'error':
      return { type: 'error', message: frame.message, code: frame.code };
    case 'unknown':
      return { type: 'unknown', eventType: UNKNOWN_FRAME_TYPE };
    default:
      return null;
  }
}

/**
 * What one frame of the chat's stream means for Auto; toolRunning: one of the turn's tool calls
 * has started and not ended. The chat id, a tool's result, the narration, progress, a Mission
 * suggestion, a withdraw offer, an unreadable attachment, the usage and the agent's info map to
 * nothing, as on the web. memory-injected and workflow-update (the web's reading and working)
 * map to nothing too: the parser folds them into {kind: 'ignored'} and keeps no type to tell
 * them apart (a foundation gap, in US-017a's notes).
 */
export function mascotEventsFromFrame(frame: Frame, toolRunning = false): MascotEvent[] {
  const event = answerEvent(frame, toolRunning) ?? toolEvent(frame) ?? endEvent(frame);
  return event ? [event] : [];
}
