// The suggestions' wire shapes (PRD-268 §6.2.4, W1 ProactiveSuggestion.to_dict, US-C06): only what
// the phone draws is kept (zod drops the rest, unknown fields included): the id, Auto's title and
// detail, what Start does (proposed_action.kind), the severity, the status and the times. The
// estimated credits are never read (D8: no cost on the phone). A suggestion this version cannot read
// is left out and the rest of the list still draws; a field of the wrong type reads as absent.

import { z } from 'zod';

import { logger } from '../lib/logger';

/** What Start makes (§6.2.5): a ticket, a Mission, a playbook run, or a chat with Auto. */
export const PROPOSED_KINDS = ['board_task', 'mission', 'playbook_run', 'chat'] as const;
export type ProposedKind = (typeof PROPOSED_KINDS)[number];

export const SUGGESTION_STATUSES = ['open', 'started', 'hidden', 'expired'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

/** Why the person hid it (api/proactive.py HideReason). */
export const HIDE_REASONS = ['not_now', 'not_useful', 'wrong_agent'] as const;
export type HideReason = (typeof HIDE_REASONS)[number];

const Text = z.string().trim().min(1).nullable().catch(null);

export const SuggestionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  detail: z.string().catch(''),
  proposed_action: z
    .object({ kind: z.enum(PROPOSED_KINDS).nullable().catch(null) })
    .nullable()
    .catch(null),
  severity: z.enum(['today', 'can_wait']).nullable().catch(null),
  status: z.enum(SUGGESTION_STATUSES).catch('open'),
  created_at: Text,
  expires_at: Text,
});

export type Suggestion = Readonly<z.output<typeof SuggestionSchema>>;

/** The suggestions that parse; the rest are left out with a debug line (never their words). */
const Suggestions = z
  .array(z.unknown())
  .catch([])
  .transform((items) =>
    items.flatMap((item) => {
      const parsed = SuggestionSchema.safeParse(item);
      if (parsed.success) return [parsed.data];
      logger.debug('[suggestions] left out a suggestion this version cannot read');
      return [];
    }),
  );

/** GET /api/proactive/suggestions. */
export const SuggestionListSchema = z.object({ suggestions: Suggestions });

/** What Start made: the ticket it filed, or the chat to open. */
export const StartOpensSchema = z
  .object({
    type: z.enum(['board_task', 'chat']).nullable().catch(null),
    board_task_id: z.number().int().nullable().catch(null),
    suggestion_id: z.string().trim().min(1).nullable().catch(null),
  })
  .nullable()
  .catch(null);

/** POST …/start: the suggestion as it now is, and what to open. */
export const StartResultSchema = z.object({
  suggestion: SuggestionSchema.nullable().catch(null),
  opens: StartOpensSchema,
});

export type StartResult = Readonly<z.output<typeof StartResultSchema>>;

/** POST …/hide: the suggestion as it now is. */
export const HideResultSchema = z.object({ suggestion: SuggestionSchema.nullable().catch(null) });

/**
 * GET and PUT /api/proactive/me: the person's own settings in this workspace. Only the pause is
 * read (the quiet hours and the time zone are dropped with any unknown field); an answer without a
 * true-or-false pause does not parse, so the switch never guesses.
 */
export const MyProactiveSchema = z
  .object({ paused: z.boolean() })
  .transform((mine) => Object.freeze(mine));

export type MyProactive = z.output<typeof MyProactiveSchema>;

/** The origin a suggestion's post in the Auto thread carries (services/proactive/delivery.py). */
export const SUGGESTION_ORIGIN = 'suggestion';

/**
 * The message part a suggestion's post in the Auto thread carries after its text (PRD-268 §6.5.1,
 * §6.11.2: `[text, {type: 'suggestion@1', suggestion_id}]`). Only the id: the card is drawn from
 * the open list, so its state is the live one. A part whose id does not read keeps its place, and
 * the message's source.suggestion_id names the suggestion instead (as the web reads it).
 */
export const SuggestionPartSchema = z.object({
  type: z.literal('suggestion@1'),
  suggestion_id: z.string().trim().min(1).nullable().optional().catch(null),
});

export type SuggestionPart = Readonly<z.output<typeof SuggestionPartSchema>>;
