// The Command Centre's route table (K4, KX3): every server path this wave calls, as {method, path},
// beside the foundation's src/api/routes.ts and never inside it, so the chat kit and this one stay
// file-disjoint. scripts/check-routes.ts reads it against src/core/route-manifest.json at the pinned
// automatos-ai SHA. Endpoints, bodies and auth: reports/mobile-review-2026-10-20/digests/
// command-centre-api.md (verified 20 Oct). Nothing here deletes (D63), pauses a playbook or a social
// post (D27), opens a second live connection, reads needs-you or files a report (the foundation's).

import type { Route } from '../api/routes';

export const CC_ROUTES = Object.freeze({
  board: Object.freeze({
    /** Every open ticket and the newest ?finished_limit finished ones (api/board_tasks.py list_tasks). */
    list: { method: 'GET', path: '/api/v1/tasks' },
    /** One ticket by its integer row id, never its number. */
    ticket: { method: 'GET', path: '/api/v1/tasks/{task_id}' },
    /** {note?}: Review → Done (a mission's card approves its plan instead, server-side). */
    approve: { method: 'POST', path: '/api/v1/tasks/{task_id}/approve' },
    /** {feedback}: Send back to the same agent, the note leading the redo's brief. */
    reject: { method: 'POST', path: '/api/v1/tasks/{task_id}/reject' },
  }),
  calendar: Object.freeze({
    /** ?range=7d: routines, playbooks, scheduled tasks, mission SLAs, task deadlines, social posts. */
    schedule: { method: 'GET', path: '/api/activity/schedule' },
    /** Pause or resume a routine (flips its heartbeat; agents:update). */
    toggleRoutine: { method: 'PATCH', path: '/api/heartbeat/{agent_id}/toggle' },
    /** {status: active | paused} on an agent-scheduled task (missions:update). */
    scheduledTaskStatus: { method: 'PATCH', path: '/api/v1/scheduled-tasks/{task_id}/status' },
  }),
  questions: Object.freeze({
    /** ?status=pending&kind=question: the open questions (owner/admin until PRD-266 W1). */
    list: { method: 'GET', path: '/api/v1/approval-grants' },
    /** {option} | {answer_text}: compare-and-swap; a 409 says it was already answered. */
    answer: { method: 'POST', path: '/api/v1/approval-grants/{grant_id}/answer' },
    /** Dismiss: the subject stays blocked (a stopped run's question closes its run). */
    deny: { method: 'POST', path: '/api/v1/approval-grants/{grant_id}/deny' },
  }),
  social: Object.freeze({
    /** The post as it will publish, with the content_hash of that version. */
    post: { method: 'GET', path: '/api/socials/posts/{post_id}' },
    /** One media file of the post, with the bearer. */
    media: { method: 'GET', path: '/api/socials/posts/{post_id}/media/{file_name}' },
    /** {content_hash}: approves exactly the version shown (409 when it changed). */
    approve: { method: 'POST', path: '/api/socials/posts/{post_id}/approve' },
    /** {comment}: Request changes. */
    requestChanges: { method: 'POST', path: '/api/socials/posts/{post_id}/request-changes' },
  }),
  deliverables: Object.freeze({
    /** ?limit&offset&artifact_type: the gallery, offset paging (UUID ids, no review state). */
    list: { method: 'GET', path: '/api/deliverables' },
    /** ?include_content=true: text inline up to 1 MB. */
    detail: { method: 'GET', path: '/api/deliverables/{deliverable_id}' },
    /** ?path=: a workspace file's bytes, for the system viewer after an authenticated download. */
    rawFile: { method: 'GET', path: '/api/workspaces/{workspace_id}/files/raw' },
  }),
} as const satisfies Record<string, Record<string, Route>>);
