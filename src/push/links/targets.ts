// A push's signed link → the screen it opens (PRD-001 §4.8, KP9, KP17), pure. link_type picks the
// screen and link_id the record: 'question' → the Questions list (there is no route to one
// question), 'task' → the ticket, 'social_post' → the post as it will publish, 'chat' → the
// conversation; 'approval_grant', 'mission', anything else or nothing → home, where the needs strip
// is (the phone has no approvals or Missions screen, D3). A signed link is authentic, not
// necessarily well formed: a link_id reaches a route builder only once it has its record's shape (a
// grant: a positive row id; a ticket: the board's row id, digits; a post and a chat: a UUID), else
// home. Every route comes from the foundation's builders (src/navigation/routes.ts), never a path
// written here; whether the record is still there is src/push/links/stale.ts's question.

import { isTaskId, routes } from '../../navigation/routes';
import {
  CHAT_LINK_TYPE,
  QUESTION_LINK_TYPE,
  ROW_ID_PATTERN,
  SOCIAL_POST_LINK_TYPE,
  TASK_LINK_TYPE,
  UUID_PATTERN,
} from '../config';
import type { PushLink } from '../inbound/intent';

/** A record a push can open. */
export type RecordKind = 'question' | 'ticket' | 'social' | 'chat';

export type LinkTarget = Readonly<{ kind: RecordKind; id: string }> | Readonly<{ kind: 'home' }>;

type LinkRule = Readonly<{ kind: RecordKind; fits: (id: string) => boolean }>;

const isRowId = (id: string) => ROW_ID_PATTERN.test(id);
const isUuid = (id: string) => UUID_PATTERN.test(id);

const RULES: ReadonlyMap<string, LinkRule> = new Map<string, LinkRule>([
  [QUESTION_LINK_TYPE, { kind: 'question', fits: isRowId }],
  [TASK_LINK_TYPE, { kind: 'ticket', fits: isTaskId }],
  [SOCIAL_POST_LINK_TYPE, { kind: 'social', fits: isUuid }],
  [CHAT_LINK_TYPE, { kind: 'chat', fits: isUuid }],
]);

export const HOME_TARGET: LinkTarget = Object.freeze({ kind: 'home' });

/** The record a link names, or home (no link, a type the phone has no screen for, a bad id). */
export function targetFor(link: PushLink): LinkTarget {
  const rule = link.link_type ? RULES.get(link.link_type) : undefined;
  const id = link.link_id;
  if (!rule || !id || !rule.fits(id)) return HOME_TARGET;
  return Object.freeze({ kind: rule.kind, id });
}

/** The target's own screen, through the foundation's builders only. */
export function routeFor(target: LinkTarget): string {
  switch (target.kind) {
    case 'question':
      return routes.cc.questions;
    case 'ticket':
      return routes.cc.ticket(target.id);
    case 'social':
      return routes.cc.social(target.id);
    case 'chat':
      return routes.chat(target.id);
    case 'home':
      return routes.home;
  }
}
