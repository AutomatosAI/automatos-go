// Hiding question text in pushes (PRD-001 §4.7, D-PAYLOAD, D-ROLES), pure. One switch per workspace
// (settings.push.redact_questions, off by default): on, a question push carries no question or
// options and offers Open only. Owners and admins change it (W2 US-014b: PUT
// /api/v1/mobile/push-settings needs workspace:manage); editors and viewers see its state with a
// line saying who can change it. The server enforces the same line and stays the truth: a 403 is
// still shown with the client's forbidden copy.

import type { ApiClient } from '../../api/client';
import type { WorkspaceRole } from '../../api/workspace';
import { putPushSettings } from '../api';
import type { WorkspacePush } from '../schemas/server';
import { PUSH_PREFS_COPY } from '../strings';

/** modules/policy/roles.py: workspace:manage is owner and admin only. */
const MANAGERS: ReadonlySet<WorkspaceRole> = new Set<WorkspaceRole>(['owner', 'admin']);

/** false while the role is unknown: nothing is offered before the workspace is read. */
export function canRedact(role: WorkspaceRole | null | undefined): boolean {
  return role ? MANAGERS.has(role) : false;
}

/** The switch as the workspace says, off until it is read. */
export function redactState(
  workspacePush: Pick<WorkspacePush, 'redactQuestions'> | null | undefined,
): boolean {
  return workspacePush?.redactQuestions ?? false;
}

/** The line under a switch this person cannot change, or null when they can. */
export function redactNote(role: WorkspaceRole | null | undefined): string | null {
  return canRedact(role) ? null : PUSH_PREFS_COPY.redactLocked;
}

/**
 * Sets the switch for the workspace and answers what the server saved; a person who cannot change it
 * is refused before anything is sent. Never queued or retried (D-WRITES).
 */
export async function saveRedact(
  client: ApiClient,
  role: WorkspaceRole | null | undefined,
  redact: boolean,
): Promise<boolean> {
  if (!canRedact(role)) throw new TypeError('Only an owner or admin changes this switch');
  const saved = await putPushSettings(client, redact);
  return saved.push.redact_questions;
}
