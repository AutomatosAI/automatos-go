// Where a notification response that opens no record of its own ends, pure (fix/notification-taps).
// A push never lands on home with nothing to show: whatever cannot be followed — a push that does
// not verify, an unreadable one, another workspace's, an unknown action, a link with no screen on
// the phone, a handler that failed — opens the notifications inbox, where every bell notification
// is (GET /api/notifications, with the person's own credentials), the push's own first when its
// notification_id is a notification's. An unverified push's id only chooses which of the person's
// own rows is shown first: nothing is posted, followed or marked read for it (D-SIGNATURE). A
// reply that cannot be sent opens the question, as before.

import type { WorkspaceRole } from '../../api/workspace';
import { ROLE_COPY } from '../../auth/strings';
import { routes } from '../../navigation/routes';
import { routeFor, targetFor } from '../links/targets';
import { inboxRoute } from '../nav';
import { PUSH_ACTION_COPY } from '../strings';
import type { PushIntent, PushLink } from './intent';

/** Where the response took the person, and the line shown there. */
export type HandledOutcome = Readonly<{ route: string; toast?: string }>;

type Neutral = Extract<PushIntent, { kind: 'neutral' }>;

export type NeutralContext = Readonly<{
  /** The person's role; null until the workspace is read. */
  role: WorkspaceRole | null;
  /** The push's notification_id as received (verified or not): the inbox row to show first. */
  focus: string | null;
  /** The person typed a reply (the 'reply' action), so the line says nothing was sent. */
  replied: boolean;
}>;

export function outcome(route: string, toast?: string): HandledOutcome {
  return Object.freeze(toast ? { route, toast } : { route });
}

/** The question's own screen (the Questions list), whatever the link names. */
function questionRoute(link: PushLink | undefined): string {
  return (link && routeFor(targetFor(link))) || routes.cc.questions;
}

/** Nothing is sent: the inbox, or the question with where to answer it, and a line that says why. */
export function neutralOutcome(intent: Neutral, context: NeutralContext): HandledOutcome {
  switch (intent.reason) {
    case 'unverified':
      return outcome(
        inboxRoute(context.focus),
        context.replied ? PUSH_ACTION_COPY.unverified : PUSH_ACTION_COPY.uncheckedTap,
      );
    case 'other_workspace':
      return outcome(inboxRoute(), PUSH_ACTION_COPY.otherWorkspace);
    case 'cannot_answer':
      // a known role that may not answer is a viewer's; an unknown one may still answer there
      return outcome(
        questionRoute(intent.link),
        context.role ? ROLE_COPY.viewerReadOnly : PUSH_ACTION_COPY.answerHere,
      );
    case 'blank_reply':
      return outcome(questionRoute(intent.link), PUSH_ACTION_COPY.answerHere);
    case 'unknown':
      return outcome(inboxRoute(context.focus));
  }
}

/** A response that could not be read at all: the inbox, and the line that says so. */
export const UNREADABLE_OUTCOME: HandledOutcome = outcome(
  inboxRoute(),
  PUSH_ACTION_COPY.uncheckedTap,
);

/** A handler that failed on its way: the inbox, where the notification still is. */
export const FAILED_OUTCOME: HandledOutcome = outcome(inboxRoute());

/** A verified push whose record has no screen on the phone (or none any more): the inbox. */
export function unroutedRoute(notificationId: string | undefined): string {
  return inboxRoute(notificationId);
}
