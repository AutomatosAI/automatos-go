// The chat wave's route table (KC3, K4): every server path the chat calls, as {method, path}.
// scripts/check-routes.ts reads it beside the foundation's src/api/routes.ts and checks each entry
// against src/core/route-manifest.json at the pinned automatos-ai SHA. Shapes and auth per route:
// reports/mobile-review-2026-10-20/digests/chat-api.md lines 20-45.

import type { Route } from '../api/routes';

export const CHAT_ROUTES = Object.freeze({
  /** One turn, streamed as the AI SDK v1 data stream; a missing or stale id creates a new chat. */
  send: { method: 'POST', path: '/api/chat' },
  /** One chat with turnInFlight; 404 when it is gone, 403 when it is another user's. */
  chat: { method: 'GET', path: '/api/chat/{chat_id}' },
  /** Every saved message of a chat with its parts (receipts, reasoning, narration, text, …). */
  messages: { method: 'GET', path: '/api/chat/{chat_id}/messages' },
  /** The caller's chats, newest first; reads only `limit` (PRD-266 §4.9 adds the cursor). */
  history: { method: 'GET', path: '/api/chat/history' },
  /** Stop: cancels the detached turn on the server (dropping the connection does not). */
  cancel: { method: 'POST', path: '/api/chat/{chat_id}/cancel' },
  /** The workspace's agents that can answer in chat. */
  agents: { method: 'GET', path: '/api/chat/agents' },
  /** Multipart `file` upload → {attachment_id, …}; the id rides in the next message. */
  attachments: { method: 'POST', path: '/api/attachments' },
  /** File the suggested Mission {goal, config: {source: 'chat', chat_id, context_messages}}. */
  createMission: { method: 'POST', path: '/api/missions' },
  /** Approve a Mission's plan; the body is empty (extra=forbid on the server). */
  approveMission: { method: 'POST', path: '/api/missions/{mission_id}/approve' },
  /** Reject a Mission's plan {reason}. */
  rejectMission: { method: 'POST', path: '/api/missions/{mission_id}/reject' },
  /** Grant a tool_approval card. */
  grantApproval: { method: 'POST', path: '/api/v1/approval-grants/{grant_id}/grant' },
  /** Deny a tool_approval card (also the withdraw offer's Withdraw). */
  denyApproval: { method: 'POST', path: '/api/v1/approval-grants/{grant_id}/deny' },
  /** One ticket, for 'Ask Auto about #0419' (the discussion). */
  task: { method: 'GET', path: '/api/v1/tasks/{task_id}' },
  /** 'Update ticket and re-queue' {brief}. */
  rebrief: { method: 'POST', path: '/api/v1/tasks/{task_id}/rebrief' },
} as const satisfies Record<string, Route>);

export type ChatRouteName = keyof typeof CHAT_ROUTES;
