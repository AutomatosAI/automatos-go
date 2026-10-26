// One chat turn folded from its frames (PRD-001 §4.3 'new in core'): turnReducer(state, frame)
// returns a NEW state and never mutates either argument. The rules are the web's (frontend
// lib/chat/hooks.ts and use-chat-with-receipts.ts), applied with the vendored helpers: narration
// leaves the answer (narration.ts), tool calls are upserted and closed when the turn ends
// (tool-calls.ts), the receipts are read as receipts.ts reads them. No React, no clock: the caller
// passes the time a frame arrived when it wants tool calls stamped.

import type {
  AgentInfo,
  AttachmentNotice,
  Frame,
  LiveReceipts,
  ToolEndFrame,
} from './ai-sdk-stream';
import type { ApprovalCard } from './web/lib/chat/approvals';
import { mergeDeliverables, type DeliverableRef } from './web/lib/chat/deliverables';
import { withoutNarration } from './web/lib/chat/narration';
import type { MissionSuggestion } from './web/lib/chat/suggestion';
import {
  completeRunningToolCalls,
  upsertTaskCard,
  upsertToolCall,
} from './web/lib/chat/tool-calls';
import type {
  AppUsage,
  LimitReached,
  Receipt,
  TaskCardData,
  ToolCall,
  WithdrawOffer,
} from './web/types';

/** The web keeps the newest six progress and narration lines on a reply (hooks.ts). */
export const PROGRESS_LINES_KEPT = 6;

/**
 * The codes a failed turn carries (consumers/chatbot/turn_errors.py; chat.py session_agent_terminal).
 * PRD-265 W1 renamed trial_exhausted to credits_exhausted; a server from before it still sends the
 * old code, so both stay.
 */
export const TURN_ERROR_CODES = [
  'rate_limited',
  'model_unavailable',
  'no_api_key',
  'runtime_mismatch',
  'trial_exhausted',
  'credits_exhausted',
  'activation_failed',
  'provider_failed',
  'turn_failed',
  'session_agent_terminal',
] as const;

export type TurnErrorCode = (typeof TURN_ERROR_CODES)[number];

/** An e: line with no code, or one this version does not know, is a turn that failed. */
export const DEFAULT_TURN_ERROR_CODE: TurnErrorCode = 'turn_failed';

export type TurnFailure = { readonly message: string; readonly code: TurnErrorCode };

export type TurnFinish = { readonly finishReason: string | null; readonly aiGenerated: boolean };

export type TurnState = {
  readonly chatId: string | null;
  /** PRD-264 EUAI-09: the chat-id or finish frame marked the reply AI-generated. */
  readonly aiGenerated: boolean;
  readonly agent: AgentInfo | null;
  /** The answer so far, narration taken out. */
  readonly text: string;
  readonly reasoning: string;
  /** Narration and progress lines, newest last, at most PROGRESS_LINES_KEPT. */
  readonly progress: readonly string[];
  readonly toolCalls: ToolCall[];
  /** The newest tool call that waits on the owner's click (drawn waiting, never failed). */
  readonly waitingToolCallId: string | null;
  readonly receipts: Receipt[] | undefined;
  readonly receiptsAbove: string[] | undefined;
  readonly taskCards: TaskCardData[];
  /** mission_approval and tool_approval cards, one per key, first seen kept. */
  readonly approvals: readonly ApprovalCard[];
  readonly deliverables: readonly DeliverableRef[];
  readonly missionSuggestion: MissionSuggestion | null;
  readonly withdrawOffer: WithdrawOffer | null;
  readonly limitReached: LimitReached | null;
  readonly attachmentsUnavailable: readonly AttachmentNotice[];
  readonly usage: AppUsage | null;
  readonly finish: TurnFinish | null;
  readonly error: TurnFailure | null;
};

export const initialTurn: TurnState = Object.freeze({
  chatId: null,
  aiGenerated: false,
  agent: null,
  text: '',
  reasoning: '',
  progress: [],
  toolCalls: [],
  waitingToolCallId: null,
  receipts: undefined,
  receiptsAbove: undefined,
  taskCards: [],
  approvals: [],
  deliverables: [],
  missionSuggestion: null,
  withdrawOffer: null,
  limitReached: null,
  attachmentsUnavailable: [],
  usage: null,
  finish: null,
  error: null,
});

type FrameOf<K extends Frame['kind']> = Extract<Frame, { kind: K }>;
type Handler<K extends Frame['kind']> = (
  state: TurnState,
  frame: FrameOf<K>,
  at?: string,
) => TurnState;
type Handlers = { readonly [K in Frame['kind']]: Handler<K> };

const KNOWN_CODES: ReadonlySet<string> = new Set(TURN_ERROR_CODES);

export function turnErrorCode(code: string | null): TurnErrorCode {
  return code !== null && KNOWN_CODES.has(code) ? (code as TurnErrorCode) : DEFAULT_TURN_ERROR_CODE;
}

function withLine(lines: readonly string[], line: string): readonly string[] {
  return [...lines.slice(-(PROGRESS_LINES_KEPT - 1)), line];
}

/** The turn is over (finish, or an e: line): nothing may keep spinning (tool-calls.ts). */
function closeToolCalls(calls: ToolCall[], at: string | undefined): ToolCall[] {
  if (at !== undefined) return completeRunningToolCalls(calls, at) ?? calls;
  if (!calls.some((call) => call.state === 'running')) return calls;
  return calls.map((call) => (call.state === 'running' ? { ...call, state: 'completed' } : call));
}

function stamped(key: 'startedAt' | 'endedAt', at: string | undefined): Partial<ToolCall> {
  return at === undefined ? {} : { [key]: at };
}

/** PRD-238 S3: a skipped call closes as done-without-running; P256-FIX-RVW-22: a waiting one as
 * waiting, never as an error (tool-calls.ts withWaitingToolCall). */
function endedCall(frame: ToolEndFrame, at: string | undefined): ToolCall {
  const done = frame.success || frame.skipped || frame.waiting;
  return {
    toolCallId: frame.toolCallId,
    toolName: frame.toolName,
    state: done ? 'completed' : 'error',
    ...(frame.error !== undefined ? { error: frame.error } : {}),
    ...(frame.durationMs !== undefined ? { durationMs: frame.durationMs } : {}),
    ...(frame.summary !== undefined ? { summary: frame.summary } : {}),
    skipped: frame.skipped,
    ...(frame.waiting ? { waiting: true } : {}),
    ...stamped('endedAt', at),
  };
}

function withApprovals(known: readonly ApprovalCard[], raised: readonly ApprovalCard[]) {
  const keys = new Set(known.map((card) => card.key));
  const fresh = raised.filter((card) => !keys.has(card.key));
  return fresh.length === 0 ? known : [...known, ...fresh];
}

function withReceipts(state: TurnState, live: LiveReceipts | undefined): TurnState {
  return live ? { ...state, receipts: live.receipts, receiptsAbove: live.above } : state;
}

function toolData(state: TurnState, frame: FrameOf<'tool-data'>): TurnState {
  const next: TurnState = {
    ...state,
    taskCards: frame.taskCard ? upsertTaskCard(state.taskCards, frame.taskCard) : state.taskCards,
    approvals: withApprovals(state.approvals, frame.approvals),
    deliverables: mergeDeliverables(state.deliverables, frame.deliverables),
  };
  return withReceipts(next, frame.receipts);
}

function narration(state: TurnState, frame: FrameOf<'narration'>): TurnState {
  return {
    ...state,
    text: withoutNarration(state.text, frame.text),
    progress: frame.retracted ? state.progress : withLine(state.progress, frame.text),
  };
}

function toolStart(state: TurnState, frame: FrameOf<'tool-start'>, at?: string): TurnState {
  const call: ToolCall = {
    toolCallId: frame.toolCallId,
    toolName: frame.toolName,
    state: 'running',
    ...(frame.input !== undefined ? { input: frame.input } : {}),
    ...stamped('startedAt', at),
  };
  return { ...state, toolCalls: upsertToolCall(state.toolCalls, call) };
}

function toolEnd(state: TurnState, frame: ToolEndFrame, at?: string): TurnState {
  return {
    ...state,
    toolCalls: upsertToolCall(state.toolCalls, endedCall(frame, at)),
    waitingToolCallId: frame.waiting ? frame.toolCallId : state.waitingToolCallId,
  };
}

function finish(state: TurnState, frame: FrameOf<'finish'>, at?: string): TurnState {
  return {
    ...state,
    toolCalls: closeToolCalls(state.toolCalls, at),
    aiGenerated: state.aiGenerated || frame.aiGenerated,
    finish: { finishReason: frame.finishReason, aiGenerated: frame.aiGenerated },
  };
}

function failed(state: TurnState, frame: FrameOf<'error'>, at?: string): TurnState {
  return {
    ...state,
    toolCalls: closeToolCalls(state.toolCalls, at),
    error: { message: frame.message, code: turnErrorCode(frame.code) },
  };
}

const unchanged = (state: TurnState): TurnState => state;

const HANDLERS: Handlers = {
  text: (state, frame) => ({ ...state, text: state.text + frame.text }),
  error: failed,
  'chat-id': (state, frame) => ({
    ...state,
    chatId: frame.chatId,
    aiGenerated: state.aiGenerated || frame.aiGenerated,
  }),
  'tool-start': toolStart,
  'tool-end': toolEnd,
  'tool-data': toolData,
  // the web reads no tool-result excerpt: a call's headline is its tool-end summary
  'tool-result': unchanged,
  reasoning: (state, frame) => ({ ...state, reasoning: state.reasoning + frame.delta }),
  narration,
  progress: (state, frame) => ({ ...state, progress: withLine(state.progress, frame.text) }),
  limit_reached: (state, frame) => ({ ...state, limitReached: frame.limit }),
  'mission-suggestion': (state, frame) => ({ ...state, missionSuggestion: frame.suggestion }),
  withdraw_offer: (state, frame) => ({ ...state, withdrawOffer: frame.offer }),
  attachment_unavailable: (state, frame) => ({
    ...state,
    attachmentsUnavailable: [...state.attachmentsUnavailable, ...frame.attachments],
  }),
  receipts: (state, frame) => withReceipts(state, frame),
  usage: (state, frame) => ({ ...state, usage: frame.usage }),
  finish,
  'agent-info': (state, frame) => ({ ...state, agent: frame.agent }),
  ignored: unchanged,
  unknown: unchanged,
};

/** The turn after `frame`; `at` is when it arrived (ISO), stamped on tool calls when given. */
export function turnReducer(state: TurnState, frame: Frame, at?: string): TurnState {
  // TypeScript cannot correlate HANDLERS[kind] with the narrowed frame; the mapped type checks each entry.
  const handle = HANDLERS[frame.kind] as Handler<Frame['kind']>;
  return handle(state, frame, at);
}
