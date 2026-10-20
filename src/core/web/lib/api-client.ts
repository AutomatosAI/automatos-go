// Vendored from AutomatosAI/automatos-ai frontend/lib/api-client.ts @ 630fc1c85af06c5c76e70c74e9653ee1804fdf41 · typeOnly: ApprovalGrant — do not edit — scripts/sync-core.ts
// ─── PRD-196 governance surface types ────────────────────────────────
export interface ApprovalGrantOversight {
  risk_class: string
  tier: 'monitor' | 'human_on_the_loop' | 'human_in_the_loop' | string
  rationale: string
  requires_approval: boolean
}

// PRD-225: the cascade of downstream work parked behind a question.
export interface QuestionCascadeTask {
  id: number
  title: string
  status: string
}
export interface QuestionCascade {
  total: number
  tasks: QuestionCascadeTask[]
}

// F091-E1: whose job a card belongs to — the agent and the ticket.
export interface GrantOwner {
  agent?: { id: number; name?: string | null } | null
  /** PRD-252 R4: `number` is the ticket's number, #0042 */
  ticket?: { id: number; title?: string | null; number?: string | null } | null
}

export interface ApprovalGrant {
  id: number
  workspace_id: string | null
  subject_type: string
  subject_id: string
  tool_name: string | null
  risk_tier: string | null
  agent_id: number | null
  status: string
  reason: string | null
  estimated_cost_usd: string | null
  requested_at: string | null
  expires_at: string | null
  granted_at: string | null
  granted_by: string | null
  revoked_at: string | null
  revoked_by: string | null
  oversight?: ApprovalGrantOversight
  /** PRD-193 S4: params snapshot + executed_result land here on resume. */
  details?: Record<string, unknown>
  // PRD-225: a grant is a question when its decision is words, not a boolean.
  kind?: 'approval' | 'question' | string
  question_md?: string | null
  options?: string[] | null
  answer_text?: string | null
  answered_by?: string | null
  answered_at?: string | null
  asked_by_agent_id?: number | null
  /** F091-E1: the agent and the ticket this card belongs to (list rows). */
  owner?: GrantOwner | null
  channel_refs?: Record<string, unknown>
  /** Downstream tasks blocked behind a question (question rows only). */
  cascade?: QuestionCascade
}
