// US-007a: the role policy every screen gates on (a regression guard: the foundation's roleCan matrix
// is not changed here), when the shell reads the workspace again (refreshDecision), and what a
// refused bootstrap means (bootstrapRefusal). This is the one file in src/session that names roles.

import { describe, expect, it } from 'vitest';

import { ApiError, errorFromResponse } from '../../api/errors';
import { WORKSPACE_COPY } from '../../api/strings';
import { WORKSPACE_PAUSED_DETAIL, type WorkspaceRole } from '../../api/workspace';
import { roleCan, type RoleAction } from '../../auth/role';
import { bootstrapRefusal, REFUSAL_MESSAGES } from '../bootstrap-refusal';
import { FORBIDDEN_REFRESH_MIN_MS, RESUME_REFRESH_AFTER_MS } from '../config';
import { isForbidden, isResume, refreshDecision, type RefreshEvent } from '../role-refresh';
import { SESSION_COPY } from '../strings';

const GATED: readonly RoleAction[] = ['chat', 'answer', 'approve', 'pause'];
const MATRIX: readonly [WorkspaceRole, boolean][] = [
  ['owner', true],
  ['admin', true],
  ['editor', true],
  ['viewer', false],
];

describe("roleCan: the foundation's matrix, unchanged (D16, D17)", () => {
  const cases = MATRIX.flatMap(([role, allowed]) =>
    GATED.map((action): [WorkspaceRole, RoleAction, boolean] => [role, action, allowed]),
  );

  it.each(cases)('%s may %s: %s', (role, action, allowed) => {
    expect(roleCan(role, action)).toBe(allowed);
  });

  it('offers nothing before the bootstrap has said the role', () => {
    for (const action of GATED) expect(roleCan(null, action)).toBe(false);
  });
});

const NOW = 5_000_000;
const ago = (ms: number) => NOW - ms;

describe('refreshDecision: when the workspace is read again (KC12)', () => {
  const table: readonly [RefreshEvent, number | null, boolean][] = [
    ['launch', null, true],
    ['launch', ago(0), true],
    ['launch', ago(1), true],
    ['resume', null, true],
    ['resume', ago(0), false],
    ['resume', ago(RESUME_REFRESH_AFTER_MS - 1), false],
    ['resume', ago(RESUME_REFRESH_AFTER_MS), true],
    ['resume', ago(RESUME_REFRESH_AFTER_MS * 10), true],
    ['forbidden', null, true],
    ['forbidden', ago(0), false],
    ['forbidden', ago(FORBIDDEN_REFRESH_MIN_MS - 1), false],
    ['forbidden', ago(FORBIDDEN_REFRESH_MIN_MS), true],
    ['forbidden', ago(FORBIDDEN_REFRESH_MIN_MS * 10), true],
  ];

  it.each(table)('%s, last read at %s: %s', (event, lastFetchedAt, expected) => {
    expect(refreshDecision(event, lastFetchedAt, NOW)).toBe(expected);
  });

  it('never reads again on a clock that went backwards, except at launch', () => {
    expect(refreshDecision('resume', NOW + 1, NOW)).toBe(false);
    expect(refreshDecision('forbidden', NOW + 1, NOW)).toBe(false);
    expect(refreshDecision('launch', NOW + 1, NOW)).toBe(true);
  });

  it('names its intervals: a quick app switch is not a resume read, a refusal run is one read', () => {
    expect(RESUME_REFRESH_AFTER_MS).toBeGreaterThan(0);
    expect(FORBIDDEN_REFRESH_MIN_MS).toBeGreaterThan(0);
  });

  it('a 403 of any words is a refusal that may mean the role changed; nothing else is', () => {
    expect(isForbidden(new ApiError('forbidden', { status: 403 }))).toBe(true);
    expect(isForbidden(errorFromResponse(403, JSON.stringify({ detail: 'nope' })))).toBe(true);
    for (const kind of ['auth', 'not_found', 'network', 'server', 'conflict'] as const) {
      expect(isForbidden(new ApiError(kind))).toBe(false);
    }
    expect(isForbidden(new Error('forbidden'))).toBe(false);
    expect(isForbidden(undefined)).toBe(false);
  });

  it("a resume is a return from the background; 'inactive' never left", () => {
    expect(isResume('background', 'active')).toBe(true);
    expect(isResume('extension', 'active')).toBe(true);
    expect(isResume('inactive', 'active')).toBe(false);
    expect(isResume('active', 'active')).toBe(false);
    expect(isResume('active', 'background')).toBe(false);
  });
});

const PAUSED = errorFromResponse(403, JSON.stringify({ detail: WORKSPACE_PAUSED_DETAIL }));

describe('bootstrapRefusal: what a refused GET /api/workspaces/current means', () => {
  it("the paused refusal (the server's exact words) is D8's paused state", () => {
    expect(bootstrapRefusal(PAUSED)).toBe('paused');
    expect(REFUSAL_MESSAGES.paused).toBe(WORKSPACE_COPY.paused);
    expect(WORKSPACE_COPY.paused).toBe('Your workspace is paused; ask your workspace owner');
  });

  it('any other 403, or a 404, is a workspace this person is no longer in', () => {
    const others = [
      errorFromResponse(403, JSON.stringify({ detail: 'Not a member of this workspace' })),
      errorFromResponse(403, ''),
      errorFromResponse(403, JSON.stringify({ detail: `${WORKSPACE_PAUSED_DETAIL} ` })),
      errorFromResponse(404, JSON.stringify({ detail: 'Workspace not found' })),
      errorFromResponse(404, ''),
    ];
    for (const error of others) expect(bootstrapRefusal(error)).toBe('workspace_lost');
    expect(REFUSAL_MESSAGES.workspace_lost).toBe(
      "You're no longer a member of this workspace. Ask its owner to add you again.",
    );
    expect(SESSION_COPY.lostMessage).toBe(REFUSAL_MESSAGES.workspace_lost);
  });

  it('is not a refusal when the server could not answer, or the session ended', () => {
    const notRefusals = [
      new ApiError('network'),
      errorFromResponse(500, ''),
      errorFromResponse(502, ''),
      errorFromResponse(401, ''),
      errorFromResponse(409, JSON.stringify({ detail: { code: 'pending_invitation' } })),
      new ApiError('invalid_response'),
      new Error('Workspace is disabled. Contact an administrator.'),
      null,
    ];
    for (const error of notRefusals) expect(bootstrapRefusal(error)).toBeNull();
  });

  it('names no plan, price or credit in either refusal (D8)', () => {
    for (const words of [...Object.values(REFUSAL_MESSAGES), SESSION_COPY.lostTitle]) {
      expect(words).not.toMatch(/plan|price|pricing|credit|upgrade|subscription|billing/i);
    }
  });
});
