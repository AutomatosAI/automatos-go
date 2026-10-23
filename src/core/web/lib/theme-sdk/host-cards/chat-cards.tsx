// Vendored from AutomatosAI/automatos-ai frontend/lib/theme-sdk/host-cards/chat-cards.tsx @ 630fc1c85af06c5c76e70c74e9653ee1804fdf41 · typeOnly: MissionSuggestionMessage, WithdrawOffer — do not edit — scripts/sync-core.ts
/** One request of Auto's still waiting on a yes. */
export interface WithdrawRequest {
  readonly grant_id: number
  readonly action?: string | null
  readonly reason?: string | null
}

/** The owner said no while those requests still wait: Withdraw denies each grant. */
export interface WithdrawOffer {
  readonly message: string
  readonly requests: readonly WithdrawRequest[]
}

export interface MissionSuggestionMessage {
  readonly role: string
  readonly content: string
}
