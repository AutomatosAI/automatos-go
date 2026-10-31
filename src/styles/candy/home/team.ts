// P4 Team in Candy (PRD-001 §4.6.2 D-CAN-6, US-023j; CANDY-LAYOUT §4 P4 and the 390 mock; the
// design kit's agents/roster.ts at 3920359d5), pure: each agent as a row says it, the active row
// and the count under the title. The agents are the chat's read (src/chat/api.ts agentsQuery, GET
// /api/chat/agents) in the order it gives them, as Arcade's party reads them; no new endpoint. The
// components only draw.
//
//   Each agent's state is Arcade's party rule (arcade/home/party.ts): Needs you when a needs-you
//   row names it, Working when a Board ticket in progress is its own, Ready otherwise. 'Active' is
//   Needs you or Working (the design's '● Active / ○ Inactive' has no source in the read,
//   repoContradictions). The line under a name is its description on one line, else its agent_type
//   in words ('code_architect' is 'Code architect'), else nothing (the read carries no job title).
//   An agent keeps the gradient of its place in the read (sets.ts cardSetOf), as the kit's roster
//   does. VoiceOver hears 'Iris, Social media lead, working'.
//   The active row holds up to five, the active ones first, each group in the read's order.
// Pure: no React, React Native, Expo or Skia.

import type { NeedsYouRows } from '../../../api/needs-you';
import type { BoardTicket } from '../../../cc/board/schemas';
import type { ChatAgent } from '../../../chat/schemas';
import { needyNames, stateOf, workingIds, type PartyState } from '../../arcade/home/party';
import { cardSetOf, type CardSet } from '../sets';
import { CANDY_TEAM_COPY } from '../strings';

/**
 * The P4 mock's measures, in points: the band, the column under the top inset and its gaps; the
 * active row (at most five, 66 pt ringed avatars in 72 pt columns, 10 apart, the name 6 under); the
 * list (6 × 14 inside the window, rows at least 58 tall, a 40 pt avatar, 12 between the parts).
 */
export const TEAM = Object.freeze({
  band: 300,
  top: 8,
  gap: 16,
  headerGap: 12,
  lineGap: 6,
  front: 5,
  frontAvatar: 66,
  frontColumn: 72,
  frontGap: 10,
  frontNameGap: 6,
  listPadV: 6,
  listPadH: 14,
  rowHeight: 58,
  rowAvatar: 40,
  rowGap: 12,
});

export type TeamMember = {
  readonly id: number;
  readonly name: string;
  readonly state: PartyState;
  /** Needs you or Working. */
  readonly active: boolean;
  /** The state in words: 'Needs you', 'Working' or 'Ready'. */
  readonly word: string;
  /** Under the name: its description on one line, else its type in words; null for neither. */
  readonly line: string | null;
  /** The gradient of its place in the read. */
  readonly set: CardSet;
  /** What VoiceOver hears: 'Iris, Social media lead, working'. */
  readonly label: string;
};

export type Team = {
  /** Every agent, in the read's order. */
  readonly members: readonly TeamMember[];
  /** The active row: up to five, the active ones first. */
  readonly front: readonly TeamMember[];
  readonly active: number;
  readonly total: number;
  /** '6 of 8 agents active'. */
  readonly count: string;
};

const oneLine = (text: string | null): string => (text ?? '').replace(/\s+/g, ' ').trim();

/** An agent_type in words: 'code_architect' is 'Code architect'; null for none. */
export function typeWords(agentType: string | null): string | null {
  const words = oneLine((agentType ?? '').replace(/[_-]+/g, ' ')).toLowerCase();
  return words ? `${words[0]?.toUpperCase() ?? ''}${words.slice(1)}` : null;
}

/** The line under a name: its description on one line, else its type in words, else null. */
export function lineOf(agent: Pick<ChatAgent, 'description' | 'agent_type'>): string | null {
  return oneLine(agent.description) || typeWords(agent.agent_type);
}

/** One agent as Team shows it, at `index` in the read. */
export function teamMember(agent: ChatAgent, index: number, state: PartyState): TeamMember {
  const word = CANDY_TEAM_COPY.states[state];
  const line = lineOf(agent);
  return Object.freeze({
    id: agent.id,
    name: agent.name,
    state,
    active: state !== 'ready',
    word,
    line,
    set: cardSetOf(index),
    label: CANDY_TEAM_COPY.memberLabel(agent.name, line, word),
  });
}

/** The active row: the active members first, then the rest, each in the read's order; five at most. */
export function frontRow(members: readonly TeamMember[]): readonly TeamMember[] {
  const ordered = [
    ...members.filter((member) => member.active),
    ...members.filter((member) => !member.active),
  ];
  return Object.freeze(ordered.slice(0, TEAM.front));
}

export type TeamSources = {
  /** The chat's agents once read; null before (and while the read fails). */
  readonly agents: readonly ChatAgent[] | null;
  /** useNeedsYou's rows (empty before it answers). */
  readonly needsYou: NeedsYouRows;
  /** The Board's rows once its query has answered; null before. */
  readonly board: readonly BoardTicket[] | null;
};

/** Team from the reads; null until the agents are read. */
export function teamOf({ agents, needsYou, board }: TeamSources): Team | null {
  if (agents === null) return null;
  const needy = needyNames(needsYou);
  const working = workingIds(board ?? []);
  const members = Object.freeze(
    agents.map((agent, index) => teamMember(agent, index, stateOf(agent, needy, working))),
  );
  const active = members.filter((member) => member.active).length;
  return Object.freeze({
    members,
    front: frontRow(members),
    active,
    total: members.length,
    count: CANDY_TEAM_COPY.count(active, members.length),
  });
}
