// PRD-268 in Arcade (D-ARC-7): the day's brief in the dialogue window and the story (arcade-home.ts
// sayingOf, dialogueSay, openedChat; arcade-story.ts storyBrief), the dialogue saying the reply the
// story leaves out when two of Auto's messages follow the user's (sayingTurn), and what Arcade
// draws while a feature is not offered: no brief where discovery does not list `brief`, no approval
// line while no card waits with an ApprovalView. The suggestions' strip is in
// arcade/home/__tests__/next.test.ts.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { canBrief, type GateInput } from '../../../api/capabilities';
import { waitingSheetCard } from '../../../approvals/waiting';
import { VIEW } from '../../../approvals/__tests__/fixtures';
import {
  PROSE,
  WIRE_BRIEF,
  brief as fixtureBrief,
  briefMessage,
} from '../../../brief/__tests__/fixtures';
import { briefDateLabel } from '../../../brief/model';
import { CHAT_ID, saved } from '../../../chat/__tests__/thread-fixtures';
import { opened, streaming } from '../../../chat/__tests__/view-model-fixtures';
import { createThread } from '../../../chat/controller/thread';
import { threadRows, type ChatRow } from '../../../chat/view-model';
import { parseLine, type Frame } from '../../../core/ai-sdk-stream';
import { ARCADE_HOME_COPY } from '../../strings';
import {
  briefWords,
  dialogueSay,
  laterReplyId,
  openedChat,
  sayingOf,
  type DialogueMemory,
} from '../arcade-home';
import { sayingRowKey, storyBrief, storyEntries, type StoryEntry } from '../arcade-story';
import { hudTurn, sayingTurn } from '../hud-turn';
import { TOOL_APPROVAL } from './fixtures';

const said = ARCADE_HOME_COPY;
const NONE: ReadonlySet<string> = new Set();
const NO_PLACES = new Map();
const TODAY = '2026-10-28';
const ASKED = saved('u1', 'user', 'Brief me');
const REPLY = saved('a1', 'assistant', 'Here it is.');
const LATER = saved('u2', 'user', 'Start the first one');
const ANSWER = saved('a2', 'assistant', 'On it.');
const GREETING = WIRE_BRIEF.greeting;

const OFFERED: GateInput = { capabilities: ['brief'], push: { expo: true } };
const NOT_OFFERED: GateInput = { capabilities: ['suggestions'], push: { expo: true } };

/** The rows Arcade's home reads, gated as useArcadeStory gates them. */
const rowsOf = (state: ReturnType<typeof opened>, discovery: GateInput) =>
  threadRows(state, { briefs: canBrief(discovery) });

/** What the dialogue says over these rows, the chat having opened as `first`. */
function sayOver(state: ReturnType<typeof opened>, discovery: GateInput, first = state) {
  const rows = rowsOf(state, discovery);
  const memory: DialogueMemory = {
    saying: sayingOf(rows, sayingRowKey(rows)),
    opened: openedChat(openedChat(null, first), state),
  };
  return dialogueSay(state, NONE, memory);
}

const storyOf = (rows: readonly ChatRow[], today: string | null = TODAY) =>
  storyEntries(rows, NO_PLACES, sayingRowKey(rows), today);

function autoEntries(entries: readonly StoryEntry[]) {
  return entries.filter(
    (entry): entry is Extract<StoryEntry, { kind: 'auto' }> => entry.kind === 'auto',
  );
}

describe('the dialogue says the day’s brief', () => {
  const chat = opened([ASKED, REPLY, briefMessage()]);

  it('says the greeting and Auto’s Read as plain words, and offers OPEN BRIEF', () => {
    const say = sayOver(chat, OFFERED);
    expect(say.reply.text).toBe(`${GREETING}\n${PROSE}`);
    expect(say.reply.id).toBe('brief:m-brief');
    expect(say.reply.streaming).toBe(false);
    expect(say.thinking).toBe(false);
    // OPEN BRIEF shows while the dialogue carries the brief (DialogueControls' onBrief)
    expect(say.brief?.greeting).toBe(GREETING);
    expect(say.brief?.date).toBe(TODAY);
  });

  it('reads the brief’s markdown as plain words, never its marks', () => {
    expect(briefWords({ greeting: '  Morning.  ', prose: '**Two** things:\n\n- the email' })).toBe(
      'Morning.\nTwo things:\nthe email',
    );
    expect(briefWords({ greeting: '', prose: '# Read' })).toBe('Read');
  });

  it('shows a brief already there when the chat opened whole', () => {
    expect(sayOver(chat, OFFERED).reply.whole).toBe(true);
  });

  it('types a brief that lands while the chat is on screen, as a reply typed here does', () => {
    const before = opened([ASKED, REPLY]);
    const say = sayOver(chat, OFFERED, before);
    expect(say.reply.whole).toBe(false);
    expect(say.reply.text).toBe(`${GREETING}\n${PROSE}`);
  });

  it('says the reply again once the user asks something after the brief', () => {
    const after = opened([briefMessage(), LATER, ANSWER]);
    const say = sayOver(after, OFFERED);
    expect(say.reply.text).toBe('On it.');
    expect(say).not.toHaveProperty('brief');
  });

  it('keeps Report this on the brief’s message: the saying row is the brief’s own', () => {
    const rows = rowsOf(chat, OFFERED);
    expect(sayingRowKey(rows)).toBe('m-brief');
    expect(sayingOf(rows, 'm-brief')?.messageId).toBe('m-brief');
  });
});

describe('two of Auto’s messages after the user’s last: the dialogue says the one the story leaves out', () => {
  const NOTE = saved('a3', 'assistant', 'One more **thing**.');
  /** The story's words for each of Auto's rows, and what the dialogue says. */
  function both(state: ReturnType<typeof opened>, discovery: GateInput) {
    const rows = rowsOf(state, discovery);
    const words = autoEntries(storyOf(rows)).map((entry) => [entry.key, entry.words]);
    return { key: sayingRowKey(rows), words, say: sayOver(state, discovery) };
  }

  it('says the newest reply, and the story keeps the first one’s words', () => {
    const { key, words, say } = both(opened([ASKED, REPLY, NOTE]), NOT_OFFERED);
    expect(key).toBe('a3');
    expect(words).toEqual([
      ['a1', 'Here it is.'],
      ['a3', ''],
    ]);
    expect(say.reply.text).toBe('One more thing.');
    expect(say.reply.id).toBe(`${CHAT_ID}:0:a3`);
  });

  it('brief not offered: a brief after the reply is said as its text, and the reply stays in the story', () => {
    const { key, words, say } = both(opened([ASKED, REPLY, briefMessage()]), NOT_OFFERED);
    expect(key).toBe('m-brief');
    expect(words).toEqual([
      ['a1', 'Here it is.'],
      ['m-brief', ''],
    ]);
    expect(say.reply.text).toBe(PROSE);
    expect(say).not.toHaveProperty('brief');
  });

  it('brief offered: the dialogue says the brief, and the reply stays in the story', () => {
    const { key, words, say } = both(opened([ASKED, REPLY, briefMessage()]), OFFERED);
    expect(key).toBe('m-brief');
    expect(words).toEqual([
      ['a1', 'Here it is.'],
      ['m-brief', ''],
    ]);
    expect(say.reply.text).toBe(`${GREETING}\n${PROSE}`);
    expect(say.brief?.date).toBe(TODAY);
  });

  it('brief offered, a reply after the brief: the dialogue says the reply, the brief is a window', () => {
    const rows = rowsOf(opened([ASKED, briefMessage(), NOTE]), OFFERED);
    const [brief, note] = autoEntries(storyOf(rows));
    expect([brief.words, brief.brief?.heading, note.words]).toEqual([
      '',
      `★ ${said.brief.today}`,
      '',
    ]);
    expect(sayOver(opened([ASKED, briefMessage(), NOTE]), OFFERED).reply.text).toBe(
      'One more thing.',
    );
  });

  it('keys a later message on its own: whole when the chat opened with it, typed when it lands', () => {
    const chat = opened([ASKED, REPLY, NOTE]);
    expect(laterReplyId(chat, sayingOf(rowsOf(chat, OFFERED), 'a3'))).toBe('a3');
    expect(laterReplyId(chat, sayingOf(rowsOf(chat, OFFERED), 'a1'))).toBeNull();
    expect(sayOver(chat, NOT_OFFERED).reply.whole).toBe(true);
    expect(sayOver(chat, NOT_OFFERED, opened([ASKED, REPLY])).reply.whole).toBe(false);
  });

  it('leaves HUD’s turn as it was: hudTurn still says the first reply', () => {
    expect(hudTurn(opened([ASKED, REPLY, NOTE])).auto).toBe('Here it is.');
    expect(sayingTurn(opened([ASKED, REPLY, NOTE]), 'a3').auto).toBe('One more thing.');
    expect(sayingTurn(opened([ASKED, REPLY, NOTE]), 'u1').auto).toBe('Here it is.');
  });
});

describe('openedChat: what the chat held when it first showed', () => {
  it('waits while the chat loads, keeps its first messages, and starts again for another chat', () => {
    expect(openedChat(null, createThread('c-1'))).toBeNull();
    const first = openedChat(null, opened([ASKED, REPLY]));
    expect([...(first?.ids ?? [])]).toEqual(['u1', 'a1']);
    expect(openedChat(first, opened([ASKED, REPLY, briefMessage()]))).toBe(first);
    const other = openedChat(first, { ...opened([ANSWER]), chatId: 'c-other' });
    expect(other?.chatId).toBe('c-other');
    expect([...(other?.ids ?? [])]).toEqual(['a2']);
  });
});

describe('a brief in the story', () => {
  it('is a window, never its markdown, when the dialogue is saying something newer', () => {
    const rows = rowsOf(opened([briefMessage(), LATER, ANSWER]), OFFERED);
    const [brief, answer] = autoEntries(storyOf(rows));
    expect(brief.words).toBe('');
    expect(brief.brief).toEqual({
      heading: `★ ${said.brief.today}`,
      greeting: GREETING,
      label: `${said.brief.today}: ${GREETING}`,
      brief: brief.row.brief,
    });
    expect(answer.brief).toBeNull();
  });

  it('names another day’s brief by its date', () => {
    const rows = rowsOf(opened([briefMessage(), LATER, ANSWER]), OFFERED);
    const [brief] = autoEntries(storyOf(rows, '2026-10-29'));
    const dated = `★ ${said.brief.dated(briefDateLabel(TODAY))}`;
    expect(dated).toBe('★ Brief · Wednesday, 28 October');
    expect(brief.brief?.heading).toBe(dated);
    expect(storyBrief(fixtureBrief(), null).heading).toBe(dated);
  });

  it('draws no window for the brief the dialogue says; its words are the dialogue’s', () => {
    const rows = rowsOf(opened([ASKED, REPLY, briefMessage()]), OFFERED);
    const entries = autoEntries(storyOf(rows));
    expect(entries.map((entry) => [entry.key, entry.words, entry.brief])).toEqual([
      ['a1', 'Here it is.', null],
      ['m-brief', '', null],
    ]);
  });
});

/** A tool approval raised live, as the stream reads it; with `view`, it carries ApprovalView@1. */
function raised(view: boolean): Frame {
  const card = { grant_id: 41, action: 'send_email', ...(view ? { approval_view: VIEW } : {}) };
  return parseLine(`d:${JSON.stringify({ type: 'tool-data', data: { tool_approval: card } })}`);
}

describe('nothing is drawn while a feature is not offered', () => {
  it('brief: without `brief` in discovery the rows carry none, the dialogue says the text, the story its markdown', () => {
    expect(canBrief(NOT_OFFERED)).toBe(false);
    expect(canBrief(null)).toBe(false);
    const newest = opened([ASKED, REPLY, briefMessage()]);
    const rows = rowsOf(newest, NOT_OFFERED);
    expect(sayingOf(rows, sayingRowKey(rows))?.brief).toBeNull();
    const say = sayOver(newest, NOT_OFFERED);
    expect(say).not.toHaveProperty('brief');
    expect(say.reply.text).not.toContain(GREETING);
    const older = rowsOf(opened([briefMessage(), LATER, ANSWER]), NOT_OFFERED);
    const [brief] = autoEntries(storyOf(older));
    expect(brief.brief).toBeNull();
    expect(brief.words).toBe(PROSE);
  });

  it('approval: no line while no card waits with an ApprovalView', () => {
    expect(waitingSheetCard(threadRows(opened([ASKED, REPLY])))).toBeNull();
    expect(waitingSheetCard(threadRows(streaming(TOOL_APPROVAL)))).toBeNull();
    expect(waitingSheetCard(threadRows(streaming(raised(false))))).toBeNull();
    expect(waitingSheetCard(threadRows(streaming(raised(true))))?.kind).toBe('tool');
  });
});

describe('the pure modules', () => {
  it.each(['arcade-home.ts', 'arcade-story.ts'])(
    '%s imports no React, React Native, Expo or Skia (D-SHAPE)',
    (file) => {
      const source = readFileSync(path.resolve(__dirname, '..', file), 'utf8');
      expect(source).not.toMatch(/from '(react|react-native[^']*|expo[^']*|@shopify\/[^']*)'/);
    },
  );
});
