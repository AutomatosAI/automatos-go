// Vendored from AutomatosAI/automatos-ai frontend/components/widgets/types.ts @ 8c9361687013cc31bfb7e42d5c51736116fb4b9b · typeOnly: MissionApprovalTask, MissionApprovalWidgetData, ToolApprovalWidgetData — do not edit — scripts/sync-core.ts
// Approve/deny a gated tool call via its approval grant

export interface MissionApprovalTask {
  title: string
  agent_role?: string
  sequence?: number
  /** F162 (c): the plan task's id; side-by-side tasks share a sequence */
  temp_id?: string
  /** PRD-164 S2: agent-match preview — who would run this task and why */
  match_agent?: string
  match_reason?: string
  match_is_override?: boolean
}

export interface MissionApprovalWidgetData {
  mission_id: string
  goal: string
  state?: string
  task_count: number
  tasks: MissionApprovalTask[]
  cost_estimate_usd?: number
  cost_ceiling_usd?: number
  approval_deadline_at?: string
  // PRD-181 S5 (EU-AI-Act Art.14): the autonomy risk tier + why a human is in
  // the loop, shown on the card so the approver sees the risk classification.
  risk_tier?: 'monitor' | 'human_on_the_loop' | 'human_in_the_loop'
  risk_class?: string
  oversight_rationale?: string
  requires_approval?: boolean
}

/**
 * PRD-193 S3 (P2-12): a confirmation-gated tool call awaiting approval.
 * The card clones the mission-approval presentation but acts on the PRD-181
 * approval-grant API (grant/deny) — they share presentation, not behaviour.
 */
export interface ToolApprovalWidgetData {
  grant_id: number
  action: string
  message?: string
  /** PRD-256 FX-008: what the owner approves, the subject and the change (from → to). */
  question_md?: string | null
  permission_level?: string
  /** Human-readable digest of the model-provided params (server plumbing stripped). */
  params?: Record<string, unknown>
  // PRD-181 S5 (EU-AI-Act Art.14) oversight fields, as on the mission card.
  risk_tier?: 'monitor' | 'human_on_the_loop' | 'human_in_the_loop'
  risk_class?: string
  oversight_rationale?: string
  requires_approval?: boolean
}
