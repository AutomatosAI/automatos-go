// The brief's route table (K4): every server path the brief calls, as {method, path}, beside the
// foundation's src/api/routes.ts. scripts/check-routes.ts reads it against
// src/core/route-manifest.json at the pinned automatos-ai SHA; the route is core W2's (PRD-268
// US-C10b, building on feat/prd-268-w2-delivery), so it is pendingUpstream until a re-pin carries
// it. The brief itself arrives as a `brief@1` part of a message in the Auto thread, read with the
// chat's own GET /api/chat/{chat_id}/messages (src/chat/routes.ts).

import type { Route } from '../api/routes';

/** Where the brief's route comes from while the pinned manifest does not have it. */
export const BRIEF_UPSTREAM = 'PRD-268 W2';

export const BRIEF_ROUTES = Object.freeze({
  /**
   * {local_date, timezone}: the day's brief, claimed once per person, workspace and local date with
   * the scheduled digest. Won: built and posted into the Auto thread, {chat_id, message_id, posted:
   * true}. Taken: the day's message, posted false; pending true while another device builds it. A
   * local_date more than a day from the server's UTC date, or a timezone that is not an IANA name,
   * is 422. Listed with the discovery capability `brief`.
   */
  open: { method: 'POST', path: '/api/proactive/brief/open', pendingUpstream: BRIEF_UPSTREAM },
} as const satisfies Record<string, Route>);
