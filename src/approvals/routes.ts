// The approval sheet's route table (K4): the one server path it reads on its own, as {method, path},
// beside the foundation's src/api/routes.ts. scripts/check-routes.ts reads it against
// src/core/route-manifest.json at the pinned automatos-ai SHA, which serves it (core W2's US-C20a,
// orchestrator/api/approval_views.py); discovery lists it with the capability `approval_view` from
// core W3 (US-C24). The answers are the cards' own (src/chat/routes.ts: …/grant and …/deny).

import type { Route } from '../api/routes';

export const APPROVAL_ROUTES = Object.freeze({
  /**
   * An approval grant's ApprovalView@1, in the caller's language (Accept-Language). Who may answer
   * it may read it (owner, admin, editor; a viewer is 403); another workspace's grant, a question
   * or one no longer waiting is 404; a database that cannot be read is 503.
   */
  view: { method: 'GET', path: '/api/v1/approval-grants/{grant_id}/view' },
} as const satisfies Record<string, Route>);
