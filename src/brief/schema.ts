// The brief's wire shapes (PRD-268 §6.11.2, US-C19c; the W2 kit's K11): Brief@1, the structured
// brief core posts into the person's Auto thread as a `brief@1` message part beside its text, and
// what POST /api/proactive/brief/open answers (US-C10b). Every id is a string; unknown fields are
// ignored; a row this version cannot read is left out and the rest of the section still draws. A
// row's `opens` or `action` that names a type or verb this version does not know is dropped (the
// row then has nowhere to go and draws no action), never the row. A brief of another version (v 2)
// does not parse, so the message part is left out and the text part (Auto's Read) shows as today.
// Copy is the server's, in the person's language (§6.11): the greeting, `why`, the action labels.

import { z } from 'zod';

import { DISPLAY_STATES } from '../api/row-status';
import { logger } from '../lib/logger';

/** Where a row goes (§6.11.2 BriefRow.opens.type). */
export const BRIEF_OPENS = [
  'ticket',
  'mission',
  'question',
  'chat',
  'deliverable',
  'suggestion',
  'settings',
] as const;
export type BriefOpensType = (typeof BRIEF_OPENS)[number];

/** What a row's action does (§6.11.2 BriefRow.action.verb). */
export const BRIEF_VERBS = ['start', 'answer', 'open', 'connect', 'hide'] as const;
export type BriefVerb = (typeof BRIEF_VERBS)[number];

/** The sections in the order the card draws them (§6.11.2). */
export const BRIEF_SECTIONS = ['needs_you', 'suggestions', 'today', 'since', 'unchecked'] as const;
export type BriefSectionName = (typeof BRIEF_SECTIONS)[number];

const Id = z.string().trim().min(1);
const Words = z.string().catch('');
const Count = z.number().int().nonnegative().catch(0);

function maybe<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullable().optional().catch(undefined);
}

export const BriefOpensSchema = z.object({ type: z.enum(BRIEF_OPENS), id: Id });

export const BriefActionSchema = z.object({
  verb: z.enum(BRIEF_VERBS),
  label: z.string().trim().min(1),
  done_label: maybe(z.string().trim().min(1)),
});

export const BriefRowSchema = z.object({
  id: Id,
  title: z.string().trim().min(1),
  why: Words,
  at: maybe(z.string()),
  number: maybe(z.string()),
  display_state: z.enum(DISPLAY_STATES).nullable().optional().catch(null),
  opens: maybe(BriefOpensSchema),
  action: maybe(BriefActionSchema),
});

export type BriefRow = Readonly<z.output<typeof BriefRowSchema>>;

/** The rows that parse; the rest are left out with a debug line (never their content). */
const Rows = z
  .array(z.unknown())
  .catch([])
  .transform((items) =>
    items.flatMap((item) => {
      const parsed = BriefRowSchema.safeParse(item);
      if (parsed.success) return [parsed.data];
      logger.debug('[brief] left out a row this version cannot read');
      return [];
    }),
  );

const NO_SECTIONS = Object.freeze({
  needs_you: [],
  suggestions: [],
  today: [],
  since: [],
  unchecked: [],
});
const NO_COUNTS = Object.freeze({ needs_you: 0, suggestions: 0, today: 0, since: 0 });

export const BriefSchema = z.object({
  v: z.literal(1),
  /** The person's local date (YYYY-MM-DD). */
  date: z.string(),
  /** 'Morning, Sam.' in the person's language. */
  greeting: Words,
  /** Auto's Read, unchanged: the text part's words, drawn inside the card. */
  prose: Words,
  /** The greeting and the numbered row titles, for Listen (K11); not drawn. */
  spoken: maybe(z.string()),
  sections: z
    .object({
      needs_you: Rows,
      suggestions: Rows,
      today: Rows,
      since: Rows,
      unchecked: Rows,
    })
    .catch(NO_SECTIONS),
  /** Exact even when rows fold; needs_you equals the badge when the brief was made. */
  counts: z
    .object({ needs_you: Count, suggestions: Count, today: Count, since: Count })
    .catch(NO_COUNTS),
  state_hash: Words,
  generated_at: z.string().nullable().catch(null),
});

export type Brief = Readonly<z.output<typeof BriefSchema>>;

/** The message part (§6.11.2 'Delivery as a message part'). */
export const BriefPartSchema = z.object({ type: z.literal('brief@1'), brief: BriefSchema });

const Flag = z.boolean().catch(false);

/**
 * POST /api/proactive/brief/open (US-C10b): the day's message, posted now (posted) or already
 * there; or pending while another device's claim is still building it.
 */
export const BriefOpenSchema = z.object({
  chat_id: z.string().trim().min(1).nullable().catch(null),
  message_id: z.string().trim().min(1).nullable().catch(null),
  posted: Flag,
  pending: Flag,
});

export type BriefOpen = Readonly<z.output<typeof BriefOpenSchema>>;
