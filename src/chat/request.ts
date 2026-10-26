// The body of POST /api/chat (digest line 7; automatos-ai orchestrator/api/chat.py ChatRequest),
// built as the web's hooks.ts and multimodal-input.tsx build it: the file parts first, then the
// text; the attachment ids also listed on the message (chat.py _with_attachments reads both);
// selectedVisibilityType 'private'; the page context as references only (services/page_context.py
// keeps page, route and selected). A draft sends no id: the server creates the chat and the chat-id
// frame names it. Plan and mission mode are never sent (D30): the strict schema refuses both.
// spokenMode (A6 quick-ask, chat_models.py ChatRequest.spokenMode): the reply is heard, so Auto
// answers in short spoken sentences; sent only as true, and a typed turn's body never carries it.

import { z } from 'zod';

import { CHAT_ROUTE } from '../core/web/lib/discussion';
import { attachmentIdsOf, filePartOf } from './attachments/attachments';

/** The page key the server's page manifest gives the web's /chat. */
export const CHAT_PAGE = 'chat';
/** services/page_context.py _MAX_STR: a longer reference is cut by the server. */
const MAX_CONTEXT_CHARS = 128;

const ContextString = z.string().trim().min(1).max(MAX_CONTEXT_CHARS);

const TextPartSchema = z.object({ type: z.literal('text'), text: z.string().min(1) }).strict();

const FilePartSchema = z
  .object({
    type: z.literal('file'),
    filename: z.string().min(1),
    mediaType: z.string().min(1),
    url: z.string().min(1).optional(),
    attachment_id: z.string().min(1),
  })
  .strict();

export const ChatRequestSchema = z
  .object({
    id: z.string().min(1).optional(),
    message: z
      .object({
        role: z.literal('user'),
        parts: z.array(z.union([TextPartSchema, FilePartSchema])).min(1),
        attachment_ids: z.array(z.string().min(1)).min(1).optional(),
      })
      .strict(),
    selectedVisibilityType: z.literal('private'),
    context: z
      .object({
        page: z.literal(CHAT_PAGE),
        route: ContextString.startsWith('/'),
        selected: z.object({ type: ContextString, id: ContextString }).strict().optional(),
      })
      .strict(),
    spokenMode: z.literal(true).optional(),
  })
  .strict();

export type ChatRequestBody = Readonly<z.output<typeof ChatRequestSchema>>;

/** An uploaded attachment (POST /api/attachments) going out with the message. */
export type ChatFile = {
  readonly filename: string;
  readonly mediaType: string;
  readonly attachmentId: string;
  readonly url?: string;
};

/** What the page selects: a ticket or a Mission while a discussion is open (lib/discussion.ts). */
export type ChatSelection = { readonly type: string; readonly id: string };

export type ChatRequestInput = {
  /** The live chat's id; null or absent for a draft. */
  readonly chatId?: string | null;
  readonly text: string;
  readonly files?: readonly ChatFile[];
  readonly context?: { readonly route?: string; readonly selected?: ChatSelection | null };
  /** Quick-ask's turn (A6): sent as spokenMode true; false or absent leaves the key out. */
  readonly spokenMode?: boolean;
};

function issueSummary(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.code}`).join('; ');
}

function messageOf(text: string, files: readonly ChatFile[]) {
  const trimmed = text.trim();
  const textPart = trimmed ? [{ type: 'text' as const, text: trimmed }] : [];
  const parts = [...files.map(filePartOf), ...textPart];
  const ids = attachmentIdsOf(files);
  return { role: 'user' as const, parts, ...(ids.length > 0 ? { attachment_ids: ids } : {}) };
}

/**
 * The ChatRequest body: the text trimmed and left out when blank (a message of files only), the
 * route the web's /chat unless the caller names another. Input the composer should never produce
 * (nothing to send, an empty id) is a programming error and throws a TypeError before anything is
 * sent.
 */
export function buildChatRequest(input: ChatRequestInput): ChatRequestBody {
  const selected = input.context?.selected;
  const result = ChatRequestSchema.safeParse({
    ...(input.chatId ? { id: input.chatId } : {}),
    message: messageOf(input.text, input.files ?? []),
    selectedVisibilityType: 'private',
    context: {
      page: CHAT_PAGE,
      route: input.context?.route ?? CHAT_ROUTE,
      ...(selected ? { selected: { type: selected.type, id: selected.id } } : {}),
    },
    ...(input.spokenMode === true ? { spokenMode: true } : {}),
  });
  if (!result.success) {
    throw new TypeError(`Not a chat request the server takes (${issueSummary(result.error)})`);
  }
  return result.data;
}
