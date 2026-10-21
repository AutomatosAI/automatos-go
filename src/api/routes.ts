// The foundation's route table (K4): every server path the foundation calls, as {method, path}.
// Feature waves keep their own src/<feature>/routes.ts so the parallel kits never edit this file.
// scripts/check-routes.ts (US-004c) checks each entry against src/core/route-manifest.json at the
// pinned automatos-ai SHA; a route PRD-266 adds is marked pendingUpstream until it lands there.

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type Route = {
  readonly method: HttpMethod;
  /** Server path; `{name}` segments are filled (URI-encoded) from the call's params. */
  readonly path: string;
  /** The PRD-266 story that adds this route, while the pinned manifest does not have it yet. */
  readonly pendingUpstream?: string;
};

export const routes = Object.freeze({
  /** The workspace the caller resolved to: id, role, plan, exposure (read on every launch, D-ONE-CLIENT). */
  workspaceCurrent: { method: 'GET', path: '/api/workspaces/current' },
  /** The discovery document (PRD-266 §4.1): edition, auth modes, capabilities. */
  discovery: {
    method: 'GET',
    path: '/.well-known/automatos.json',
    pendingUpstream: 'PRD-266 US-001',
  },
  /** The live board/chat event stream (text/event-stream), one connection while the app is open. */
  tasksStream: { method: 'GET', path: '/api/v1/tasks/stream' },
  /** The needs-you counts behind the Command Centre badge. */
  needsYou: { method: 'GET', path: '/api/activity/needs-you' },
  /** Report a message or a Deliverable (PRD-266 §4.8). */
  reports: { method: 'POST', path: '/api/v1/reports', pendingUpstream: 'PRD-266 US-016' },
} as const satisfies Record<string, Route>);
