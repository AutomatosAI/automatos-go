// The chat wire format (PRD-001 §4.3 'new in core'): POST /api/chat answers text/plain lines in
// the AI SDK v1 data stream — `0:<JSON string>` text deltas, `d:<JSON object with "type">` data
// frames, `e:<JSON {message, code?}>` errors (automatos-ai consumers/chatbot/streaming.py:37-50).
// The branch logic is ported from the web's reader (frontend/lib/chat/hooks.ts:280-560), not its
// React state; the backend emits no `data:` SSE lines or 'done' type, so that legacy branch is not
// ported. Every frame comes off the wire: each type is checked with zod, unknown fields are
// dropped, and anything this version does not know is {kind: 'unknown'}. parseLine never throws.

import { z } from 'zod';

import { approvalsInPart, type ApprovalCard } from './web/lib/chat/approvals';
import { deliverablesInPart, type DeliverableRef } from './web/lib/chat/deliverables';
import { parseErrorFrame } from './web/lib/chat/errors';
import { liveReceipts, liveReceiptsFromToolData } from './web/lib/chat/receipts';
import { suggestionFromData, type MissionSuggestion } from './web/lib/chat/suggestion';
import type { AppUsage, LimitReached, Receipt, TaskCardData, WithdrawOffer } from './web/types';

const TEXT_PREFIX = '0:';
const DATA_PREFIX = 'd:';
const ERROR_PREFIX = 'e:';
const PREFIX_LENGTH = 2;
const NEWLINE = '\n';

/** The answering agent, from an agent-info frame in its correct shape. */
export type AgentInfo = {
  readonly id: number | string | null;
  readonly name: string | null;
  readonly isCto: boolean;
};

/** One file the turn could not read (modules/context/service.py attachment_failures). */
export type AttachmentNotice = {
  readonly attachmentId: string | null;
  readonly filename: string | null;
};

/** The live receipts a receipts frame (or tool-data under `receipts`) carries. */
export type LiveReceipts = { readonly receipts: Receipt[]; readonly above?: string[] };

export type Frame =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'error'; readonly message: string; readonly code: string | null }
  | { readonly kind: 'chat-id'; readonly chatId: string; readonly aiGenerated: boolean }
  | {
      readonly kind: 'tool-start';
      readonly toolCallId: string;
      readonly toolName: string;
      readonly input?: unknown;
    }
  | ToolEndFrame
  | ToolDataFrame
  | {
      readonly kind: 'tool-result';
      readonly toolCallId: string;
      readonly toolName: string;
      readonly result: string;
    }
  | { readonly kind: 'reasoning'; readonly delta: string }
  | { readonly kind: 'narration'; readonly text: string; readonly retracted: boolean }
  | { readonly kind: 'progress'; readonly text: string }
  | { readonly kind: 'limit_reached'; readonly limit: LimitReached }
  | { readonly kind: 'mission-suggestion'; readonly suggestion: MissionSuggestion }
  | { readonly kind: 'withdraw_offer'; readonly offer: WithdrawOffer }
  | { readonly kind: 'attachment_unavailable'; readonly attachments: readonly AttachmentNotice[] }
  | ({ readonly kind: 'receipts' } & LiveReceipts)
  | { readonly kind: 'usage'; readonly usage: AppUsage }
  | { readonly kind: 'finish'; readonly finishReason: string | null; readonly aiGenerated: boolean }
  | { readonly kind: 'agent-info'; readonly agent: AgentInfo }
  /** A frame the catalogue knows and the app has no use for (memory-*, workflow-update). */
  | { readonly kind: 'ignored' }
  | { readonly kind: 'unknown' };

export type ToolEndFrame = {
  readonly kind: 'tool-end';
  readonly toolCallId: string;
  readonly toolName: string;
  readonly success: boolean;
  readonly error?: string;
  readonly durationMs?: number;
  readonly summary?: string;
  readonly skipped: boolean;
  /** P256-FIX-RVW-22: an ask for the owner's click (success stays false) — waiting, not failed. */
  readonly waiting: boolean;
};

/** tool-data: only the keys the app acts on; every other key (documents, emails, …) is dropped. */
export type ToolDataFrame = {
  readonly kind: 'tool-data';
  readonly taskCard?: TaskCardData;
  readonly approvals: readonly ApprovalCard[];
  readonly deliverables: readonly DeliverableRef[];
  readonly receipts?: LiveReceipts;
};

export const UNKNOWN_FRAME: Frame = Object.freeze({ kind: 'unknown' });
const IGNORED_FRAME: Frame = Object.freeze({ kind: 'ignored' });
const IGNORED_TYPES: ReadonlySet<string> = new Set([
  'memory-injected',
  'memory-stored',
  'workflow-update',
]);
const UNNAMED_TOOL = 'tool';

/** An optional field that is dropped, not fatal, when it has the wrong type. */
function maybe<T extends z.ZodTypeAny>(schema: T) {
  return schema.optional().catch(undefined);
}

const record = z.record(z.unknown());
const id = z.string().min(1);
const dataOf = <T extends z.ZodRawShape>(shape: T) => z.object({ data: z.object(shape) });

const ChatIdSchema = z.object({ chatId: id, ai_generated: maybe(z.boolean()) });
const ToolStartSchema = dataOf({ toolCallId: id, toolName: maybe(z.string()), input: z.unknown() });
const ToolEndSchema = dataOf({
  toolCallId: id,
  toolName: maybe(z.string()),
  success: maybe(z.boolean()),
  error: maybe(z.string()),
  durationMs: maybe(z.number()),
  summary: maybe(z.string()),
  skipped: maybe(z.boolean()),
  waiting: maybe(z.boolean()),
});
const ToolResultSchema = dataOf({
  toolCallId: id,
  toolName: maybe(z.string()),
  result: z.string(),
});
const DeltaSchema = dataOf({ delta: z.string() });
const NarrationSchema = dataOf({ text: z.string(), retracted: maybe(z.boolean()) });
const ProgressSchema = dataOf({ text: z.string() });
const LimitSchema = dataOf({
  limit: z.string().catch(''),
  value: z.number().catch(0),
  message: z.string().min(1),
});
const WithdrawSchema = dataOf({ message: z.string().catch(''), requests: z.array(z.unknown()) });
const WithdrawRequestSchema = z.object({
  grant_id: z.number().int(),
  action: maybe(z.string().nullable()),
  reason: maybe(z.string().nullable()),
});
const AttachmentsSchema = dataOf({ attachments: z.array(z.unknown()) });
const AttachmentSchema = z.object({
  attachment_id: maybe(z.string()),
  filename: maybe(z.string().nullable()),
});
const UsageSchema = dataOf({
  promptTokens: z.number().catch(0),
  completionTokens: z.number().catch(0),
  totalTokens: z.number().catch(0),
});
const FinishSchema = z.object({
  finishReason: maybe(z.string()),
  ai_generated: maybe(z.boolean()),
});
const AgentInfoSchema = z.object({
  agent: z.object({
    id: maybe(z.union([z.number(), z.string()])),
    name: maybe(z.string()),
    is_cto: maybe(z.boolean()),
  }),
});
const RecordDataSchema = z.object({ data: record });
const TaskCardSchema = z.object({
  id: z.number().int(),
  number: maybe(z.string().nullable()),
  title: z.string(),
  status: z.string(),
  assigned_agent: z.string(),
  runtime: maybe(z.string().nullable()),
  last_tool: maybe(z.string().nullable()),
  files_touched: maybe(z.number()),
  exit_reason: maybe(z.string().nullable()),
  denials: maybe(z.number()),
  started_at: maybe(z.string().nullable()),
  completed_at: maybe(z.string().nullable()),
});

type Envelope = Readonly<Record<string, unknown>> & { readonly type: string };
type FrameBuilder = (envelope: Envelope) => Frame | null;

function parsed<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> | null {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

function chatIdFrame(envelope: Envelope): Frame | null {
  const frame = parsed(ChatIdSchema, envelope);
  return (
    frame && { kind: 'chat-id', chatId: frame.chatId, aiGenerated: frame.ai_generated === true }
  );
}

function toolStartFrame(envelope: Envelope): Frame | null {
  const data = parsed(ToolStartSchema, envelope)?.data ?? null;
  if (!data) return null;
  const toolName = data.toolName || UNNAMED_TOOL;
  return data.input === undefined
    ? { kind: 'tool-start', toolCallId: data.toolCallId, toolName }
    : { kind: 'tool-start', toolCallId: data.toolCallId, toolName, input: data.input };
}

function toolEndFrame(envelope: Envelope): Frame | null {
  const data = parsed(ToolEndSchema, envelope)?.data ?? null;
  if (!data) return null;
  return {
    kind: 'tool-end',
    toolCallId: data.toolCallId,
    toolName: data.toolName || UNNAMED_TOOL,
    success: data.success === true,
    ...(data.error ? { error: data.error } : {}),
    ...(data.durationMs !== undefined ? { durationMs: data.durationMs } : {}),
    ...(data.summary ? { summary: data.summary } : {}),
    skipped: data.skipped === true,
    waiting: data.waiting === true,
  };
}

/** The keys acted on, read by the web's own rules (approvals.ts, deliverables.ts, receipts.ts). */
function toolDataFrame(envelope: Envelope): Frame | null {
  const data = parsed(RecordDataSchema, envelope)?.data ?? null;
  if (!data) return null;
  const part = { type: 'tool-data', data };
  const taskCard = parsed(TaskCardSchema, data.task_card) ?? undefined;
  const live = liveReceiptsFromToolData(part);
  return {
    kind: 'tool-data',
    ...(taskCard ? { taskCard } : {}),
    approvals: approvalsInPart(part),
    deliverables: deliverablesInPart(part),
    ...(live?.receipts ? { receipts: receiptsOf(live.receipts, live.receiptsAbove) } : {}),
  };
}

function receiptsOf(receipts: Receipt[], above: string[] | undefined): LiveReceipts {
  return above ? { receipts, above } : { receipts };
}

function toolResultFrame(envelope: Envelope): Frame | null {
  const data = parsed(ToolResultSchema, envelope)?.data ?? null;
  return data && { kind: 'tool-result', ...data, toolName: data.toolName || UNNAMED_TOOL };
}

function reasoningFrame(envelope: Envelope): Frame | null {
  const data = parsed(DeltaSchema, envelope)?.data ?? null;
  return data && { kind: 'reasoning', delta: data.delta };
}

function narrationFrame(envelope: Envelope): Frame | null {
  const data = parsed(NarrationSchema, envelope)?.data ?? null;
  return data && { kind: 'narration', text: data.text, retracted: data.retracted === true };
}

function progressFrame(envelope: Envelope): Frame | null {
  const data = parsed(ProgressSchema, envelope)?.data ?? null;
  return data && { kind: 'progress', text: data.text };
}

function limitFrame(envelope: Envelope): Frame | null {
  const data = parsed(LimitSchema, envelope)?.data ?? null;
  return data && { kind: 'limit_reached', limit: data };
}

function suggestionFrame(envelope: Envelope): Frame | null {
  const suggestion = suggestionFromData(envelope);
  return suggestion && { kind: 'mission-suggestion', suggestion };
}

function withdrawFrame(envelope: Envelope): Frame | null {
  const data = parsed(WithdrawSchema, envelope)?.data ?? null;
  const requests = (data?.requests ?? []).flatMap(
    (item) => parsed(WithdrawRequestSchema, item) ?? [],
  );
  if (!data || requests.length === 0) return null;
  return { kind: 'withdraw_offer', offer: { message: data.message, requests } };
}

function attachmentsFrame(envelope: Envelope): Frame | null {
  const data = parsed(AttachmentsSchema, envelope)?.data ?? null;
  if (!data) return null;
  const attachments = data.attachments.flatMap((item) => {
    const failure = parsed(AttachmentSchema, item);
    return failure
      ? [{ attachmentId: failure.attachment_id ?? null, filename: failure.filename ?? null }]
      : [];
  });
  return { kind: 'attachment_unavailable', attachments };
}

function receiptsFrame(envelope: Envelope): Frame | null {
  const data = parsed(RecordDataSchema, envelope)?.data ?? null;
  const live = data ? liveReceipts(data) : null;
  return live?.receipts
    ? { kind: 'receipts', ...receiptsOf(live.receipts, live.receiptsAbove) }
    : null;
}

function usageFrame(envelope: Envelope): Frame | null {
  const data = parsed(UsageSchema, envelope)?.data ?? null;
  return data && { kind: 'usage', usage: data };
}

function finishFrame(envelope: Envelope): Frame | null {
  const frame = parsed(FinishSchema, envelope);
  return (
    frame && {
      kind: 'finish',
      finishReason: frame.finishReason ?? null,
      aiGenerated: frame.ai_generated === true,
    }
  );
}

/** The correct shape only: today's `{type: {type: 'agent-info', …}}` has no string type and is unknown. */
function agentInfoFrame(envelope: Envelope): Frame | null {
  const agent = parsed(AgentInfoSchema, envelope)?.agent;
  if (!agent) return null;
  return {
    kind: 'agent-info',
    agent: { id: agent.id ?? null, name: agent.name ?? null, isCto: agent.is_cto === true },
  };
}

/** A Map, not an object literal: a frame typed "constructor" or "__proto__" must find nothing. */
const DATA_FRAMES: ReadonlyMap<string, FrameBuilder> = new Map<string, FrameBuilder>([
  ['chat-id', chatIdFrame],
  ['tool-start', toolStartFrame],
  ['tool-end', toolEndFrame],
  ['tool-data', toolDataFrame],
  ['tool-result', toolResultFrame],
  ['reasoning', reasoningFrame],
  ['narration', narrationFrame],
  ['progress', progressFrame],
  ['limit_reached', limitFrame],
  ['mission-suggestion', suggestionFrame],
  ['withdraw_offer', withdrawFrame],
  ['attachment_unavailable', attachmentsFrame],
  ['receipts', receiptsFrame],
  ['usage', usageFrame],
  ['finish', finishFrame],
  ['agent-info', agentInfoFrame],
]);

function jsonOf(text: string): { readonly value: unknown } | null {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return null; // malformed JSON is an unknown frame, by contract
  }
}

function envelopeOf(value: unknown): Envelope | null {
  const fields = parsed(record, value);
  return fields && typeof fields.type === 'string' ? (fields as Envelope) : null;
}

function textFrame(body: string): Frame {
  const json = jsonOf(body);
  return json && typeof json.value === 'string'
    ? { kind: 'text', text: json.value }
    : UNKNOWN_FRAME;
}

function dataFrame(body: string): Frame {
  const json = jsonOf(body);
  const envelope = json ? envelopeOf(json.value) : null;
  if (!envelope) return UNKNOWN_FRAME;
  if (IGNORED_TYPES.has(envelope.type)) return IGNORED_FRAME;
  return DATA_FRAMES.get(envelope.type)?.(envelope) ?? UNKNOWN_FRAME;
}

/** An e: line, read by the web's rule (errors.ts): a {message, code} object, or a bare string. */
function errorFrame(body: string): Frame {
  const { message, code } = parseErrorFrame(body);
  return { kind: 'error', message, code: code ?? null };
}

/** The complete lines in `buffer + chunk` and the partial tail to keep; blank lines are dropped. */
export function pushChunk(buffer: string, chunk: string): { lines: string[]; rest: string } {
  const pieces = (buffer + chunk).split(NEWLINE);
  const rest = pieces[pieces.length - 1] ?? '';
  const lines = pieces.slice(0, -1).filter((line) => line.trim() !== '');
  return { lines, rest };
}

/** One line of the stream as a frame; anything unreadable is {kind: 'unknown'}. Never throws. */
export function parseLine(line: string): Frame {
  const body = line.slice(PREFIX_LENGTH);
  if (line.startsWith(TEXT_PREFIX)) return textFrame(body);
  if (line.startsWith(DATA_PREFIX)) return dataFrame(body);
  if (line.startsWith(ERROR_PREFIX)) return errorFrame(body);
  return UNKNOWN_FRAME;
}
