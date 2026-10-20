// Vendored from AutomatosAI/automatos-ai frontend/hooks/use-activity-api.ts @ 630fc1c85af06c5c76e70c74e9653ee1804fdf41 · typeOnly: ActivityFeedItem — do not edit — scripts/sync-core.ts
// ============= TYPES =============

export interface ActivityAgent {
  id: number | null
  name: string
  avatar_url: string | null
}

export interface ActivityStepProgress {
  current: number
  total: number
  steps: Array<{
    name: string
    status: 'pending' | 'running' | 'completed' | 'failed'
  }>
}

export interface ActivityChannel {
  type: 'telegram' | 'whatsapp' | 'slack' | 'email' | 'webchat'
  name: string
}

export interface ActivityFeedItem {
  id: string
  type: 'chat' | 'routine' | 'recipe' | 'mission' | 'task'
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
  agent: ActivityAgent | null
  agents: ActivityAgent[]
  summary: string
  source_id: string | null
  source_url: string | null
  trigger: 'manual' | 'scheduled' | 'event' | 'webhook' | 'heartbeat' | string | null
  channel?: ActivityChannel | null
  step_progress?: ActivityStepProgress | null
  error_message: string | null
  tokens_used?: number | null
  total_tokens?: number | null
  total_duration_ms?: number | null
  // PRD-221 S12: latest orchestration event as a plain-English progress line.
  last_progress?: {
    summary: string
    at: string | null
    requires_attention: boolean
  } | null
  orchestration_run_id?: string | null
  /** PRD-252 R5: a ticket's board status, for the board's word ("Blocked", not "failed"). */
  board_status?: string | null
  /** PRD-252 R4: a ticket's number, #0042 */
  number?: string | null
}
