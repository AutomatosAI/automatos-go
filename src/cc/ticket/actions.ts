// What a person can do on the ticket sheet, pure (D-BOARD, D-ROLES, D31). Approve and Send back
// decide a ticket in Review and are offered only to a role that may approve (roleCan); a viewer
// gets neither. A mission's own card approves its plan through the same route, but the server
// refuses to send it back (its plan is turned down on the mission's page), so it offers Approve
// alone; a mission step is its mission's to decide unless the owner asked to check it (F242), as
// on the web (board-task-viewer.tsx missionDecides). Ask Auto about is always there: it only opens
// a chat with the ticket as its context. The bodies are board/verdict.ts's; the words a decision
// ends with (a toast, or the server's refusal) are here.

import { isApiError, userMessage } from '../../api/errors';
import type { WorkspaceRole } from '../../api/workspace';
import { roleCan } from '../../auth/role';
import { ticketCalled, type Numbered } from '../../core/web/lib/ticket-number';
import type { ApprovalAction, ApproveResult, TicketDetail } from '../board/schemas';
import { approveBody, isVerdictInputError, sendBackBody } from '../board/verdict';
import { TICKET_COPY } from '../strings';

export { approveBody, sendBackBody };

/** The ticket's own card for a mission (its plan), and one step of a mission. */
const MISSION_CARD = 'orchestration';
const MISSION_STEP = 'orchestration_task';
/** A mission step the owner asked to check is theirs to decide (PRD-252 R3 'asked'). */
const OWNER_ASKED = 'asked';
const MISSION_PLAN = 'mission_plan';

export type TicketActions = {
  readonly approve: boolean;
  readonly sendBack: boolean;
  readonly askAuto: true;
};

type ActionFields = Pick<TicketDetail, 'status' | 'source_type' | 'review_reason'>;

/** Its mission decides it: a step in Review the owner did not ask to check. */
function missionDecides(ticket: ActionFields): boolean {
  return ticket.source_type === MISSION_STEP && ticket.review_reason !== OWNER_ASKED;
}

/** Which actions the sheet shows for this ticket and this role. */
export function ticketActions(
  ticket: ActionFields,
  role: WorkspaceRole | null | undefined,
): TicketActions {
  const decides = ticket.status === 'review' && roleCan(role, 'approve') && !missionDecides(ticket);
  return {
    approve: decides,
    sendBack: decides && ticket.source_type !== MISSION_CARD,
    askAuto: true,
  };
}

/** A ticket in Review that this role may not decide: the sheet says who does (D-ROLES). */
export function readOnlyNote(
  ticket: ActionFields,
  role: WorkspaceRole | null | undefined,
): string | null {
  return ticket.status === 'review' && role && !roleCan(role, 'approve')
    ? TICKET_COPY.readOnly
    : null;
}

export type ApproveWords = { readonly label: string; readonly effect: string };

type ApproveFields = ActionFields & { readonly planning_data?: TicketDetail['planning_data'] };

function actionWords(action: ApprovalAction | null | undefined): ApproveWords {
  if (action?.type === 'publish_blog') {
    return { label: TICKET_COPY.approve.publish, effect: TICKET_COPY.effect.publish };
  }
  if (action?.type === 'create_blog') {
    const topic = action.topic?.trim();
    return {
      label: TICKET_COPY.approve.startPost,
      effect: topic ? TICKET_COPY.effect.startPostOn(topic) : TICKET_COPY.effect.startPost,
    };
  }
  return { label: TICKET_COPY.approve.done, effect: TICKET_COPY.effect.done };
}

/** The Approve button names what approving does, and the line above it says so (approval-effect.ts). */
export function approveWords(ticket: ApproveFields): ApproveWords {
  if (ticket.source_type === MISSION_CARD && ticket.review_reason === MISSION_PLAN) {
    return { label: TICKET_COPY.approve.plan, effect: TICKET_COPY.effect.plan };
  }
  return actionWords(ticket.planning_data?.approval_action);
}

type ActionResult = NonNullable<ApproveResult['action_result']>;

/** What an approval's action did (publish_blog, create_blog), or null for none of those. */
function actionMessage(done: ActionResult): string | null {
  const title = done.title?.trim();
  const topic = done.topic?.trim();
  if (done.type === 'publish_blog') {
    return title ? TICKET_COPY.approved.publishedTitle(title) : TICKET_COPY.approved.published;
  }
  if (done.type === 'create_blog') {
    return topic ? TICKET_COPY.approved.startedOn(topic) : TICKET_COPY.approved.started;
  }
  return null;
}

/** The toast after an approval: the server's own words when it sent any, else what happened. */
export function approvedMessage(result: ApproveResult | undefined, ticket: Numbered): string {
  const said = result?.message?.trim();
  if (said) return said;
  const done = result?.action_result;
  return (
    (done ? actionMessage(done) : null) ?? TICKET_COPY.approved.done(ticketCalled(ticket, true))
  );
}

/** The toast after a Send back, naming the agent who redoes it. */
export function sentBackMessage(agentName: string | null | undefined): string {
  return TICKET_COPY.sentBack(agentName?.trim() || TICKET_COPY.theAgent);
}

/**
 * The verdict routes refuse in words (api/board_tasks.py, board_card_moves.py, send_back_rules.py):
 * 409 for a decision taken elsewhere or a mission's card, 422 for a ticket not in Review, with no
 * agent, or already decided. The foundation's userMessage shows a server's words on 409 only.
 */
const REFUSALS_IN_WORDS: ReadonlySet<number> = new Set([409, 422]);

/** Why a verdict did not go through: the note's own words, the server's, or the taxonomy's. */
export function refusalMessage(error: unknown): string {
  if (isVerdictInputError(error)) return error.message;
  if (isApiError(error) && error.serverMessage && REFUSALS_IN_WORDS.has(error.status ?? 0)) {
    return error.serverMessage;
  }
  return userMessage(error);
}

// ── The verdict panel ───────────────────────────────────────────────────────────────────────

/** Idle shows Send back and Approve; Send back opens the note, which must have words. */
export type VerdictMode = 'idle' | 'note';

export type VerdictButton = {
  readonly label: string;
  readonly disabled: boolean;
};

export type VerdictView = {
  /** The note field, open while sending back; its error once the words would be refused. */
  readonly note: { readonly open: boolean; readonly error: string | null };
  /** Left: Send back (opens the note) or Cancel (closes it); null when Send back is not offered. */
  readonly secondary: VerdictButton | null;
  /** Right: Approve, or Send back while the note is open; null when neither is offered. */
  readonly primary: VerdictButton | null;
};

function noteError(note: string): string | null {
  if (!note.trim()) return null; // blank is a disabled button, not an error before any words
  const checked = sendBackBody(note);
  return checked.ok ? null : checked.message;
}

/** The buttons and note for this mode; while a call is out, every control is disabled. */
export function verdictView(
  actions: TicketActions,
  mode: VerdictMode,
  note: string,
  busy: boolean,
  approveLabel: string,
): VerdictView {
  if (mode === 'note' && actions.sendBack) {
    return {
      note: { open: true, error: noteError(note) },
      secondary: { label: TICKET_COPY.cancel, disabled: busy },
      primary: { label: TICKET_COPY.sendBack, disabled: busy || !sendBackBody(note).ok },
    };
  }
  return {
    note: { open: false, error: null },
    secondary: actions.sendBack ? { label: TICKET_COPY.sendBack, disabled: busy } : null,
    primary: actions.approve ? { label: approveLabel, disabled: busy } : null,
  };
}
