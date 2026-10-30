// The party (PRD-001 §4.6.1 D-ARC-6, US-022l; the design kit's chat/party-rows.ts at 034fa629c and
// the 'Phone 390' PARTY row), pure: the workspace's agents as the chat reads them (GET
// /api/chat/agents, in the order it gives them), each with a state from data the app already
// reads. NEEDS YOU when a needs-you row (review, question, approval, stuck or failed) names the
// agent: the rows name an agent by its name only, so the match is by name, trimmed, in any case;
// WORKING when a Board ticket in progress is the agent's (its column by board.ts, so the web's old
// 'running' counts; a mission's step too: an agent works it); READY otherwise. Each state is a
// glyph and a word in its PRD-268 §6.12.2 role's colour (D-ARC-7, tokens/arcade.ts ARCADE_ROLES:
// ! in quest yellow as needs you, ● in mana blue as working, never the accent, — in the secondary
// text as an idle agent), never the colour alone, and VoiceOver hears 'Scout, needs you'. Each
// agent's robot is its place in the list. Pure: no React, React Native, Expo or Skia.

import type { NeedsYouRows } from '../../../api/needs-you';
import { filterTickets } from '../../../cc/board/board';
import type { BoardTicket } from '../../../cc/board/schemas';
import type { ChatAgent } from '../../../chat/schemas';
import { ARCADE_PARTY_COPY } from '../../strings';

export const PARTY_STATES = Object.freeze(['needs', 'working', 'ready'] as const);
export type PartyState = (typeof PARTY_STATES)[number];

export type PartyMember = {
  readonly id: number;
  readonly name: string;
  readonly state: PartyState;
  /** Its robot: its place in the list, 0 first. */
  readonly look: number;
};

const nameKey = (name: string | null | undefined): string => (name ?? '').trim().toLowerCase();

/** The names the needs-you rows give, as keys; a row with no agent names none. */
export function needyNames(rows: NeedsYouRows): ReadonlySet<string> {
  const { review, question, approval, stuck, failed } = rows;
  const named = [...review, ...question, ...approval, ...stuck, ...failed]
    .map((row) => nameKey(row.agent_name))
    .filter((key) => key.length > 0);
  return new Set(named);
}

/** The ids of the agents whose Board ticket is in progress. */
export function workingIds(tickets: readonly BoardTicket[]): ReadonlySet<number> {
  const ids = filterTickets(tickets, 'in_progress').flatMap((ticket) =>
    ticket.agent === null ? [] : [ticket.agent.id],
  );
  return new Set(ids);
}

function stateOf(
  agent: ChatAgent,
  needy: ReadonlySet<string>,
  working: ReadonlySet<number>,
): PartyState {
  if (needy.has(nameKey(agent.name))) return 'needs';
  return working.has(agent.id) ? 'working' : 'ready';
}

export type PartySources = {
  /** The chat's agents once read; null before (and while the read fails). */
  readonly agents: readonly ChatAgent[] | null;
  /** useNeedsYou's rows (empty before it answers). */
  readonly needsYou: NeedsYouRows;
  /** The Board's rows once its query has answered; null before. */
  readonly board: readonly BoardTicket[] | null;
};

/** The party, in the read's order; none before the agents are read. */
export function partyOf({ agents, needsYou, board }: PartySources): readonly PartyMember[] {
  if (agents === null) return Object.freeze([]);
  const needy = needyNames(needsYou);
  const working = workingIds(board ?? []);
  const members = agents.map((agent, index) =>
    Object.freeze({
      id: agent.id,
      name: agent.name,
      state: stateOf(agent, needy, working),
      look: index,
    }),
  );
  return Object.freeze(members);
}

// ── What the strip shows ─────────────────────────────────────────────────────────────────────

/** A party state's colour, by the palette's variable names. */
export type PartyTone = 'qs' | 'mp' | 'tx2';

/**
 * Each state's colour: its §6.12.2 role's on Arcade (needs you → warning, working → running, an
 * idle agent muted), the design's stCol with working out of the accent (D-ARC-7).
 */
export const PARTY_TONES: Readonly<Record<PartyState, PartyTone>> = Object.freeze({
  needs: 'qs',
  working: 'mp',
  ready: 'tx2',
});

export type PartyBadge = {
  readonly glyph: string;
  /** The state's word (the label face draws it in capitals). */
  readonly word: string;
  readonly tone: PartyTone;
  /** What VoiceOver hears: 'Scout, needs you'. */
  readonly label: string;
};

/** A member's state as the strip shows it and VoiceOver says it. */
export function partyBadge(member: Pick<PartyMember, 'name' | 'state'>): PartyBadge {
  const { glyph, word } = ARCADE_PARTY_COPY.states[member.state];
  return Object.freeze({
    glyph,
    word,
    tone: PARTY_TONES[member.state],
    label: ARCADE_PARTY_COPY.memberLabel(member.name, word),
  });
}
