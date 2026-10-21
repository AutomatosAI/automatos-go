import { describe, expect, it } from 'vitest';

import manifest from '../../core/route-manifest.json';
import { CHAT_ROUTES } from '../routes';

const served = new Set(
  manifest.routes.map((route) => `${route.method} ${route.path.replace(/\{[^}]*\}/g, '{}')}`),
);

describe('CHAT_ROUTES', () => {
  it('lists every endpoint the chat wave calls (KC3)', () => {
    expect(Object.values(CHAT_ROUTES).map((route) => `${route.method} ${route.path}`)).toEqual([
      'POST /api/chat',
      'GET /api/chat/{chat_id}',
      'GET /api/chat/{chat_id}/messages',
      'GET /api/chat/history',
      'POST /api/chat/{chat_id}/cancel',
      'GET /api/chat/agents',
      'POST /api/attachments',
      'POST /api/missions',
      'POST /api/missions/{mission_id}/approve',
      'POST /api/missions/{mission_id}/reject',
      'POST /api/v1/approval-grants/{grant_id}/grant',
      'POST /api/v1/approval-grants/{grant_id}/deny',
      'GET /api/v1/tasks/{task_id}',
      'POST /api/v1/tasks/{task_id}/rebrief',
    ]);
  });

  it('are all on the server at the pinned SHA, so none is marked pendingUpstream', () => {
    for (const route of Object.values(CHAT_ROUTES)) {
      expect(served.has(`${route.method} ${route.path.replace(/\{[^}]*\}/g, '{}')}`)).toBe(true);
      expect(route).not.toHaveProperty('pendingUpstream');
    }
  });
});
