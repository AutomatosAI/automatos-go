// Where an inbox row opens, pure over the stale checks (links/stale.ts): the same screen its push
// would (a ticket, a chat, Questions, a social post; an approval or a Mission plan in the chat its
// card sits in, D30), checked first, with the same notice when the record has moved on. A row whose
// record has no screen on the phone opens Studio's page for it in the system browser (an approval:
// the governance tab; a Mission: its page — the home needs strip's own targets), and a row that
// names nothing says so. Never throws: a failed check opens the target unchecked, as a push does.

import { missionHref } from '../../core/web/lib/ticket-links';
import { GOVERNANCE_HREF } from '../../chat/home/needs-strip';
import { studioUrl } from '../../navigation/web-links';
import { resolveTarget, type StaleChecks } from '../links/stale';
import { targetFor, type LinkTarget } from '../links/targets';
import { PUSH_INBOX_COPY } from '../strings';
import type { InboxNotification } from './schemas';

export type InboxOpen =
  | Readonly<{ kind: 'route'; route: string; notice?: string }>
  | Readonly<{ kind: 'studio'; url: string }>
  | Readonly<{ kind: 'none'; notice: string }>;

/** The row's link as a push's (an absent or blank field left out). */
export function linkOf(row: Pick<InboxNotification, 'link_type' | 'link_id'>): LinkTarget {
  const link_type = row.link_type?.trim() || undefined;
  const link_id = row.link_id?.trim() || undefined;
  return targetFor({ ...(link_type && { link_type }), ...(link_id && { link_id }) });
}

/** Studio's page for a record the phone has no screen for; null for any other. */
function studioPathOf(target: LinkTarget): string | null {
  if (target.kind === 'approval') return GOVERNANCE_HREF;
  if (target.kind === 'mission') return missionHref(target.id);
  return null;
}

export async function inboxOpenFor(
  row: Pick<InboxNotification, 'link_type' | 'link_id'>,
  checks: StaleChecks,
  webUrl?: string,
): Promise<InboxOpen> {
  const target = linkOf(row);
  const resolved = await resolveTarget(target, checks);
  if (resolved.route !== null) {
    return Object.freeze({
      kind: 'route',
      route: resolved.route,
      ...(resolved.notice && { notice: resolved.notice }),
    });
  }
  if (resolved.notice) return Object.freeze({ kind: 'none', notice: resolved.notice });
  const path = studioPathOf(target);
  const url = path === null ? null : studioUrl(path, webUrl);
  if (url) return Object.freeze({ kind: 'studio', url });
  return Object.freeze({ kind: 'none', notice: PUSH_INBOX_COPY.nothingToOpen });
}
