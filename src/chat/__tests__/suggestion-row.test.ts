// The thread's suggestion card (PRD-268 §6.5.1, §6.12.5): a post with origin 'suggestion' and parts
// [text, suggestion@1] is a 'suggestion' row where the thread draws suggestions, carrying its Auto
// row for the text; it draws the card while the open list has it (not the one pinned above the
// composer), 'Started' after a Start from it, and the text for an unknown or missing suggestion.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { briefMessage } from '../../brief/__tests__/fixtures';
import { briefOf } from '../../brief/model';
import { storyEntries } from '../../styles/homes/arcade-story';
import { suggestion } from '../../suggestions/__tests__/fixtures';
import { threadSuggestionShown } from '../../suggestions/model';
import { threadPlaces } from '../components/thread-look';
import { StoredMessageSchema, type StoredMessage } from '../schemas';
import { threadSuggestionId } from '../suggestion-row';
import { threadRows, type ChatRow } from '../view-model';
import { saved } from './thread-fixtures';
import { opened } from './view-model-fixtures';

const ID = '5b0c3f7e-8a51-4c1f-9d2e-0f6a7b8c9d10';
const TEXT = 'Auto suggests: “Lisbon flights”. Fares drop on Tuesdays.';

function post(extra: { parts?: unknown[]; source?: unknown; role?: string } = {}): StoredMessage {
  return StoredMessageSchema.parse({
    id: 'm-idea',
    role: extra.role ?? 'assistant',
    parts: extra.parts ?? [
      { type: 'text', text: TEXT },
      { type: 'suggestion@1', suggestion_id: ID },
    ],
    attachments: [],
    source: extra.source ?? { origin: 'suggestion', suggestion_id: ID, label: null },
    createdAt: '2026-10-28T08:00:00.000Z',
  });
}

const rowsOf = (messages: StoredMessage[], suggestions = true): ChatRow[] =>
  threadRows(opened(messages), { suggestions });

describe('the wire', () => {
  it('keeps the suggestion@1 part beside the text, and source.suggestion_id', () => {
    const message = post();
    expect(message.parts).toEqual([{ type: 'text', text: TEXT }]);
    expect(message.structured).toEqual([{ type: 'suggestion@1', suggestion_id: ID }]);
    expect(message.source?.suggestion_id).toBe(ID);
  });

  it('still reads the brief beside a suggestion part', () => {
    expect(briefOf(briefMessage())?.greeting).toBe('Morning, Sam.');
    expect(briefOf(post())).toBeNull();
  });
});

describe('the suggestion row', () => {
  it('is the post where the thread draws suggestions, with its Auto row for the text', () => {
    const [row] = rowsOf([post()]);
    expect(row).toMatchObject({ type: 'suggestion', key: 'm-idea', messageId: 'm-idea' });
    if (row?.type !== 'suggestion') throw new Error('not a suggestion row');
    expect(row.suggestionId).toBe(ID);
    expect(row.text).toMatchObject({ type: 'auto', key: 'm-idea', answer: TEXT });
  });

  it('is the Auto row exactly as before where the thread does not draw suggestions', () => {
    const [row] = rowsOf([post()], false);
    expect(row).toMatchObject({ type: 'auto', answer: TEXT });
  });

  it("names the part's suggestion, else the source's; nothing without the part or from a person", () => {
    const sourceOnly = post({
      parts: [{ type: 'text', text: TEXT }, { type: 'suggestion@1' }],
    });
    expect(threadSuggestionId(sourceOnly)).toBe(ID);
    expect(threadSuggestionId(post({ parts: [{ type: 'text', text: TEXT }] }))).toBeNull();
    expect(threadSuggestionId(post({ role: 'user' }))).toBeNull();
    const elsewhere = post({
      parts: [
        { type: 'text', text: TEXT },
        { type: 'suggestion@1', suggestion_id: ' ' },
      ],
      source: { origin: 'daily_digest', suggestion_id: ID },
    });
    expect(threadSuggestionId(elsewhere)).toBeNull();
    expect(rowsOf([saved('m-1', 'assistant', 'Hi.')])[0]?.type).toBe('auto');
  });

  it("sits as Auto's message, under its avatar head", () => {
    const rows = rowsOf([saved('u1', 'user', 'Hi'), post()]);
    expect(threadPlaces(rows)[1]).toMatchObject({ side: 'auto', avatar: 'header' });
  });

  it("is its words on Arcade's story, which draws no card yet", () => {
    const words = (rows: ChatRow[]) =>
      storyEntries(rows, new Map(), null).map((entry) => ('words' in entry ? entry.words : null));
    expect(words(rowsOf([post()]))).toEqual(words(rowsOf([post()], false)));
  });
});

describe('what the row draws', () => {
  const newest = suggestion('s-new', { created_at: '2026-10-29T08:00:00Z' });
  const older = suggestion(ID);

  it('the card while the open list has it', () => {
    expect(threadSuggestionShown([newest, older], ID, null)).toEqual({
      kind: 'card',
      suggestion: older,
    });
  });

  it('its text when the suggestion is unknown, decided or expired (not in the open list)', () => {
    expect(threadSuggestionShown([newest], ID, null)).toEqual({ kind: 'text' });
    expect(threadSuggestionShown([], ID, null)).toEqual({ kind: 'text' });
  });

  it('its text for the one pinned above the composer: one surface offers it', () => {
    expect(threadSuggestionShown([older], ID, null)).toEqual({ kind: 'text' });
  });

  it("'Started. Auto is on it.' in its place after a Start from it", () => {
    expect(threadSuggestionShown([], ID, ID)).toEqual({ kind: 'started' });
    expect(threadSuggestionShown([newest, older], ID, 's-new')).toMatchObject({ kind: 'card' });
  });
});

describe("Studio's and Play's threads", () => {
  const read = (file: string) =>
    readFileSync(path.resolve(__dirname, '..', '..', '..', file), 'utf8');

  it('ask for suggestion rows where discovery lists `suggestions`, and draw them', () => {
    for (const file of ['src/chat/screens/ChatScreen.tsx', 'src/styles/homes/PlayHome.tsx']) {
      const code = read(file);
      expect(code, file).toMatch(/const suggestions = canSuggestions\(discovery\)/);
      expect(code, file).toMatch(/threadRows\(state, \{ briefs, suggestions \}\)/);
    }
    for (const file of ['src/chat/components/MessageList.tsx', 'src/styles/homes/PlayThread.tsx']) {
      const code = read(file);
      expect(code, file).toMatch(/case 'suggestion':\s+return \(\s+<ThreadSuggestion/);
      expect(code, file).toMatch(/suggestionId=\{row\.suggestionId\}/);
      expect(code, file).toMatch(/row=\{row\.text\}/);
    }
  });
});
