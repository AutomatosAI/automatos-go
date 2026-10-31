// A suggestion Auto posted, on Arcade's handheld (PRD-268 §6.5.1, D-ARC-7): where discovery lists
// `suggestions` the post is a 'suggestion' row, and the story draws it as its card's window with its
// AUTO line as the fallback (arcade-story.ts suggestionEntry; StoryEntry.tsx draws ThreadSuggestion
// in an ArcadeWindow). It is one of Auto's replies to the dialogue (autoRowOf): when it is the newest
// after the user's last message, the dialogue says its words as a normal reply and the story keeps
// only the card, so no reply is lost or said twice. Report this stays on the words the dialogue says.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { canSuggestions, type GateInput } from '../../../api/capabilities';
import { CHAT_ID, saved } from '../../../chat/__tests__/thread-fixtures';
import { opened } from '../../../chat/__tests__/view-model-fixtures';
import { reportTarget } from '../../../chat/report/report';
import { StoredMessageSchema, type StoredMessage } from '../../../chat/schemas';
import { threadRows, type ChatRow } from '../../../chat/view-model';
import { ARCADE_HOME_COPY } from '../../strings';
import { dialogueSay, openedChat, sayingOf, type DialogueMemory } from '../arcade-home';
import { autoRowOf, sayingRowKey, storyEntries, type StoryEntry } from '../arcade-story';

const ID = '5b0c3f7e-8a51-4c1f-9d2e-0f6a7b8c9d10';
const TEXT = 'Auto suggests: “Lisbon flights”. Fares drop on Tuesdays.';
const NONE: ReadonlySet<string> = new Set();
const ASKED = saved('u1', 'user', 'Anything for me?');
const REPLY = saved('a1', 'assistant', 'Here it is.');
const LATER = saved('u2', 'user', 'Thanks');
const ANSWER = saved('a2', 'assistant', 'On it.');

const OFFERED: GateInput = { capabilities: ['suggestions'], push: { expo: true } };
const NOT_OFFERED: GateInput = { capabilities: ['brief'], push: { expo: true } };

/** Auto's post of one suggestion, as core posts it: [text, suggestion@1] and its source. */
function post(id = 'm-idea'): StoredMessage {
  return StoredMessageSchema.parse({
    id,
    role: 'assistant',
    parts: [
      { type: 'text', text: TEXT },
      { type: 'suggestion@1', suggestion_id: ID },
    ],
    attachments: [],
    source: { origin: 'suggestion', suggestion_id: ID, label: null },
    createdAt: '2026-10-28T08:00:00.000Z',
  });
}

type State = ReturnType<typeof opened>;

/** The rows Arcade's home reads, gated as useArcadeStory gates them. */
const rowsOf = (state: State, discovery: GateInput = OFFERED) =>
  threadRows(state, { suggestions: canSuggestions(discovery) });

const storyOf = (rows: readonly ChatRow[]) => storyEntries(rows, new Map(), sayingRowKey(rows));

/** What the dialogue says over these rows, the chat having opened as `first`. */
function sayOver(state: State, discovery: GateInput = OFFERED, first: State = state) {
  const rows = rowsOf(state, discovery);
  const memory: DialogueMemory = {
    saying: sayingOf(rows, sayingRowKey(rows)),
    opened: openedChat(openedChat(null, first), state),
  };
  return dialogueSay(state, NONE, memory);
}

/** The words a story entry shows: a reply's, or a suggestion fallback's. */
function wordsOf(entry: StoryEntry): string | null {
  if (entry.kind === 'auto') return entry.words;
  return entry.kind === 'suggestion' ? entry.text.words : null;
}

/** Every reply's words the handheld tells: the story's, then the dialogue's. */
function told(state: State, discovery: GateInput = OFFERED): string[] {
  const story = storyOf(rowsOf(state, discovery)).map(wordsOf);
  const said = sayOver(state, discovery).reply.text;
  return [...story, said].filter((words): words is string => Boolean(words));
}

/** A saved message's words, as the fixtures write them (one text part). */
function textOf(message: StoredMessage): string {
  const part = message.parts.find((each) => each.type === 'text');
  return part?.type === 'text' ? part.text : '';
}

function suggestionEntry(entries: readonly StoryEntry[]) {
  const found = entries.find((entry) => entry.kind === 'suggestion');
  if (found?.kind !== 'suggestion') throw new Error('no suggestion entry');
  return found;
}

describe('a suggestion post in the story', () => {
  const chat = opened([ASKED, post(), LATER, ANSWER]);

  it('is its card’s entry where discovery lists `suggestions`, its AUTO line the fallback', () => {
    const entries = storyOf(rowsOf(chat));
    expect(entries.map((entry) => entry.kind)).toEqual(['you', 'suggestion', 'you', 'auto']);
    const entry = suggestionEntry(entries);
    expect(entry).toMatchObject({ key: 'm-idea', suggestionId: ID });
    expect(entry.text).toMatchObject({ kind: 'auto', key: 'm-idea', words: TEXT, brief: null });
  });

  it('is the AUTO line exactly as before where discovery does not list `suggestions`', () => {
    expect(canSuggestions(NOT_OFFERED)).toBe(false);
    const plain = storyOf(rowsOf(chat, NOT_OFFERED));
    expect(plain.map((entry) => entry.kind)).toEqual(['you', 'auto', 'you', 'auto']);
    expect(suggestionEntry(storyOf(rowsOf(chat))).text).toEqual(plain[1]);
  });

  it('keeps the Deliverables its post made in the fallback, by the post’s key', () => {
    const ref = { id: 'd-1', title: 'Fares', kind: 'document' as const };
    const rows = rowsOf(chat);
    const entry = suggestionEntry(storyEntries(rows, new Map([['m-idea', [ref]]]), null));
    expect(entry.text.items.map((item) => item.title)).toEqual(['Fares']);
  });
});

describe('the dialogue and the story agree on a suggestion post', () => {
  it('the newest reply: the dialogue says its words, the story keeps the card without them', () => {
    const chat = opened([ASKED, REPLY, post()]);
    const rows = rowsOf(chat);
    expect(sayingRowKey(rows)).toBe('m-idea');
    expect(sayingOf(rows, 'm-idea')).toEqual({ messageId: 'm-idea', brief: null });
    const entries = storyOf(rows);
    expect(entries.map(wordsOf)).toEqual([null, 'Here it is.', '']);
    expect(suggestionEntry(entries).suggestionId).toBe(ID);
    const say = sayOver(chat);
    expect(say.reply.text).toBe(TEXT);
    expect(say.reply.id).toBe(`${CHAT_ID}:0:m-idea`);
    expect(say).not.toHaveProperty('brief');
  });

  it('a post into a quiet thread is the dialogue’s reply, never also the story’s words', () => {
    const chat = opened([post()]);
    expect(sayingRowKey(rowsOf(chat))).toBe('m-idea');
    expect(storyOf(rowsOf(chat)).map(wordsOf)).toEqual(['']);
    expect(sayOver(chat).reply.text).toBe(TEXT);
  });

  it('a post before the user’s newest message stays in the story; the dialogue says what follows', () => {
    expect(sayOver(opened([post(), LATER])).reply.text).toBe(ARCADE_HOME_COPY.yourMove);
    expect(storyOf(rowsOf(opened([post(), LATER]))).map(wordsOf)).toEqual([TEXT, null]);
    expect(sayOver(opened([post(), LATER, ANSWER])).reply.text).toBe('On it.');
  });

  it.each([
    ['the newest, after a reply', [ASKED, REPLY, post()]],
    ['alone', [post()]],
    ['before a reply', [ASKED, post(), REPLY]],
    ['older, then a new exchange', [post(), LATER, ANSWER]],
    ['two posts, then a reply', [post('m-1'), post('m-2'), LATER, ANSWER]],
  ])('no reply is lost or said twice (%s)', (_case, messages) => {
    const replies = messages.filter((message) => message.role === 'assistant').map(textOf);
    expect([...told(opened(messages))].sort()).toEqual([...replies].sort());
  });

  it('types a post that lands while the chat is on screen; one it opened with shows whole', () => {
    const chat = opened([ASKED, REPLY, post()]);
    expect(sayOver(chat).reply.whole).toBe(true);
    expect(sayOver(chat, OFFERED, opened([ASKED, REPLY])).reply.whole).toBe(false);
  });

  it('keeps Report this on the words the dialogue says: the post’s Auto row', () => {
    const rows = rowsOf(opened([ASKED, REPLY, post()]));
    const [asked, reply, idea] = rows;
    expect(autoRowOf(asked)).toBeNull();
    expect(autoRowOf(reply)).toBe(reply);
    const row = autoRowOf(idea);
    expect(row?.key).toBe('m-idea');
    expect(row && reportTarget(row, true)).toEqual({ target_type: 'message', target_id: 'm-idea' });
    expect(reportTarget(idea, true)).toBeNull();
  });
});

describe('Arcade’s wiring', () => {
  const read = (file: string) =>
    readFileSync(path.resolve(__dirname, '..', '..', '..', '..', file), 'utf8');

  it('asks for suggestion rows where discovery lists `suggestions`, as Play’s thread does', () => {
    const code = read('src/styles/homes/use-arcade-home.ts');
    expect(code).toMatch(/const suggestions = canSuggestions\(discovery\)/);
    expect(code).toMatch(/threadRows\(state, \{ briefs, suggestions \}\)/);
    expect(code).toMatch(/reportTarget\(sayingAuto, report\.allowed\)/);
  });

  it('draws the post as ThreadSuggestion in an Arcade window, its AUTO entry the fallback', () => {
    const code = read('src/styles/arcade/home/StoryEntry.tsx');
    expect(code).toMatch(/case 'suggestion':\s+return <SuggestionEntry/);
    expect(code).toMatch(/<ThreadSuggestion\s+suggestionId=\{entry\.suggestionId\}/);
    expect(code).toMatch(/frame=\{inWindow\}/);
    expect(code).toMatch(/fallback=\{<AutoEntry \{\.\.\.shared\} entry=\{entry\.text\} \/>\}/);
    expect(code).toMatch(/const inWindow = \(card: ReactNode\) => \(\s+<ArcadeWindow/);
  });
});
