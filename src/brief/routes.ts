// The brief's route table (K4): every server path the brief calls, as {method, path}, beside the
// foundation's src/api/routes.ts. scripts/check-routes.ts reads it against
// src/core/route-manifest.json at the pinned automatos-ai SHA; the route is core W2's (PRD-268
// US-C10b), served at the pin since the re-pin to 1a8956c87; the thumbs' route is PRD-221's, there
// long before PRD-268 (§6.4 'Feedback' reuses it on the brief card). The brief itself arrives as a
// `brief@1` part of a message in the Auto thread, read with the chat's own
// GET /api/chat/{chat_id}/messages (src/chat/routes.ts).

import type { Route } from '../api/routes';

export const BRIEF_ROUTES = Object.freeze({
  /**
   * {local_date, timezone}: the day's brief, claimed once per person, workspace and local date with
   * the scheduled digest. Won: built and posted into the Auto thread, {chat_id, message_id, posted:
   * true}. Taken: the day's message, posted false; pending true while another device builds it. A
   * local_date more than a day from the server's UTC date, or a timezone that is not an IANA name,
   * is 422. Listed with the discovery capability `brief`.
   */
  open: { method: 'POST', path: '/api/proactive/brief/open' },
  /**
   * {state_hash, rating: 1 | -1}: a thumbs up or down on the brief's Auto's Read, keyed by the
   * state it described (api/activity.py submit_digest_feedback, PRD-221 S10); {ok: true}. Any other
   * rating is 422; gated agents:execute (the member scope chat has, so a viewer is 403).
   */
  feedback: { method: 'POST', path: '/api/activity/digest/feedback' },
} as const satisfies Record<string, Route>);
