import { describe, expect, it } from 'vitest';

import { WORKSPACE_ROLES, type WorkspaceRole } from '../../api/workspace';
import { ROLE_ACTIONS, roleCan, type RoleAction } from '../role';
import { ROLE_COPY } from '../strings';

const MATRIX: Readonly<Record<WorkspaceRole, boolean>> = {
  owner: true,
  admin: true,
  editor: true,
  viewer: false,
};

const CASES: readonly [WorkspaceRole, RoleAction, boolean][] = WORKSPACE_ROLES.flatMap((role) =>
  ROLE_ACTIONS.map((action): [WorkspaceRole, RoleAction, boolean] => [role, action, MATRIX[role]]),
);

describe('roleCan (D16, D17)', () => {
  it.each(CASES)('%s may %s: %s', (role, action, allowed) => {
    expect(roleCan(role, action)).toBe(allowed);
  });

  it('covers exactly the five actions', () => {
    expect([...ROLE_ACTIONS]).toEqual(['chat', 'answer', 'approve', 'pause', 'report']);
  });

  it.each(ROLE_ACTIONS)('offers nothing (%s) before the role is known', (action) => {
    expect(roleCan(null, action)).toBe(false);
    expect(roleCan(undefined, action)).toBe(false);
  });

  it('gives viewers the read-only copy, word for word', () => {
    expect(ROLE_COPY.viewerReadOnly).toBe(
      'Ask your workspace owner for editor access to talk to Auto',
    );
  });
});
