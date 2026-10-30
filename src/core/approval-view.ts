// ApprovalView@1 (PRD-268 §6.11.4, the W2 kit's US-C20a and K10): the exact action an approval card
// asks for and the rule that asked, which core W2 adds to the tool_approval and mission_approval
// payloads (and answers on GET /api/v1/approval-grants/{grant_id}/view). Pure, no React: the stream
// reads it beside the vendored approvals.ts, which drops every field it does not know. Every field is
// checked; an id that is not one, a missing rule or a missing action drops the view (never the
// card, which then draws exactly as today). Unknown fields are ignored; an answer this version does
// not know is left out. The preview is the card's redacted digest, drawn as text only.

import { z } from 'zod';

import type { ApprovalCard } from './web/lib/chat/approvals';

export const APPROVAL_ANSWERS = ['refuse', 'allow_once', 'always_allow'] as const;
export type ApprovalAnswer = (typeof APPROVAL_ANSWERS)[number];

export const PREVIEW_KINDS = ['text', 'markdown', 'diff'] as const;

const Words = z.string().trim().min(1);

function maybe<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullable().optional().catch(undefined);
}

const Answers = z
  .array(z.unknown())
  .catch([])
  .transform((items) =>
    items.filter((item): item is ApprovalAnswer =>
      (APPROVAL_ANSWERS as readonly unknown[]).includes(item),
    ),
  );

export const ApprovalViewSchema = z.object({
  // a grant's row id; a Mission plan's view may name its own id: any id, as a string
  grant_id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1)),
  asked_by: z.object({ kind: z.enum(['auto', 'agent']).catch('auto'), name: Words }),
  action: z.object({ verb: z.string().catch(''), summary: Words }),
  target: maybe(z.object({ label: Words, detail: maybe(Words) })),
  preview: maybe(z.object({ kind: z.enum(PREVIEW_KINDS).catch('text'), body: Words })),
  rule: z.object({ id: z.string().catch(''), sentence: Words }),
  answers: Answers,
  expires_at: maybe(z.string()),
});

export type ApprovalView = Readonly<z.output<typeof ApprovalViewSchema>>;

/** The view a card payload carries, or undefined when it has none this version can read. */
export function approvalViewOf(payload: unknown): ApprovalView | undefined {
  if (payload === null || typeof payload !== 'object') return undefined;
  const parsed = ApprovalViewSchema.safeParse(
    (payload as { approval_view?: unknown }).approval_view,
  );
  return parsed.success ? parsed.data : undefined;
}

/** An approval card with the ApprovalView@1 its payload carried, when it carried one it can read. */
export type ViewedApproval = ApprovalCard & { readonly view?: ApprovalView };

/** Each card with the view its own payload carries (tool_approval's or mission_approval's). */
export function withViews(
  cards: readonly ApprovalCard[],
  data: Readonly<Record<string, unknown>>,
): ViewedApproval[] {
  return cards.map((card) => {
    const view = approvalViewOf(card.kind === 'tool' ? data.tool_approval : data.mission_approval);
    return view ? { ...card, view } : card;
  });
}
