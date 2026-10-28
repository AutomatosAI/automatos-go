// The body of POST /api/chat (digest line 7; automatos-ai orchestrator/api/chat.py ChatRequest),
// built as the web's hooks.ts and multimodal-input.tsx build it: the file parts first, then the
// text; the attachment ids also listed on the message (chat.py _with_attachments reads both);
// selectedVisibilityType 'private'; the page context as references only (services/page_context.py
// keeps page, route and selected). A draft sends no id: the server creates the chat and the chat-id
// frame names it. Plan and mission mode are never sent (D30): the strict schema refuses both.
// spokenMode (A6 quick-ask, chat_models.py ChatRequest.spokenMode): the reply is heard, so Auto
// answers in short spoken sentences; sent only as true, and a typed turn's body never carries it.
// locale (28 Oct 2026, automatos-ai feat/chat-locale): the BCP 47 tag of the language the person
// speaks, so Auto answers in that variant (pt-BR, not Portugal's). Optional and ignored by a server
// that does not know it yet; a tag that is not BCP 47's shape is left out, never sent or thrown on.

import { z } from 'zod';

import { CHAT_ROUTE } from '../core/web/lib/discussion';
import { attachmentIdsOf, filePartOf } from './attachments/attachments';

/** The page key the server's page manifest gives the web's /chat. */
export const CHAT_PAGE = 'chat';
/** services/page_context.py _MAX_STR: a longer reference is cut by the server. */
const MAX_CONTEXT_CHARS = 128;

const ContextString = z.string().trim().min(1).max(MAX_CONTEXT_CHARS);

/** BCP 47's longest well-formed tag in practice ('zh-Hant-TW-x-private' and the like). */
const LOCALE_MAX_CHARS = 35;
/** A language subtag of letters, then subtags of letters or digits: 'pt-BR', 'en-GB', 'es-419'. */
const LOCALE_SHAPE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

export const LocaleSchema = z.string().max(LOCALE_MAX_CHARS).regex(LOCALE_SHAPE);

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
    locale: LocaleSchema.optional(),
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
  /** The language the person speaks (BCP 47, 'pt-BR'); left out when absent or not a tag. */
  readonly locale?: string;
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

/** The tag as sent: trimmed, 'pt_BR' written 'pt-BR'; null when it is not BCP 47's shape. */
export function localeTag(raw: string | null | undefined): string | null {
  const tag = raw?.trim().replace(/_/g, '-') ?? '';
  return LocaleSchema.safeParse(tag).success ? tag : null;
}

/**
 * The ChatRequest body: the text trimmed and left out when blank (a message of files only), the
 * route the web's /chat unless the caller names another. Input the composer should never produce
 * (nothing to send, an empty id) is a programming error and throws a TypeError before anything is
 * sent.
 */
export function buildChatRequest(input: ChatRequestInput): ChatRequestBody {
  const selected = input.context?.selected;
  const locale = localeTag(input.locale);
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
    ...(locale === null ? {} : { locale }),
  });
  if (!result.success) {
    throw new TypeError(`Not a chat request the server takes (${issueSummary(result.error)})`);
  }
  return result.data;
}
