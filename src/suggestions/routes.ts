// The suggestions' route table (K4): every server path Auto's suggestions call, as {method, path},
// beside the foundation's src/api/routes.ts. The routes are core PRD-268 W1's (api/proactive.py, on
// automatos-ai main since #1367) and the pinned manifest is older, so each is pendingUpstream until
// a re-pin carries it; the feature shows only where discovery lists `suggestions` (core W2, K20).
// Shapes: api/proactive.py and core/models/proactive.py ProactiveSuggestion.to_dict.

import type { Route } from '../api/routes';

/** Where the suggestion routes come from while the pinned manifest does not have them. */
export const SUGGESTIONS_UPSTREAM = 'PRD-268 W2';

export const SUGGESTION_ROUTES = Object.freeze({
  /**
   * ?status=open (default) &limit: {suggestions: [to_dict]}, newest first; an owner or admin sees
   * the workspace's, anyone else the ones addressed to them; a caller with no person is 403.
   */
  list: {
    method: 'GET',
    path: '/api/proactive/suggestions',
    pendingUpstream: SUGGESTIONS_UPSTREAM,
  },
  /**
   * {via?}: {suggestion, opens} where opens is {type: 'board_task', board_task_id} or {type:
   * 'chat', suggestion_id}. One Start wins (409 already_started); 409 expired, not_available
   * (a Mission or a Playbook run, W1 K12) and spend_ceiling (the suggestion stays open); a viewer
   * is 403. Owners, admins and editors.
   */
  start: {
    method: 'POST',
    path: '/api/proactive/suggestions/{suggestion_id}/start',
    pendingUpstream: SUGGESTIONS_UPSTREAM,
  },
  /** {reason?: not_now | not_useful | wrong_agent, via?}: {suggestion}; never gated. */
  hide: {
    method: 'POST',
    path: '/api/proactive/suggestions/{suggestion_id}/hide',
    pendingUpstream: SUGGESTIONS_UPSTREAM,
  },
} as const satisfies Record<string, Route>);
