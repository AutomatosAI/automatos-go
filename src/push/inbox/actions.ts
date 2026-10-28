// What a tap in the inbox does, pure over its ports (the hook binds the client, the router, the
// browser and the Toast): an unread row is marked read on the server (POST /read, the push
// handler's own call) while its target is looked up; then the target opens — a screen through the
// router, Studio's page in the system browser — or its line is shown. Mark all read is one POST
// read-all. A failed mark is logged by kind and changes nothing on screen (the lists are read
// again); nothing throws, and nothing here is retried.

import { isApiError } from '../../api/errors';
import { logger } from '../../lib/logger';
import type { StaleChecks } from '../links/stale';
import { PUSH_INBOX_COPY } from '../strings';
import { inboxOpenFor, type InboxOpen } from './open';
import type { InboxNotification } from './schemas';

export type InboxActionDeps = Readonly<{
  checks: StaleChecks;
  /** POST /api/notifications/{id}/read. */
  markRead: (notificationId: string) => Promise<void>;
  navigate: (route: string) => void;
  /** Linking.openURL behind src/cc/open-studio.ts: false when the phone could not. */
  openBrowser: (url: string) => Promise<boolean>;
  notify: (message: string) => void;
  /** Studio's base URL (the current server's); the foundation's own when not given. */
  webUrl?: string;
}>;

function kindOf(error: unknown): string {
  return isApiError(error) ? error.kind : 'unknown';
}

async function markOnce(row: InboxNotification, deps: InboxActionDeps): Promise<void> {
  if (row.read_at !== null) return;
  try {
    await deps.markRead(row.id);
  } catch (error) {
    logger.debug('[inbox] could not mark a notification read', kindOf(error));
  }
}

async function show(where: InboxOpen, deps: InboxActionDeps): Promise<void> {
  if (where.kind === 'route') {
    deps.navigate(where.route);
    if (where.notice) deps.notify(where.notice);
    return;
  }
  if (where.kind === 'studio') {
    if (!(await deps.openBrowser(where.url))) deps.notify(PUSH_INBOX_COPY.studioFailed);
    return;
  }
  deps.notify(where.notice);
}

/** Opens the row's target and marks it read; where it went. Never throws. */
export async function openInboxRow(
  row: InboxNotification,
  deps: InboxActionDeps,
): Promise<InboxOpen | null> {
  const marked = markOnce(row, deps);
  try {
    const where = await inboxOpenFor(row, deps.checks, deps.webUrl);
    await show(where, deps);
    return where;
  } catch (error) {
    logger.warn('[inbox] a notification could not be opened', kindOf(error));
    return null;
  } finally {
    await marked;
  }
}

/** Every unread row read on the server; true when the server took it. Never throws. */
export async function markAllRead(
  run: () => Promise<void>,
  notify: (message: string) => void,
  failed: (error: unknown) => string,
): Promise<boolean> {
  try {
    await run();
    notify(PUSH_INBOX_COPY.allRead);
    return true;
  } catch (error) {
    notify(failed(error));
    return false;
  }
}
