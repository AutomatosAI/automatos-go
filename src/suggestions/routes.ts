// The suggestions' route table (K4): every server path Auto's suggestions call, as {method, path},
// beside the foundation's src/api/routes.ts. The routes are core PRD-268 W1's (api/proactive.py,
// #1367), served at the pin since the re-pin to 1a8956c87; the feature shows only where discovery
// lists `suggestions` (core W2, K20). Shapes: api/proactive.py and core/models/proactive.py
// ProactiveSuggestion.to_dict; the person's own settings ("Pause suggestions", §6.9) are
// services/proactive/settings.py PersonSettings.to_dict.

import type { Route } from '../api/routes';

export const SUGGESTION_ROUTES = Object.freeze({
  /**
   * ?status=open (default) &limit: {suggestions: [to_dict]}, newest first; an owner or admin sees
   * the workspace's, anyone else the ones addressed to them; a caller with no person is 403.
   */
  list: { method: 'GET', path: '/api/proactive/suggestions' },
  /**
   * {via?}: {suggestion, opens} where opens is {type: 'board_task', board_task_id} or {type:
   * 'chat', suggestion_id}. One Start wins (409 already_started); 409 expired, not_available
   * (a Mission or a Playbook run, W1 K12) and spend_ceiling (the suggestion stays open); a viewer
   * is 403. Owners, admins and editors.
   */
  start: { method: 'POST', path: '/api/proactive/suggestions/{suggestion_id}/start' },
  /** {reason?: not_now | not_useful | wrong_agent, via?}: {suggestion}; never gated. */
  hide: { method: 'POST', path: '/api/proactive/suggestions/{suggestion_id}/hide' },
  /**
   * The caller's own settings in this workspace (any member; a caller with no person is 403):
   * {paused, quiet_start, quiet_end, timezone}. "Pause suggestions" reads paused (§6.9).
   */
  me: { method: 'GET', path: '/api/proactive/me' },
  /**
   * {paused?, quiet_start?, quiet_end?, timezone?}: what is left out stays; answers as GET does.
   * The phone sends only {paused}. Audited by core.
   */
  saveMe: { method: 'PUT', path: '/api/proactive/me' },
} as const satisfies Record<string, Route>);
