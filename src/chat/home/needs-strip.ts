// The home's needs strip (the handoff's 2a, D-HOME), pure: the foundation's useNeedsYou() answer as
// cards. 'NEEDS YOU · N' is the server's total (D26), never a count of the cards: the server lists
// only some rows, and a row this version cannot read is left out by the foundation's parse. Zero
// hides the strip. Each card says its status in a word beside the dot (§4.6), its title in serif
// and a mono meta line ('QUESTION · #0419'); it opens through the foundation's route builders, or
// Studio in the browser where the phone has no screen (the web's needs-you-widget.tsx targets:
// ticketRowHref and askRowHref, mapped by appRouteForWebLink). Questions open the Questions tab;
// tickets in review, stuck or failed open the ticket sheet; a social post its approval (D45).
// Each card also carries its row's agent and time as served (Candy's Today names both, US-023g).
// FOUNDATION GAP: needs-you has no social-post kind (src/api/needs-you.ts; the server's
// services/needs_you.py at the pin lists none), so `social` is the strip's own input and home
// passes none until the foundation parses one.

import type { NeedsYou, NeedsYouAskRow, NeedsYouTicketRow } from '../../api/needs-you';
import { missionHref } from '../../core/web/lib/ticket-links';
import { isTaskId, isUsableId, routes } from '../../navigation/routes';
import { appRouteForWebLink, type WebLinkTarget } from '../../navigation/web-links';
import { joinLabel } from '../../ui/paint';
import type { PipStatus } from '../../ui/variants';
import { NEEDS_COPY } from '../strings';

/** Studio's governance tab, where an approval with no ticket waits (auto-now-rail.tsx). */
export const GOVERNANCE_HREF = '/command-center?tab=governance';
const META_SEPARATOR = ' · ';

export type NeedKind = keyof typeof NEEDS_COPY.kinds;

/** A social post awaiting approval (D45): GET /api/socials/posts/{post_id} opens it. */
export type SocialNeedRow = {
  readonly postId: string;
  readonly title: string | null;
  readonly channel: string | null;
};

export type NeedsStripInput = Pick<NeedsYou, 'total' | 'rows'> & {
  readonly social?: readonly SocialNeedRow[];
};

export type NeedsStripOptions = {
  /** Studio's base URL for a row the phone has no screen for (EXPO_PUBLIC_WEB_URL by default). */
  readonly webUrl?: string;
};

export type StripCard = {
  readonly key: string;
  readonly kind: NeedKind;
  readonly pip: PipStatus;
  /** The status in a word, beside the dot. */
  readonly word: string;
  readonly title: string;
  readonly meta: string;
  /** null when the row names nothing the phone or Studio can open. */
  readonly target: WebLinkTarget | null;
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string | undefined;
  /** The agent the row names (its agent_name, trimmed), or null when it names none. */
  readonly agent: string | null;
  /** When the row started waiting (the server's ISO time), or null when it gives none. */
  readonly at: string | null;
};

export type NeedsStrip = {
  readonly heading: string;
  /** The server's total. */
  readonly count: number;
  readonly cards: readonly StripCard[];
  /** 'Command Centre →': the Board. */
  readonly more: WebLinkTarget;
};

/** A question, an approval or a Mission plan is the orange 'needs you'; a review waits in review. */
const PIPS: Readonly<Record<NeedKind, PipStatus>> = Object.freeze({
  question: 'blocked',
  approval: 'blocked',
  plan: 'blocked',
  social: 'review',
  review: 'review',
  stuck: 'blocked',
  failed: 'failed',
});

type CardFacts = {
  readonly key: string;
  readonly kind: NeedKind;
  readonly title: string;
  readonly detail: string | null;
  readonly target: WebLinkTarget | null;
  /** Who and when, from the row (Candy's Today names both); none for a social post. */
  readonly row?: Pick<NeedsYouTicketRow, 'agent_name' | 'at'>;
};

function card({ key, kind, title, detail, target, row }: CardFacts): StripCard {
  const { meta: kindWord, word } = NEEDS_COPY.kinds[kind];
  const meta = detail ? `${kindWord}${META_SEPARATOR}${detail}` : kindWord;
  return {
    key,
    kind,
    pip: PIPS[kind],
    word,
    title,
    meta,
    target,
    accessibilityLabel: joinLabel(word, title, meta),
    accessibilityHint: target && 'external' in target ? NEEDS_COPY.opensStudio : undefined,
    agent: row?.agent_name?.trim() || null,
    at: row?.at ?? null,
  };
}

function ticketTarget(ticketId: number | null): WebLinkTarget | null {
  return ticketId !== null && isTaskId(String(ticketId))
    ? { app: routes.cc.ticket(ticketId) }
    : null;
}

function ticketCards(
  rows: readonly NeedsYouTicketRow[],
  kind: 'review' | 'stuck' | 'failed',
): StripCard[] {
  return rows.map((row) =>
    card({
      key: `${kind}-${row.ticket_id}`,
      kind,
      title: row.title?.trim() || NEEDS_COPY.untitledTicket,
      detail: row.number ?? row.mission_number,
      target: ticketTarget(row.ticket_id),
      row,
    }),
  );
}

function questionCard(row: NeedsYouAskRow): StripCard {
  const words = row.title?.trim();
  const agent = row.agent_name?.trim();
  const title = words ? (agent ? `${agent}: ${words}` : words) : NEEDS_COPY.untitledQuestion;
  return card({
    key: `question-${row.source}-${row.id}`,
    kind: 'question',
    title,
    detail: row.number,
    target: { app: routes.cc.questions },
    row,
  });
}

/** A Mission's plan opens its Studio page; a grant its ticket, else Studio's governance tab. */
function approvalCard(row: NeedsYouAskRow, webUrl: string | undefined): StripCard {
  if (row.source === 'mission') {
    return card({
      key: `plan-${row.id}`,
      kind: 'plan',
      title: row.mission_title?.trim() || row.title?.trim() || NEEDS_COPY.untitledPlan,
      detail: row.mission_number ?? row.number,
      target: appRouteForWebLink(missionHref(row.id), webUrl),
      row,
    });
  }
  return card({
    key: `approval-${row.id}`,
    kind: 'approval',
    title: row.title?.trim() || NEEDS_COPY.untitledApproval,
    detail: row.number,
    target: ticketTarget(row.ticket_id) ?? appRouteForWebLink(GOVERNANCE_HREF, webUrl),
    row,
  });
}

function socialCard(row: SocialNeedRow): StripCard {
  return card({
    key: `social-${row.postId}`,
    kind: 'social',
    title: row.title?.trim() || NEEDS_COPY.untitledPost,
    detail: row.channel?.trim() || null,
    target: isUsableId(row.postId) ? { app: routes.cc.social(row.postId) } : null,
  });
}

/**
 * The strip for one needs-you answer, or null when the server's total is zero. The cards run
 * what blocks an agent first: questions, approvals, social posts, then reviews, stuck and failed.
 */
export function needsStrip(
  { total, rows, social = [] }: NeedsStripInput,
  { webUrl }: NeedsStripOptions = {},
): NeedsStrip | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  const cards = [
    ...rows.question.map(questionCard),
    ...rows.approval.map((row) => approvalCard(row, webUrl)),
    ...social.map(socialCard),
    ...ticketCards(rows.review, 'review'),
    ...ticketCards(rows.stuck, 'stuck'),
    ...ticketCards(rows.failed, 'failed'),
  ];
  return {
    heading: NEEDS_COPY.heading(total),
    count: total,
    cards,
    more: { app: routes.cc.board },
  };
}
