// Role policy (D16, D17): owners, admins and editors chat with Auto, answer questions, approve, pause
// and report; viewers get a read-only app. Pure, so every screen asks the same question the same
// way; the server enforces the same line (modules/policy/roles.py, PRD-266 US-006) and stays the
// truth: a 403 is still shown with the forbidden copy.

import type { WorkspaceRole } from '../api/workspace';

export const ROLE_ACTIONS = ['chat', 'answer', 'approve', 'pause', 'report'] as const;
export type RoleAction = (typeof ROLE_ACTIONS)[number];

const WRITERS: ReadonlySet<WorkspaceRole> = new Set<WorkspaceRole>(['owner', 'admin', 'editor']);

const ALLOWED: Readonly<Record<RoleAction, ReadonlySet<WorkspaceRole>>> = Object.freeze({
  chat: WRITERS,
  answer: WRITERS,
  approve: WRITERS,
  pause: WRITERS,
  report: WRITERS,
});

/** false while the role is unknown (the workspace not yet read): nothing is offered before it. */
export function roleCan(role: WorkspaceRole | null | undefined, action: RoleAction): boolean {
  return role ? ALLOWED[action].has(role) : false;
}
