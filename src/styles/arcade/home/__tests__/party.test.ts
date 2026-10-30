// The party (party.ts; the kit's chat/party-rows.ts; D-ARC-6): the chat's agents in the read's
// order, each NEEDS YOU when a needs-you row names it (by name, trimmed, any case), WORKING when a
// Board ticket in progress is its own, READY otherwise; each state a glyph and a word in a colour
// that reads at AA on every palette's grounds; VoiceOver hears 'Scout, needs you'. Nothing before
// the agents are read.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { NO_NEEDS_YOU, NeedsYouSchema, type NeedsYouRows } from '../../../../api/needs-you';
import { BoardSchema, type BoardTicket } from '../../../../cc/board/schemas';
import { ChatAgentsSchema, type ChatAgent } from '../../../../chat/schemas';
import { AA_TEXT, contrastRatio } from '../../../../core/web/lib/look-kit/contrast';
import { PALETTES } from '../../../tokens/arcade-catalogue';
import {
  PARTY_STATES,
  PARTY_TONES,
  needyNames,
  partyBadge,
  partyOf,
  workingIds,
} from '../party';

// The chat's agents as GET /api/chat/agents parses them.
function agents(...names: readonly [number, string][]): readonly ChatAgent[] {
  return ChatAgentsSchema.parse({ agents: names.map(([id, name]) => ({ id, name })) }).agents;
}

// A board row as the Board's query parses it, with its agent.
function ticket(id: number, status: string, agent: [number, string] | null): BoardTicket {
  const owner = agent === null ? null : { id: agent[0], name: agent[1] };
  const row = { id, title: `Ticket ${id}`, status, tags: [], parent_task_id: null, agent: owner };
  return BoardSchema.parse({ tasks: [row] }).tasks[0];
}

// Needs-you's rows as the server sends them, each naming an agent (or none).
function rows(names: { review?: (string | null)[]; question?: (string | null)[] }): NeedsYouRows {
  const ticketRow = (agent_name: string | null, index: number) => ({
    ticket_id: 100 + index,
    agent_name,
  });
  const askRow = (agent_name: string | null, index: number) => ({
    source: 'grant',
    id: `g${index}`,
    agent_name,
  });
  return NeedsYouSchema.parse({
    total: 0,
    rows: {
      review: (names.review ?? []).map(ticketRow),
      question: (names.question ?? []).map(askRow),
    },
  }).rows;
}

const ROSTER = agents([7, 'Scout'], [3, 'Quill'], [12, 'Atlas']);

describe('each agent’s state', () => {
  it('is NEEDS YOU when a needs-you row names it, by name, trimmed, in any case', () => {
    const party = partyOf({
      agents: ROSTER,
      needsYou: rows({ review: ['  scout '], question: [null] }),
      board: [],
    });
    expect(party.map((member) => member.state)).toEqual(['needs', 'ready', 'ready']);
    expect(needyNames(rows({ question: ['QUILL', '', null] }))).toEqual(new Set(['quill']));
  });

  it('is WORKING when a Board ticket in progress is its own (the web’s old running too)', () => {
    const board = [
      ticket(1, 'in_progress', [3, 'Quill']),
      ticket(2, 'running', [12, 'Atlas']),
      ticket(3, 'review', [7, 'Scout']),
      ticket(4, 'done', [7, 'Scout']),
      ticket(5, 'in_progress', null),
    ];
    const party = partyOf({ agents: ROSTER, needsYou: NO_NEEDS_YOU.rows, board });
    expect(party.map((member) => member.state)).toEqual(['ready', 'working', 'working']);
    expect(workingIds(board)).toEqual(new Set([3, 12]));
  });

  it('is WORKING by the ticket’s agent id, never its name', () => {
    const board = [ticket(1, 'in_progress', [99, 'Scout'])];
    const party = partyOf({ agents: ROSTER, needsYou: NO_NEEDS_YOU.rows, board });
    expect(party[0].state).toBe('ready');
  });

  it('says NEEDS YOU over WORKING: what needs you comes first', () => {
    const party = partyOf({
      agents: ROSTER,
      needsYou: rows({ review: ['Quill'] }),
      board: [ticket(1, 'in_progress', [3, 'Quill'])],
    });
    expect(party[1].state).toBe('needs');
  });

  it('is READY before the Board has answered', () => {
    const party = partyOf({ agents: ROSTER, needsYou: NO_NEEDS_YOU.rows, board: null });
    expect(party.every((member) => member.state === 'ready')).toBe(true);
  });
});

describe('the party', () => {
  it('keeps the read’s order, each agent’s robot its place in it', () => {
    const party = partyOf({ agents: ROSTER, needsYou: NO_NEEDS_YOU.rows, board: [] });
    expect(party).toEqual([
      { id: 7, name: 'Scout', state: 'ready', look: 0 },
      { id: 3, name: 'Quill', state: 'ready', look: 1 },
      { id: 12, name: 'Atlas', state: 'ready', look: 2 },
    ]);
    expect(Object.isFrozen(party)).toBe(true);
    expect(Object.isFrozen(party[0])).toBe(true);
  });

  it('is empty before the agents are read, and with none', () => {
    expect(partyOf({ agents: null, needsYou: rows({ review: ['Scout'] }), board: [] })).toEqual([]);
    expect(partyOf({ agents: [], needsYou: NO_NEEDS_YOU.rows, board: [] })).toEqual([]);
  });
});

describe('what the strip shows', () => {
  it('is a glyph and a word for each state, in the design’s colours', () => {
    expect(PARTY_STATES.map((state) => partyBadge({ name: 'Scout', state }))).toEqual([
      { glyph: '!', word: 'Needs you', tone: 'qs', label: 'Scout, needs you' },
      { glyph: '●', word: 'Working', tone: 'ac', label: 'Scout, working' },
      { glyph: '—', word: 'Ready', tone: 'tx2', label: 'Scout, ready' },
    ]);
  });

  it.each(PALETTES.map((palette) => [palette.id, palette] as const))(
    'reads at AA on %s’s page and window grounds',
    (_id, palette) => {
      const colours = palette.colours;
      Object.values(PARTY_TONES).forEach((tone) => {
        [colours.page, colours.win].forEach((ground) =>
          expect(contrastRatio(colours[tone], ground)).toBeGreaterThanOrEqual(AA_TEXT),
        );
      });
    },
  );

  it('party.ts imports no React, React Native, Expo or Skia (D-SHAPE)', () => {
    const source = readFileSync(path.resolve(__dirname, '..', 'party.ts'), 'utf8');
    expect(source).not.toMatch(/from '(react|react-native[^']*|expo[^']*|@shopify\/[^']*)'/);
  });
});
