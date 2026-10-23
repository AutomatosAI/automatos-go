import { describe, expect, it } from 'vitest';

import { CC_ROUTES } from '../routes';

// US-010a: every endpoint the Command Centre wave calls (digests/command-centre-api.md, 20 Oct).
const EXPECTED = [
  'GET /api/v1/tasks',
  'GET /api/v1/tasks/{task_id}',
  'POST /api/v1/tasks/{task_id}/approve',
  'POST /api/v1/tasks/{task_id}/reject',
  'GET /api/activity/schedule',
  'PATCH /api/heartbeat/{agent_id}/toggle',
  'PATCH /api/v1/scheduled-tasks/{task_id}/status',
  'GET /api/v1/approval-grants',
  'POST /api/v1/approval-grants/{grant_id}/answer',
  'POST /api/v1/approval-grants/{grant_id}/deny',
  'GET /api/socials/posts/{post_id}',
  'GET /api/socials/posts/{post_id}/media/{file_name}',
  'POST /api/socials/posts/{post_id}/approve',
  'POST /api/socials/posts/{post_id}/request-changes',
  'GET /api/deliverables',
  'GET /api/deliverables/{deliverable_id}',
  'GET /api/workspaces/{workspace_id}/files/raw',
];

const ROUTES = Object.values(CC_ROUTES).flatMap((group) => Object.values(group));

describe('the Command Centre route table', () => {
  it('has exactly the endpoints the wave calls', () => {
    expect(ROUTES.map((route) => `${route.method} ${route.path}`).sort()).toEqual(
      [...EXPECTED].sort(),
    );
  });

  it('deletes nothing (D63) and opens no second live stream or report call', () => {
    expect(ROUTES.some((route) => route.method === 'DELETE')).toBe(false);
    expect(ROUTES.some((route) => /tasks\/stream|needs-you|\/reports/.test(route.path))).toBe(
      false,
    );
  });
});
