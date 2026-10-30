// Vendored from AutomatosAI/automatos-ai frontend/hooks/use-activity-api.ts @ 1a8956c874dc42cff05b96f431c50b7d722a71aa · typeOnly: ActivityFeedItem, ScheduleItem, ScheduleItemType — do not edit — scripts/sync-core.ts
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

export interface ScheduleRecurrence {
  cron_expression: string | null
  interval_minutes: number | null
  timezone: string
  active_hours: Record<string, unknown> | null
}

/**
 * The six sources of the schedule feed (PRD-162 + the board-task SLA source):
 * routine = agent heartbeat, recipe = cron playbook, task = agent-scheduled task,
 * mission = a mission's SLA deadline, task_due = a board task's SLA deadline,
 * social = a scheduled social post (PRD-251 US-307).
 */
export type ScheduleItemType = 'routine' | 'recipe' | 'task' | 'mission' | 'task_due' | 'social'

export interface ScheduleItem {
  id: string
  name: string
  type: ScheduleItemType
  next_run_at: string | null
  frequency: string
  agent_name: string | null
  agent_id: number | null
  recurrence?: ScheduleRecurrence
  /** The row behind the item, so the calendar can act on it (pause, cancel,
   *  open) without parsing the composite `id`. Each source sets its own. */
  scheduled_task_id?: number
  /** task only: the user paused it (PRD-266 D27). A paused task stays in the feed at
   *  the slot it would run, greyed, with Resume in place of Pause; Next up skips it. */
  paused?: boolean
  task_type?: 'one_shot' | 'recurring'
  /** task only: what firing does — open a chat, or file a board ticket */
  deliver_as?: 'chat' | 'board_task'
  mission_id?: number
  playbook_id?: number
  board_task_id?: number
  /** task_due only: the board card's status and priority */
  status?: string
  priority?: string
  /** social only: the post, and the timezone its slot is shown in (the post's own) */
  post_id?: string
  timezone?: string
}
