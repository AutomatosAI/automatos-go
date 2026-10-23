// Vendored from AutomatosAI/automatos-ai frontend/lib/theme-sdk/chat.ts @ 630fc1c85af06c5c76e70c74e9653ee1804fdf41 · typeOnly: HostChatMessage, HostDeliverable, HostReceipt, HostToolCall — do not edit — scripts/sync-core.ts
import type { WithdrawOffer } from './host-cards/chat-cards'

export type HostChatRole = 'system' | 'user' | 'assistant'

/** What one call of a turn did, written by the platform from the call that ran (PRD-256). */
export interface HostReceipt {
  readonly action: string
  readonly kind: 'read' | 'write'
  /** waiting: an ask for the owner's click, its approval card raised. */
  readonly status: 'done' | 'refused' | 'skipped' | 'waiting'
  readonly subject: string
  readonly effect: string
  readonly link: string | null
  readonly reason: string | null
}

/** A Deliverable a reply made live this page session. */
export interface HostDeliverable {
  readonly id: string
  readonly title: string
  readonly kind: 'document' | 'image' | 'video'
}

/** A ticket the reply filed or checked, for cards.TaskCard. */
export interface HostTaskCard {
  readonly id: number
  readonly number?: string | null
  readonly title: string
  readonly status: string
  readonly assigned_agent: string
  readonly runtime?: string | null
  readonly last_tool?: string | null
  readonly files_touched?: number
  readonly exit_reason?: string | null
  readonly denials?: number
  readonly started_at?: string | null
  readonly completed_at?: string | null
}

/** One tool call of a reply, as its tool lines show it (PRD-238 S3). */
export interface HostToolCall {
  readonly toolCallId: string
  readonly toolName: string
  readonly state: 'running' | 'completed' | 'error'
  /** The call's input as the model sent it (a query, a page, a title), unchecked. */
  readonly input?: unknown
  readonly error?: string
  readonly durationMs?: number
  /** The server's one-line result headline, never a raw payload. */
  readonly summary?: string
  /** The loop de-duplicated this call: it never ran. */
  readonly skipped: boolean
  /** An ask for the owner's click: it waits on its card, it did not fail. */
  readonly waiting: boolean
}

/** A reply that failed in words. */
export interface HostChatError {
  readonly message: string
  readonly code: string | null
}

/**
 * An approval a reply raised: a tool approval (a grant) or a Mission plan. The host draws it
 * (cards.ToolApproval, cards.MissionApproval: protected surfaces); the theme only places it.
 */
export interface HostChatApproval {
  readonly key: string
  readonly kind: 'tool' | 'mission'
  /** The reply that raised it. */
  readonly replyId: string
  /** waiting for the owner; answered (the card shows the outcome); closed (gone). */
  readonly status: 'waiting' | 'answered' | 'closed'
  readonly filedAt: Date
  /** The conversation it belongs to ('' for a new chat the backend has not named yet). */
  readonly chatId: string
  /** The card's own data, checked off the wire; the host's card reads it. */
  readonly data: unknown
  /** The card's decision went through. */
  readonly answered: () => void
  /** The card closed. */
  readonly closed: () => void
}

/** One message as a theme draws it. */
export interface HostChatMessage {
  readonly id: string
  readonly role: HostChatRole
  /** The words: the text parts, or the content when there are none. */
  readonly text: string
  /** The reply's activity lines (narration, a long tool's progress). */
  readonly activity: readonly string[]
  readonly error: HostChatError | null
  /** This reply is the one being written now. */
  readonly writing: boolean
  /** Stop ended this reply; its words so far stay (P260-FX-30). */
  readonly stopped: boolean
  /** The turn's receipts; null for a message from before PRD-256. */
  readonly receipts: readonly HostReceipt[] | null
  /** The lines the platform puts above the reply (a refused write, work not done). */
  readonly above: readonly string[]
  readonly deliverables: readonly HostDeliverable[]
  /** The approval cards this reply raised that the owner has not closed. */
  readonly approvals: readonly HostChatApproval[]
  readonly taskCards: readonly HostTaskCard[]
  /** The reply's tool calls, in the order they started. */
  readonly toolCalls: readonly HostToolCall[]
  /** Who wrote the reply when the turn didn't ("Auto · background"); null for a reply of the turn. */
  readonly provenance: string | null
  /** A failed turn the server saved, in its words: the reply is that failure, never an answer. */
  readonly savedError: string | null
  /** A cap that ended the reply's turn, in words; null when none did. */
  readonly limitReached: string | null
  /** The length of the model's reasoning on this reply: its growth is the model thinking. */
  readonly reasoningChars: number
  /** The owner said no while a request still waits on a yes: place it in cards.WithdrawOfferCard. */
  readonly withdrawOffer: WithdrawOffer | null
  /** The Deliverables the reply's done receipts link to, each id checked by the host. */
  readonly linkedDeliverables: readonly HostDeliverable[]
}
