// P4 Team (US-023j; team.ts), pure: the chat's agents in the read's order, each in Arcade's party
// state (Needs you when a needs-you row names it, Working when a Board ticket in progress is its
// own, Ready otherwise), active when needing you or working; the line under a name its description
// on one line, else its type in words, else none; its place's gradient; what VoiceOver hears; the
// active row (five at most, the active ones first); the count under the title; nothing before the
// agents are read, and an empty team its own words.

import { describe, expect, it } from 'vitest';

import { NO_NEEDS_YOU, NeedsYouSchema, type NeedsYouRows } from '../../../../api/needs-you';
import { BoardSchema, type BoardTicket } from '../../../../cc/board/schemas';
import { ChatAgentsSchema, type ChatAgent } from '../../../../chat/schemas';
import { partyOf } from '../../../arcade/home/party';
import { statusChipOf } from '../../parts/chips';
import { CANDY_COPY, CANDY_TEAM_COPY } from '../../strings';
import { TEAM, frontRow, lineOf, teamMember, teamOf, typeWords } from '../team';

type AgentFixture = {
  readonly id: number;
  readonly name: string;
  readonly description?: string | null;
  readonly agent_type?: string | null;
};

// The chat's agents as GET /api/chat/agents parses them.
function agents(...fixtures: readonly AgentFixture[]): readonly ChatAgent[] {
  return ChatAgentsSchema.parse({ agents: fixtures }).agents;
}

const agent = (fixture: AgentFixture): ChatAgent => agents(fixture)[0] as ChatAgent;

// A board row as the Board's query parses it, with its agent.
function ticket(id: number, status: string, owner: [number, string] | null): BoardTicket {
  const assigned = owner === null ? null : { id: owner[0], name: owner[1] };
  const row = {
    id,
    title: `Ticket ${id}`,
    status,
    tags: [],
    parent_task_id: null,
    agent: assigned,
  };
  return BoardSchema.parse({ tasks: [row] }).tasks[0] as BoardTicket;
}

// Needs-you's review rows, each naming an agent.
function needing(...names: readonly string[]): NeedsYouRows {
  const review = names.map((agent_name, index) => ({ ticket_id: 100 + index, agent_name }));
  return NeedsYouSchema.parse({ total: names.length, rows: { review } }).rows;
}

const ROSTER = agents(
  { id: 1, name: 'Iris', description: 'Social media lead', agent_type: 'specialized' },
  { id: 2, name: 'Atlas', description: null, agent_type: 'research_analyst' },
  { id: 3, name: 'Juno', description: '  ', agent_type: null },
  { id: 4, name: 'Nova', description: 'Visual\n  designer', agent_type: 'custom' },
);

describe('each agent', () => {
  it('comes in the read’s order, in Arcade’s party state, active when needing you or working', () => {
    const team = teamOf({
      agents: ROSTER,
      needsYou: needing(' atlas '),
      board: [ticket(1, 'in_progress', [4, 'Nova']), ticket(2, 'done', [1, 'Iris'])],
    });
    expect(team?.members.map((member) => member.name)).toEqual(['Iris', 'Atlas', 'Juno', 'Nova']);
    expect(team?.members.map((member) => member.state)).toEqual([
      'ready',
      'needs',
      'ready',
      'working',
    ]);
    expect(team?.members.map((member) => member.active)).toEqual([false, true, false, true]);
    expect(team?.members.map((member) => member.word)).toEqual([
      'Ready',
      'Needs you',
      'Ready',
      'Working',
    ]);
  });

  it('takes the very states Arcade’s party gives the same reads', () => {
    const sources = {
      agents: ROSTER,
      needsYou: needing('Juno'),
      board: [ticket(1, 'running', [1, 'Iris'])],
    };
    expect(teamOf(sources)?.members.map((member) => member.state)).toEqual(
      partyOf(sources).map((member) => member.state),
    );
  });

  it('is Ready while needs-you and the Board have not answered', () => {
    const team = teamOf({ agents: ROSTER, needsYou: NO_NEEDS_YOU.rows, board: null });
    expect(team?.members.every((member) => member.state === 'ready')).toBe(true);
    expect(team?.active).toBe(0);
  });

  it('wears the gradient of its place in the read: 1, 2, 3, 1', () => {
    const team = teamOf({ agents: ROSTER, needsYou: NO_NEEDS_YOU.rows, board: [] });
    expect(team?.members.map((member) => member.set)).toEqual([1, 2, 3, 1]);
  });
});

describe('the line under a name', () => {
  it('is the description on one line, else the type in words, else nothing', () => {
    expect(ROSTER.map(lineOf)).toEqual([
      'Social media lead',
      'Research analyst',
      null,
      'Visual designer',
    ]);
  });

  it('writes a type in words: underscores and dashes as spaces, the first letter capital', () => {
    expect(typeWords('code_architect')).toBe('Code architect');
    expect(typeWords('SYSTEM')).toBe('System');
    expect(typeWords(' data-analyst ')).toBe('Data analyst');
    expect(typeWords('__')).toBeNull();
    expect(typeWords(null)).toBeNull();
  });
});

describe('what VoiceOver hears', () => {
  it('is the name, the line and the state in one line', () => {
    const iris = teamMember(ROSTER[0] as ChatAgent, 0, 'working');
    expect(iris.label).toBe('Iris, Social media lead, working');
    const juno = teamMember(ROSTER[2] as ChatAgent, 2, 'ready');
    expect(juno.label).toBe('Juno, ready');
    const atlas = teamMember(ROSTER[1] as ChatAgent, 1, 'needs');
    expect(atlas.label).toBe('Atlas, Research analyst, needs you');
  });

  it('pairs every state with a glyph on its chip, never colour alone', () => {
    const states = ['needs', 'working', 'ready'] as const;
    const chips = states.map((state) => {
      const member = teamMember(agent({ id: 9, name: 'Echo' }), 0, state);
      return statusChipOf(member.active, member.word);
    });
    expect(chips.map((chip) => `${chip.glyph} ${chip.word}`)).toEqual([
      `${CANDY_COPY.statusGlyph.active} Needs you`,
      `${CANDY_COPY.statusGlyph.active} Working`,
      `${CANDY_COPY.statusGlyph.resting} Ready`,
    ]);
    expect(chips.map((chip) => chip.fill)).toEqual(['chip', 'chip', null]);
  });
});

describe('the active row', () => {
  const eight = agents(
    ...['Iris', 'Atlas', 'Juno', 'Nova', 'Sage', 'Pixel', 'Luna', 'Echo'].map((name, index) => ({
      id: index + 1,
      name,
    })),
  );

  it('holds five at most, the active ones first, each group in the read’s order', () => {
    const team = teamOf({
      agents: eight,
      needsYou: needing('Luna'),
      board: [ticket(1, 'in_progress', [3, 'Juno']), ticket(2, 'in_progress', [8, 'Echo'])],
    });
    expect(team?.front.map((member) => member.name)).toEqual([
      'Juno',
      'Luna',
      'Echo',
      'Iris',
      'Atlas',
    ]);
    expect(team?.front).toHaveLength(TEAM.front);
  });

  it('keeps each agent’s own gradient, whatever its place in the row', () => {
    const team = teamOf({
      agents: eight,
      needsYou: NO_NEEDS_YOU.rows,
      board: [ticket(1, 'in_progress', [8, 'Echo'])],
    });
    expect(team?.front[0]).toMatchObject({ name: 'Echo', set: 2 });
  });

  it('is the whole team when it has five or fewer', () => {
    const members = teamOf({ agents: ROSTER, needsYou: NO_NEEDS_YOU.rows, board: [] })?.members;
    expect(frontRow(members ?? [])).toHaveLength(ROSTER.length);
  });
});

describe('the count under the title', () => {
  it('says how many of the agents are active', () => {
    const team = teamOf({
      agents: ROSTER,
      needsYou: needing('Iris'),
      board: [ticket(1, 'in_progress', [2, 'Atlas'])],
    });
    expect(team).toMatchObject({ active: 2, total: 4, count: '2 of 4 agents active' });
  });

  it('says one agent in the singular', () => {
    const solo = teamOf({
      agents: agents({ id: 1, name: 'Iris' }),
      needsYou: NO_NEEDS_YOU.rows,
      board: [],
    });
    expect(solo?.count).toBe('0 of 1 agent active');
  });
});

describe('before and without agents', () => {
  it('is nothing before the agents are read', () => {
    expect(teamOf({ agents: null, needsYou: needing('Iris'), board: [] })).toBeNull();
  });

  it('is an empty team once the read gives none, which says No agents yet.', () => {
    const team = teamOf({ agents: [], needsYou: NO_NEEDS_YOU.rows, board: null });
    expect(team).toMatchObject({ members: [], front: [], active: 0, total: 0 });
    expect(CANDY_TEAM_COPY.empty).toBe('No agents yet.');
  });
});
