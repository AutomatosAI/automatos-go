// arcade-home.ts (US-022g): what the dialogue window says over A2's thread, today's counters from
// the numbers the app already has, and where each D-pad target goes.

import { describe, expect, it } from 'vitest';

import {
  AT,
  CHAT_ID,
  OTHER_CHAT_ID,
  afterTurn,
  saved,
} from '../../../chat/__tests__/thread-fixtures';
import { opened } from '../../../chat/__tests__/view-model-fixtures';
import { createThread, threadReducer, type ThreadAction } from '../../../chat/controller/thread';
import { CHAT_COPY } from '../../../chat/strings';
import { BOARD_TICKET_FIELDS, BoardSchema, type BoardTicket } from '../../../cc/board/schemas';
import { routes } from '../../../navigation/routes';
import { ARCADE_PRESET_LOOKS } from '../../arcade/look-schema';
import { ARCADE_HOME_COPY } from '../../strings';
import { arcadeVars, type ArcadeVarName } from '../../tokens/arcade';
import {
  arcadeCounters,
  dialogueKey,
  dialogueSay,
  padAction,
  questCount,
  withTyped,
} from '../arcade-home';
import { FINISHED, SEND, frame } from './fixtures';

const NONE: ReadonlySet<string> = new Set();
const apply = (...actions: ThreadAction[]) => actions.reduce(threadReducer, opened());
const asked = saved('u1', 'user', 'Find me a laptop');
const replied = saved('a1', 'assistant', 'Three **picks**.');

describe('the dialogue window', () => {
  it('says nothing while the chat opens, and the greeting on a blank draft, whole', () => {
    const opening = dialogueSay(createThread(CHAT_ID), NONE);
    expect(opening).toEqual({
      reply: { id: 'loading', text: '', streaming: false, whole: true },
      thinking: false,
    });
    const draft = dialogueSay(createThread(null), NONE);
    expect(draft.reply).toMatchObject({ text: ARCADE_HOME_COPY.greeting, whole: true });
    expect(draft.thinking).toBe(false);
  });

  it("says '…' while a turn runs with no words yet, keyed by its turn", () => {
    const say = dialogueSay(apply(SEND), NONE);
    expect(say.thinking).toBe(true);
    expect(say.reply).toEqual({ id: `${CHAT_ID}:0`, text: '', streaming: true, whole: false });
  });

  it('types the reply as it streams, and its saved copy is the same reply, typed once', () => {
    const live = apply(SEND, frame({ kind: 'text', text: 'Three **picks**' }));
    const typed = withTyped(NONE, live);
    expect([...typed]).toEqual([`${CHAT_ID}:0`]);
    expect(dialogueSay(live, typed).reply).toEqual({
      id: `${CHAT_ID}:0`,
      text: 'Three picks',
      streaming: true,
      whole: false,
    });
    const retired = [FINISHED, ...afterTurn([asked, replied])].reduce(threadReducer, live);
    expect(retired.live).toBeNull();
    expect(dialogueKey(retired)).toBe(`${CHAT_ID}:0`);
    expect(dialogueSay(retired, withTyped(typed, retired))).toEqual({
      reply: { id: `${CHAT_ID}:0`, text: 'Three picks.', streaming: false, whole: false },
      thinking: false,
    });
  });

  it('shows a reply already there when the chat opened whole, and never borrows another chat’s turn', () => {
    const state = opened([saved('u0', 'user', 'Hi'), saved('a0', 'assistant', 'Hello.'), asked, replied]);
    expect(dialogueSay(state, NONE).reply).toEqual({
      id: `${CHAT_ID}:2`,
      text: 'Three picks.',
      streaming: false,
      whole: true,
    });
    const typedElsewhere = new Set([`${OTHER_CHAT_ID}:2`]);
    expect(dialogueSay(state, typedElsewhere).reply.whole).toBe(true);
  });

  it("says 'Your move.' after a message no reply came to", () => {
    const say = dialogueSay(opened([asked]), NONE);
    expect(say.reply).toMatchObject({ text: ARCADE_HOME_COPY.yourMove, whole: true });
  });

  it("says a stopped or failed turn in A2's own words, typed", () => {
    const stopped = apply(SEND, { type: 'stopped', at: AT });
    expect(dialogueSay(stopped, withTyped(NONE, stopped)).reply).toMatchObject({
      text: CHAT_COPY.stopped,
      streaming: false,
      whole: false,
    });
  });

  it('remembers a turn once: the same set back while nothing new was seen', () => {
    const live = apply(SEND);
    const typed = withTyped(NONE, live);
    expect(withTyped(typed, live)).toBe(typed);
    expect(withTyped(typed, opened([asked, replied]))).toBe(typed);
    expect(withTyped(NONE, createThread(null))).toBe(NONE);
  });
});

// A board row as the Board's query parses it, trimmed to what the counters read.
function ticket(id: number, status: string, overrides: Record<string, unknown> = {}): BoardTicket {
  const row = { id, title: `Ticket ${id}`, status, tags: [], parent_task_id: null, ...overrides };
  return BoardSchema.parse({ tasks: [row] }).tasks[0];
}

describe('the status bar’s counters (D-ARC-6)', () => {
  const board = [
    ticket(1, 'in_progress'),
    ticket(2, 'running'), // the web's old alias, in the same column
    ticket(3, 'in_progress', { parent_task_id: 1 }), // a mission step: nested under its card
    ticket(4, 'review'),
    ticket(5, 'done'),
  ];

  it("QUEST is the Board's In progress count, top-level tickets only", () => {
    expect(questCount(board)).toBe(2);
    expect(questCount([])).toBe(0);
  });

  it('! is needs-you’s number and QUEST the Board’s, each left out until it has answered', () => {
    expect(arcadeCounters({ needs: 3, board })).toEqual({ xp: null, needs: 3, quest: 2 });
    expect(arcadeCounters({ needs: null, board: null })).toEqual({
      xp: null,
      needs: null,
      quest: null,
    });
  });

  it('XP is left out: a Board row carries no completion time to count today’s by', () => {
    expect(Object.keys(BOARD_TICKET_FIELDS)).not.toContain('completed_at');
    expect(arcadeCounters({ needs: 0, board }).xp).toBeNull();
  });
});

describe('the D-pad (D-ARC-6)', () => {
  it('▲ Quests shows the map in the screen, ▶ Inventory the Deliverables, ▼ Menu the header menu', () => {
    expect(padAction('quests', routes.home)).toEqual({ kind: 'screen', screen: 'quests' });
    expect(padAction('quests', routes.chat(CHAT_ID), 'quests')).toEqual({
      kind: 'screen',
      screen: 'quests',
    });
    expect(padAction('inventory', routes.home)).toEqual({
      kind: 'go',
      route: routes.cc.deliverables,
    });
    expect(padAction('menu', routes.home)).toEqual({ kind: 'menu' });
  });

  it('◀ Chat is the home: here already on home, back to it from a conversation', () => {
    expect(padAction('chat', routes.home)).toEqual({ kind: 'here' });
    expect(padAction('chat', routes.chat(CHAT_ID))).toEqual({ kind: 'home', route: routes.home });
  });

  it('◀ Chat shows the chat again in the screen over Quests, on home or in a conversation', () => {
    const chat = { kind: 'screen', screen: 'chat' };
    expect(padAction('chat', routes.home, 'quests')).toEqual(chat);
    expect(padAction('chat', routes.chat(CHAT_ID), 'quests')).toEqual(chat);
    expect(padAction('chat', routes.home, 'chat')).toEqual({ kind: 'here' });
  });
});

describe('the home in all five palettes', () => {
  // what the status bar, the story, the dialogue and the controls paint with (tokens only, D-TOKENS)
  const READ: readonly ArcadeVarName[] = [
    'page', 'win', 'bar', 'barTx', 'tx', 'tx2', 'bd', 'ac', 'aci',
    'hl', 'hlt', 'xp', 'qs', 'mp', 'hp', 'sh',
  ];

  it('every preset gives each colour the home reads', () => {
    expect(new Set(ARCADE_PRESET_LOOKS.map((look) => look.palette)).size).toBe(5);
    ARCADE_PRESET_LOOKS.forEach((look) => {
      const vars = arcadeVars(look);
      READ.forEach((name) => expect(vars[name], `${look.palette} ${name}`).toMatch(/^#|^rgba?\(/));
    });
  });
});
