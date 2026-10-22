// What Pause/Resume does for a calendar item, pure (D27, D-PAUSE). Two kinds pause: a routine (its
// heartbeat flips, PATCH /api/heartbeat/{agent_id}/toggle) and an agent-scheduled task (PATCH
// /api/v1/scheduled-tasks/{task_id}/status with the state it moves to); the vendored
// calendar-actions.ts offers the same two and no other. Every other kind (a playbook, a mission's
// or a ticket's deadline, a social post, one this version does not know) is managed in Studio, at
// the page the web's calendar opens for it (calendar-actions.ts playbookHref, missionHref,
// socialPostHref, agentHref; ticket-links.ts ticketHref): a Studio path, opened in the system
// browser (web-links.ts studioUrl, D-NO-WEBVIEW), never mapped back into the app. The web's Cancel
// is not offered (D63), and nothing pauses a playbook or a social post: neither has a route.

import type { WorkspaceRole } from '../../api/workspace';
import { roleCan } from '../../auth/role';
import {
  agentHref,
  playbookHref,
  socialPostHref,
} from '../../core/web/components/command-center/calendar-actions';
import type { ScheduledTaskStatus } from '../../core/web/hooks/use-scheduled-tasks-api';
import { missionHref, ticketHref } from '../../core/web/lib/ticket-links';
import type { ScheduleEntry } from './schemas';

/** The two states the calendar moves a scheduled task between (never 'cancelled', D63). */
export type PauseState = Exclude<ScheduledTaskStatus, 'cancelled'>;

export type PauseAction =
  | { readonly kind: 'routine'; readonly agentId: number }
  | { readonly kind: 'scheduled_task'; readonly id: number; readonly next: PauseState }
  | { readonly kind: 'manage_in_studio'; readonly link: string };

/** Studio's calendar: where an item with nothing more specific is managed. */
export const STUDIO_CALENDAR_PATH = '/command-center?tab=calendar';

/** The Studio page the web's calendar opens for the item. */
export function studioLink(item: ScheduleEntry): string {
  const kindLink = (() => {
    switch (item.type) {
      case 'recipe':
        return item.playbook_id === null ? null : playbookHref(item.playbook_id);
      case 'mission':
        return item.mission_id === null ? null : missionHref(item.mission_id);
      case 'task_due':
        return item.board_task_id === null ? null : ticketHref(item.board_task_id);
      case 'social':
        return item.post_id ? socialPostHref(item.post_id) : null;
      default:
        return null;
    }
  })();
  const agentLink = item.agent_id === null ? null : agentHref(item.agent_id);
  return kindLink ?? agentLink ?? STUDIO_CALENDAR_PATH;
}

/** What Pause/Resume does for this item: the routine's toggle, the task's next state, or Studio. */
export function pauseAction(item: ScheduleEntry): PauseAction {
  if (item.type === 'routine' && item.agent_id !== null) {
    return { kind: 'routine', agentId: item.agent_id };
  }
  if (item.type === 'task' && item.scheduled_task_id !== null) {
    return {
      kind: 'scheduled_task',
      id: item.scheduled_task_id,
      next: item.paused ? 'active' : 'paused',
    };
  }
  return { kind: 'manage_in_studio', link: studioLink(item) };
}

/** A pause the server is asked for (not a Studio link). */
export type SentPause = Exclude<PauseAction, { kind: 'manage_in_studio' }>;

/**
 * What the item sheet offers this role (D-ROLES, src/auth/role.ts): owners, admins and editors
 * pause and resume; a viewer reads the item only. Studio's page is offered to every role (Studio
 * holds its own line).
 */
export function pauseOffer(
  item: ScheduleEntry,
  role: WorkspaceRole | null | undefined,
): PauseAction | { readonly kind: 'read_only' } {
  const action = pauseAction(item);
  if (action.kind === 'manage_in_studio' || roleCan(role, 'pause')) return action;
  return { kind: 'read_only' };
}
