// Readiness's route table (K4): every server path "What Auto depends on" calls, as {method, path},
// beside the foundation's src/api/routes.ts. scripts/check-routes.ts reads it against
// src/core/route-manifest.json at the pinned automatos-ai SHA; both routes are core W1's (PRD-268
// US-C18, orchestrator/api/readiness.py on core main), so they are pendingUpstream until a re-pin
// carries them. Discovery lists them with the capability `readiness` (core W2, K20).

import type { Route } from '../api/routes';

/** Where the routes come from while the pinned manifest does not have them. */
export const READINESS_UPSTREAM = 'PRD-268 W1';

export const READINESS_ROUTES = Object.freeze({
  /** Readiness@1: the workspace's last check while the server holds it, else a check now. */
  current: { method: 'GET', path: '/api/readiness', pendingUpstream: READINESS_UPSTREAM },
  /**
   * Check again: every item now. Limited per workspace: over it is 429 {"code":
   * "checked_recently", "detail"} with Retry-After, and nothing is checked.
   */
  check: { method: 'POST', path: '/api/readiness/check', pendingUpstream: READINESS_UPSTREAM },
} as const satisfies Record<string, Route>);
