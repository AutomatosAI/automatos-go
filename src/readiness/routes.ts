// Readiness's route table (K4): every server path "What Auto depends on" calls, as {method, path},
// beside the foundation's src/api/routes.ts. scripts/check-routes.ts reads it against
// src/core/route-manifest.json at the pinned automatos-ai SHA; both routes are core W1's (PRD-268
// US-C18, orchestrator/api/readiness.py), served at the pin since the re-pin to 1a8956c87.
// Discovery lists them with the capability `readiness` (core W2, K20).

import type { Route } from '../api/routes';

export const READINESS_ROUTES = Object.freeze({
  /** Readiness@1: the workspace's last check while the server holds it, else a check now. */
  current: { method: 'GET', path: '/api/readiness' },
  /**
   * Check again: every item now. Limited per workspace: over it is 429 {"code":
   * "checked_recently", "detail"} with Retry-After, and nothing is checked.
   */
  check: { method: 'POST', path: '/api/readiness/check' },
} as const satisfies Record<string, Route>);
