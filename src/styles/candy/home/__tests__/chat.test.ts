// P2 Chat (US-023h), pure: A2's rows as the Chat view's entries — the user's bubble, Auto's reply
// with its tool chips (its receipts, else its tool lines), its Deliverables in their kinds'
// gradients, A2's own cards, the writing chip while A2's isWorking has no words — and the stage's
// title, state pill and back, and what the voice window over the box shows on this view.

import { describe, expect, it } from 'vitest';

import { AT, saved } from '../../../../chat/__tests__/thread-fixtures';
import {
  WEB,
  apply,
  opened,
  receipt,
  streaming,
} from '../../../../chat/__tests__/view-model-fixtures';
import { LIVE_AUTO_KEY, threadRows, type AutoRow, type ChatRow } from '../../../../chat/view-model';
import type { VoiceLine } from '../../../../voice/screen/core-props';
import { SEARCH_END, SEARCH_START, TOOL_APPROVAL, madeDocument } from '../../../homes/__tests__/fixtures';
import { userWords } from '../../../homes/play-thread';
import { EMPTY_SHELF, LOOSE_REPORTS, fileReports, placeReports } from '../../../homes/shelf';
import { CANDY_CHAT_COPY } from '../../strings';
import {
  chatEntries,
  chatTitle,
  chatViewVoice,
  deliverableRow,
  stageBack,
  statePill,
  toolChipsOf,
  type ChatEntry,
} from '../chat';

const said = CANDY_CHAT_COPY;
const NO_PLACES = new Map();

const entriesOf = (rows: readonly ChatRow[]) => chatEntries(rows, NO_PLACES);
const kinds = (entries: readonly ChatEntry[]) => entries.map((entry) => entry.kind);

function autoEntries(entries: readonly ChatEntry[]) {
  return entries.filter(
    (entry): entry is Extract<ChatEntry, { kind: 'auto' }> => entry.kind === 'auto',
  );
}

function autoRowOf(rows: readonly ChatRow[]): AutoRow {
  const row = rows.find((each) => each.type === 'auto');
  if (row?.type !== 'auto') throw new Error('expected Auto’s row');
  return row;
}

describe('the entries', () => {
  it("are A2's rows, oldest first: the user's bubble and Auto's reply with his words", () => {
    const chat = opened([
      saved('u1', 'user', 'Pull together a launch post'),
      saved('a1', 'assistant', 'Love it. **Here** is the first draft.'),
    ]);
    const entries = entriesOf(threadRows(chat));
    expect(kinds(entries)).toEqual(['you', 'auto']);
    expect(entries[0]).toMatchObject({ kind: 'you', key: 'u1', text: 'Pull together a launch post' });
    const [auto] = autoEntries(entries);
    expect(auto.row.answer).toBe('Love it. **Here** is the first draft.');
    expect(auto.row.messageId).toBe('a1');
    expect(auto.chips).toEqual([]);
    expect(auto.deliverables).toEqual([]);
  });

  it("the user's bubble names the files that went with the words, as Play's does", () => {
    const state = apply(opened(), {
      type: 'send',
      draft: { text: 'Here', files: [{ attachmentId: 'f1', filename: 'notes.pdf', mediaType: 'application/pdf' }], sentAt: AT },
    });
    const [you] = entriesOf(threadRows(state));
    expect(you).toMatchObject({ kind: 'you', text: userWords({ text: 'Here', files: ['notes.pdf'] }) });
  });

  it("is the writing chip while A2's isWorking has no words yet, and none once they come", () => {
    const sent = apply(opened(), { type: 'send', draft: { text: 'Status?', files: [], sentAt: AT } });
    expect(kinds(entriesOf(threadRows(sent)))).toEqual(['you', 'writing']);
    const writing = streaming({ kind: 'text', text: 'On it' });
    expect(kinds(entriesOf(threadRows(writing)))).not.toContain('writing');
  });

  it("keeps A2's notice under the thread as an entry of its own", () => {
    const stopped = apply(streaming({ kind: 'text', text: 'Half' }), { type: 'stopped', at: AT });
    const rows = threadRows(stopped);
    const notice = rows.find((row) => row.type === 'notice');
    if (notice?.type !== 'notice') throw new Error('expected the stopped notice');
    expect(entriesOf(rows).at(-1)).toEqual({ kind: 'notice', key: notice.key, notice: notice.notice });
  });

  it("leaves A2's cards in the reply that raised them, and those whose reply never came at the end", () => {
    const raised = streaming(TOOL_APPROVAL);
    const [auto] = autoEntries(entriesOf(threadRows(raised)));
    expect(auto.row.cards.map((card) => card.kind)).toEqual(['tool']);
    const [card] = auto.row.cards;
    const loose: ChatRow = { type: 'cards', key: 'loose-cards', cards: [card] };
    expect(entriesOf([loose])).toEqual([
      { kind: 'loose', key: 'loose-cards', cards: [card], deliverables: [] },
    ]);
  });
});

describe('the tool chips', () => {
  it('a finished call is ✓ in A2’s words and spoken label; one still running is ●', () => {
    const running = toolChipsOf(autoRowOf(threadRows(streaming(SEARCH_START))));
    expect(running).toHaveLength(1);
    expect(running[0]).toMatchObject({ tone: 'running', glyph: said.chipGlyph.running, link: null });
    const done = autoRowOf(threadRows(streaming(SEARCH_START, SEARCH_END)));
    const [chip] = toolChipsOf(done);
    const [line] = done.toolLines;
    expect(chip).toEqual({
      key: line.key,
      tone: 'done',
      glyph: '✓',
      text: line.text,
      label: line.accessibilityLabel,
      link: null,
    });
  });

  it('a failed call is ✕; a skipped one and one waiting on its card show none', () => {
    const line = (tone: AutoRow['toolLines'][number]['tone']) => ({
      key: tone,
      mark: null,
      tone,
      text: `A call ${tone}`,
      accessibilityLabel: tone,
    });
    const chips = toolChipsOf({
      toolLines: [line('failed'), line('muted'), line('waiting'), line('done')],
      receipts: null,
    });
    expect(chips.map((chip) => [chip.tone, chip.glyph])).toEqual([
      ['failed', '✕'],
      ['done', '✓'],
    ]);
  });

  it('a reply with receipts says them instead (the kit’s rule): done ✓ with its link, refused ✕ without', () => {
    const state = streaming(SEARCH_START, SEARCH_END, {
      kind: 'receipts',
      receipts: [
        receipt({ link: '/missions/m-1' }),
        receipt({ status: 'refused', reason: 'No access', link: '/missions/m-1' }),
        receipt({ status: 'skipped' }),
        receipt({ status: 'waiting' }),
      ],
    });
    const row = autoRowOf(threadRows(state, { webUrl: WEB }));
    expect(row.toolLines.length).toBeGreaterThan(0);
    const chips = toolChipsOf(row);
    expect(chips.map((chip) => chip.tone)).toEqual(['done', 'failed']);
    expect(chips[0].link).not.toBeNull();
    expect(chips[1].link).toBeNull();
    const lines = row.receipts?.lines ?? [];
    expect(chips.map((chip) => chip.text)).toEqual([lines[0].text, lines[1].text]);
  });
});

describe('a Deliverable the turn made', () => {
  it('is a row in the reply that made it, its square in its kind’s gradient and Open for its page', () => {
    const state = streaming({ kind: 'text', text: 'Here it is.' }, madeDocument('d-41', 'Spring post'));
    const rows = threadRows(state);
    const shelf = fileReports(EMPTY_SHELF, state);
    const places = placeReports(shelf, state, LIVE_AUTO_KEY, new Set(rows.map((row) => row.key)));
    const [auto] = autoEntries(chatEntries(rows, places));
    expect(auto.deliverables).toEqual([
      {
        key: 'd-41',
        id: 'd-41',
        title: 'Spring post',
        kind: 'Document',
        set: 2,
        label: said.deliverableLabel('Spring post', 'Document'),
        openable: true,
      },
    ]);
  });

  it('wears the image set for an image and the first for a video; no Open for an id the route refuses', () => {
    expect(deliverableRow({ id: 'i-1', title: 'Hero', kind: 'image' })).toMatchObject({
      set: 3,
      kind: 'Image',
    });
    expect(deliverableRow({ id: 'v-1', title: 'Teaser', kind: 'video' }).set).toBe(1);
    expect(deliverableRow({ id: 'not an id/', title: 'Odd', kind: 'document' }).openable).toBe(false);
  });

  it('one whose reply was never drawn sits at the thread’s end', () => {
    const places = new Map([[LOOSE_REPORTS, [{ id: 'd-9', title: 'Late', kind: 'video' as const }]]]);
    const entries = chatEntries([], places);
    expect(entries).toEqual([
      {
        kind: 'loose',
        key: LOOSE_REPORTS,
        cards: [],
        deliverables: [deliverableRow({ id: 'd-9', title: 'Late', kind: 'video' })],
      },
    ]);
  });
});

describe('the stage', () => {
  const chat = { id: 'c1', title: ' Spring launch post ', createdAt: null, updatedAt: null };
  const checked = { ...chat, kind: 'user', turnInFlight: false } as const;

  it("is titled with the chat's own title, else 'New chat'", () => {
    expect(chatTitle({ chatId: 'c1' }, checked)).toBe('Spring launch post');
    expect(chatTitle({ chatId: null }, checked)).toBe(said.newChat);
    expect(chatTitle({ chatId: 'c2' }, checked)).toBe(said.newChat);
    expect(chatTitle({ chatId: 'c1' }, { ...checked, title: '  ' })).toBe(said.newChat);
    expect(chatTitle({ chatId: 'c1' }, undefined)).toBe(said.newChat);
  });

  it("says Auto's state as a glyph and a word; VoiceOver hears the word", () => {
    expect(statePill({ glyph: '●', word: 'Listening' })).toEqual({
      text: '● Listening',
      label: 'Listening',
    });
  });

  it("goes back by the route's Back, else to Today on the home, else to the home", () => {
    expect(stageBack(false, true)).toBe('onBack');
    expect(stageBack(true, true)).toBe('onBack');
    expect(stageBack(true, false)).toBe('today');
    expect(stageBack(false, false)).toBe('home');
  });
});

describe('the voice window over the box', () => {
  const caption = { text: 'Listening', label: 'Listening' };
  const hint: VoiceLine = { kind: 'hint', text: 'Hold to talk', button: null };
  const seeIt: VoiceLine = {
    kind: 'chat',
    text: null,
    button: { label: 'See it in the chat', action: 'openChat' },
  };
  const idle = { phase: 'idle', micOpen: false } as const;

  it('shows the voice’s words and Stop while it works', () => {
    const shows = chatViewVoice({
      stage: { phase: 'listening', micOpen: true },
      caption,
      line: null,
      stopEnabled: true,
    });
    expect(shows).toEqual({ caption, line: null, stopEnabled: true });
  });

  it('keeps a line but never "See it in the chat": the chat is on screen', () => {
    expect(chatViewVoice({ stage: idle, caption, line: hint, stopEnabled: false })).toEqual({
      caption: null,
      line: hint,
      stopEnabled: false,
    });
    expect(chatViewVoice({ stage: idle, caption, line: seeIt, stopEnabled: false }).line).toBeNull();
  });

  it('leaves a typed turn’s Stop to the box’s own button', () => {
    expect(chatViewVoice({ stage: idle, caption: null, line: null, stopEnabled: true })).toEqual({
      caption: null,
      line: null,
      stopEnabled: false,
    });
  });
});
