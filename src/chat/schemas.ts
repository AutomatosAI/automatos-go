// The chat's wire schemas (D-ONE-CLIENT, §4.11): what GET /api/chat/{id}, /messages, /history and
// /agents answer, and what each of Auto's card actions answers. Shapes from automatos-ai (pin):
// orchestrator/api/chat.py (history 458-484, agents 686-713, one chat 721-751, messages 755-789),
// api/missions.py _run_to_response and api/approval_grants.py ({grant: …}). zod drops every field
// not named here, so only what the chat shows is kept (D-CACHE); a list item this version cannot
// read (a newer part type, a row without an id) is left out and the rest of the list still renders.

import { z } from 'zod';

import type { Receipt, TaskCardData } from '../core/web/types';
import { logger } from '../lib/logger';

const Text = z.string().nullable().catch(null);
const Words = z.string().catch('');
const Id = z.string().min(1);

/** An optional field that is dropped, not fatal, when it has the wrong type. */
function maybe<T extends z.ZodTypeAny>(schema: T) {
  return schema.optional().catch(undefined);
}

/** The items that parse; the rest are left out with a debug line (never their content). */
function kept<S extends z.ZodTypeAny>(item: S, what: string) {
  return (items: readonly unknown[]): z.output<S>[] =>
    items.flatMap((value) => {
      const parsed = item.safeParse(value);
      if (parsed.success) return [parsed.data as z.output<S>];
      logger.debug(`[chat] left out a ${what} this version cannot read`);
      return [];
    });
}

/** A list inside a record: missing or malformed reads as empty. */
function nestedList<S extends z.ZodTypeAny>(item: S, what: string) {
  return z.array(z.unknown()).catch([]).transform(kept(item, what));
}

/** A list that is the whole answer: anything but a list is the client's invalid_response. */
function list<S extends z.ZodTypeAny>(item: S, what: string) {
  return z.array(z.unknown()).transform(kept(item, what));
}

export const RECEIPT_STATUSES = ['done', 'refused', 'skipped', 'waiting'] as const;

/**
 * One call of a turn as the platform recorded it (consumers/chatbot/receipts.py receipt()). An
 * unknown kind reads as 'read': only a done write is said to have moved the board.
 */
export const ReceiptSchema: z.ZodType<Receipt, z.ZodTypeDef, unknown> = z.object({
  action: z.string(),
  kind: z.enum(['read', 'write']).catch('read'),
  status: z.enum(RECEIPT_STATUSES),
  subject: Words,
  effect: Words,
  link: Text,
  reason: Text,
});

/** A ticket card saved with a reply (PRD-239 S2), as src/core/ai-sdk-stream.ts reads it live. */
export const TaskCardSchema: z.ZodType<TaskCardData, z.ZodTypeDef, unknown> = z.object({
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

/**
 * The parts a saved message carries (digest line 17). Only the text part is the answer. A file part
 * is the request's own part as sent (api/chat.py saves part.dict()): its url is usually null, read
 * as ''. Any other part type is left out.
 */
export const MessagePartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('reasoning'), reasoning: z.string() }),
  z.object({ type: z.literal('narration'), narration: z.string() }),
  z.object({ type: z.literal('receipts'), receipts: nestedList(ReceiptSchema, 'receipt') }),
  z.object({ type: z.literal('task_card'), card: TaskCardSchema }),
  z.object({
    type: z.literal('file'),
    filename: Words,
    mediaType: Words,
    url: Words,
    attachment_id: Text,
  }),
]);

export type MessagePart = z.output<typeof MessagePartSchema>;

/** api/attachments.py AttachmentMetadata, as a message's attachments column keeps it. */
export const StoredAttachmentSchema = z.object({
  attachment_id: Id,
  filename: Words,
  mime: Words,
  media_type: Words,
});

export const MESSAGE_ROLES = ['user', 'assistant'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

/**
 * One saved message (GET /api/chat/{id}/messages). source.origin 'turn_error' is a saved failure
 * and source.code its turn error code (consumers/chatbot/service.py _persist_turn_error): the
 * thread shows the kit's words for the code, never the saved text (D-NO-BILLING).
 */
export const StoredMessageSchema = z.object({
  id: Id,
  role: z.enum(MESSAGE_ROLES),
  parts: nestedList(MessagePartSchema, 'message part'),
  attachments: nestedList(StoredAttachmentSchema, 'attachment'),
  source: z
    .object({ label: Text, origin: Text, code: Text.optional().catch(null) })
    .nullable()
    .catch(null),
  createdAt: Text,
});

export const StoredMessagesSchema = list(StoredMessageSchema, 'message');

export type StoredMessage = Readonly<z.output<typeof StoredMessageSchema>>;

/** 'auto' is the thread where Auto speaks unprompted (PRD-205); anything else is the user's. */
export const CHAT_KINDS = ['user', 'auto'] as const;
export type ChatKind = (typeof CHAT_KINDS)[number];
const Kind = z.enum(CHAT_KINDS).catch('user');

/** One chat (GET /api/chat/{id}). A server before PRD-237 S7 sends no turnInFlight: not working. */
export const ChatThreadSchema = z.object({
  id: Id,
  title: Text,
  createdAt: Text,
  updatedAt: Text,
  kind: Kind,
  turnInFlight: z.boolean().catch(false),
});

export type ChatThread = Readonly<z.output<typeof ChatThreadSchema>>;

/** One row of GET /api/chat/history; lastMessagePreview is at most 80 characters. */
export const HistoryRowSchema = z.object({
  id: Id,
  title: Text,
  createdAt: Text,
  updatedAt: Text,
  lastMessagePreview: Text,
  kind: Kind,
});

export const HistorySchema = list(HistoryRowSchema, 'history row');

export type HistoryRow = Readonly<z.output<typeof HistoryRowSchema>>;

/** An agent that can answer in chat (GET /api/chat/agents); its config and skills are dropped. */
export const ChatAgentSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  agent_type: Text,
  description: Text,
  is_default: z.boolean().catch(false),
});

export const ChatAgentsSchema = z.object({ agents: list(ChatAgentSchema, 'agent') });

export type ChatAgent = Readonly<z.output<typeof ChatAgentSchema>>;

/** POST /api/chat/{id}/cancel: false when no turn was running. */
export const CancelResultSchema = z.object({ cancelled: z.boolean().catch(false) });

export type CancelResult = Readonly<z.output<typeof CancelResultSchema>>;

/** POST /api/missions, …/approve and …/reject all answer the run (_run_to_response). */
export const MissionRunSchema = z.object({ id: Id, goal: Words, state: Text });

export type MissionRun = Readonly<z.output<typeof MissionRunSchema>>;

/** POST /api/v1/approval-grants/{id}/grant and /deny answer {grant: ApprovalGrant.to_dict()}. */
export const GrantResultSchema = z.object({
  grant: z.object({ id: z.number().int(), status: z.string() }),
});

export type GrantResult = Readonly<z.output<typeof GrantResultSchema>>;
