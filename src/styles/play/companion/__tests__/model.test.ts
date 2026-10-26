// Play's Companion model (US-017c): the status words and their detail from the vendored
// chatCaption, the tool chips from the vendored toolLineLabel, "What Auto did" with the web's
// badges, the report eyebrow, the composer's button, the header's Shelf and needs line, the bottom
// bar, and Conversations' sections, relative times (with the timezone a parameter), previews and
// the report badge.

import { describe, expect, it, vi } from 'vitest';

import {
  ON_THE_SHELF,
  WAKE_HINT,
} from '../../../../core/frozen/components/play/chat/caption';
import { MASCOT_STATES } from '../../../../core/frozen/lib/mascot/types';
import type { HostToolCall } from '../../../../core/frozen/lib/theme-sdk';
import type { Receipt } from '../../../../core/web/types/chat';
import { logger } from '../../../../lib/logger';
import { PLAY_STATUS } from '../../../strings';
import {
  COMPANION,
  PLAY_TAB_ROUTES,
  composerView,
  conversationSections,
  conversationTitle,
  draftComposerState,
  needsLine,
  playStatus,
  previewText,
  receiptRows,
  relativeTime,
  reportBadge,
  reportEyebrow,
  sectionOf,
  shelfView,
  tabViews,
  toolChip,
  type PlayConversation,
} from '../model';

function call(fields: Partial<HostToolCall>): HostToolCall {
  return {
    toolCallId: 'call-1',
    toolName: 'platform_web_search',
    state: 'completed',
    skipped: false,
    waiting: false,
    ...fields,
  };
}

function receipt(fields: Partial<Receipt>): Receipt {
  return {
    action: 'create_document',
    kind: 'write',
    status: 'done',
    subject: 'Laptop shortlist',
    effect: 'made a report',
    link: null,
    reason: null,
    ...fields,
  };
}

describe("Auto's row", () => {
  it('has one word for each of the twelve states', () => {
    expect(PLAY_STATUS).toEqual({
      hello: 'Hi.',
      idle: 'Ready.',
      listening: 'Listening.',
      thinking: 'Thinking.',
      working: 'On it.',
      searching: 'Searching.',
      reading: 'Reading.',
      celebrate: 'Ta-da.',
      oops: 'Hm.',
      sleeping: 'Asleep.',
      lost: 'Lost.',
      loading: 'Loading.',
    });
    expect(Object.keys(PLAY_STATUS).sort()).toEqual([...MASCOT_STATES].sort());
  });

  it("shows a running tool's input under the word in Geist Mono", () => {
    const status = playStatus('searching', { runningInput: { query: 'best budget laptops' } });
    expect(status).toEqual({
      word: 'Searching.',
      detail: 'best budget laptops',
      detailFace: 'mono',
    });
  });

  it("falls back to the vendored caption, in Geist, when there is no detail", () => {
    const status = playStatus('searching');
    expect(status.word).toBe('Searching.');
    expect(status.detail).toBe('Searching the web');
    expect(status.detailFace).toBe('sans');
  });

  it("uses the vendored caption's detail for a Deliverable and a nap", () => {
    expect(playStatus('celebrate', { deliverableKind: 'report' })).toEqual({
      word: 'Ta-da.',
      detail: ON_THE_SHELF,
      detailFace: 'sans',
    });
    expect(playStatus('sleeping').detail).toBe(WAKE_HINT);
    expect(playStatus('sleeping', { backendDown: true }).detail).not.toBe(WAKE_HINT);
  });
});

describe('tool chips', () => {
  it('writes a running call with no mark (the spinner) and says it runs', () => {
    const chip = toolChip(call({ state: 'running', input: { query: 'laptops' } }), true);
    expect(chip).toEqual({
      key: 'call-1',
      kind: 'running',
      mark: null,
      text: "Searching the web: 'laptops'",
      label: "Running: Searching the web: 'laptops'",
    });
  });

  it('writes a done call with its summary and seconds after a tick', () => {
    const chip = toolChip(call({ summary: '3 results', durationMs: 2140 }), false);
    expect(chip.kind).toBe('done');
    expect(chip.mark).toBe('✓');
    expect(chip.text).toBe('Searched the web · 3 results · 2.1 s');
    expect(chip.label).toBe('Done: Searched the web · 3 results · 2.1 s');
  });

  it('writes a failed call with a cross, and a waiting one with its words', () => {
    const failed = toolChip(call({ state: 'error', error: "didn't answer" }), false);
    expect(failed).toMatchObject({ kind: 'failed', mark: '✕' });
    expect(failed.label).toBe("Failed: The web search didn't work · didn't answer");
    const waiting = toolChip(call({ waiting: true }), false);
    expect(waiting).toMatchObject({ kind: 'waiting', mark: '…', text: 'Waiting for you' });
    expect(waiting.label).toBe('Waiting for you');
  });

  it('fades a call still running on a reply that stopped', () => {
    const chip = toolChip(call({ state: 'running' }), false);
    expect(chip).toMatchObject({ kind: 'muted', mark: '–', text: 'Stopped: searching the web' });
  });
});

describe('What Auto did', () => {
  it("draws a done write in the text colour with the accent's Done", () => {
    const [row] = receiptRows([receipt({})]);
    expect(row).toEqual({
      key: '0:create_document',
      mark: '✓',
      text: 'Laptop shortlist: made a report',
      badge: 'Done',
      badgeTone: 'accent',
      emphasis: true,
    });
  });

  it('gives a done read no badge, a refused call Not done, a skipped one Skipped', () => {
    const rows = receiptRows([
      receipt({ kind: 'read', subject: 'the web', effect: '5 results' }),
      receipt({ status: 'refused', reason: 'not allowed' }),
      receipt({ status: 'skipped', reason: 'already done' }),
      receipt({ status: 'waiting', effect: 'card raised' }),
    ]);
    expect(rows.map((row) => [row.mark, row.badge, row.badgeTone, row.emphasis])).toEqual([
      ['✓', null, null, false],
      ['✕', 'Not done', 'error', false],
      ['–', 'Skipped', 'faded', false],
      ['…', null, null, false],
    ]);
    expect(rows[1].text).toBe('Laptop shortlist: tried, refused: not allowed');
    expect(rows[3].text).toBe('card raised — waiting for you');
  });
});

describe('the report card', () => {
  it("says 'Report · just now' over the title", () => {
    expect(reportEyebrow()).toBe('Report · just now');
    expect(reportEyebrow('Document', 'Mon')).toBe('Document · Mon');
  });
});

describe('the composer', () => {
  it('sends once something is typed, before A2 wires its state', () => {
    expect(composerView(draftComposerState('   '))).toMatchObject({
      mode: 'disabled',
      disabled: true,
      label: 'Send',
      placeholder: 'Message Auto',
      fill: 'cream',
      square: false,
    });
    expect(composerView(draftComposerState('Hi'))).toMatchObject({ mode: 'send', disabled: false });
  });

  it('becomes Stop with its square while a reply streams, never in the accent', () => {
    const view = composerView({ buttonMode: 'stop', inputEditable: true }, true);
    expect(view).toMatchObject({ label: 'Stop', square: true, fill: 'cream', disabled: false });
    expect(view.hint).toBe('Stops Auto’s reply');
  });

  it('paints Send in the accent on First open', () => {
    expect(composerView(draftComposerState('Plan my week'), true).fill).toBe('accent');
  });

  it("takes a viewer's read-only placeholder and switches the field off", () => {
    const view = composerView({
      buttonMode: 'disabled',
      inputEditable: false,
      placeholder: 'You can read this chat',
      notice: { text: 'Viewers read the thread' },
    });
    expect(view).toMatchObject({ editable: false, disabled: true });
    expect(view.placeholder).toBe('You can read this chat');
  });
});

describe('the header', () => {
  it("says 'Shelf', or 'Shelf +N' when Deliverables landed here", () => {
    expect(shelfView(0)).toEqual({ text: 'Shelf', fresh: false, label: 'Shelf' });
    expect(shelfView(2)).toEqual({ text: 'Shelf +2', fresh: true, label: 'Shelf, 2 new in this chat' });
  });

  it('shows the needs line only while the total is above zero', () => {
    expect(needsLine(0)).toBeNull();
    expect(needsLine(Number.NaN)).toBeNull();
    expect(needsLine(3)).toEqual({
      text: 'Needs you · 3',
      link: 'Command Centre →',
      label: '3 need you. Opens the Command Centre',
    });
  });

  it('keeps every header target at 44 pt', () => {
    expect(COMPANION.target).toBe(44);
    expect(COMPANION.header.height).toBe(56);
  });
});

describe('the bottom bar', () => {
  it('has Chats, Shelf and Centre, Centre with the needs-you number', () => {
    const tabs = tabViews('chats', 3);
    expect(tabs.map((tab) => [tab.text, tab.selected, tab.count])).toEqual([
      ['Chats', true, 0],
      ['Shelf', false, 0],
      ['Centre', false, 3],
    ]);
    expect(tabs[2].label).toBe('Command Centre, 3 need you');
    expect(tabViews('centre', 0)[2].label).toBe('Command Centre');
  });

  it('goes to the history, the Deliverables and the Board', () => {
    expect(PLAY_TAB_ROUTES).toEqual({ chats: '/chats', shelf: '/cc/deliverables', centre: '/cc' });
    expect(COMPANION.bar).toMatchObject({ itemHeight: 48, itemMinWidth: 96, dot: 6 });
  });
});

// Wednesday 14 October 2026, 13:00 in London (BST, UTC+1).
const NOW = new Date('2026-10-14T12:00:00Z');
const LONDON = { now: NOW, timeZone: 'Europe/London' };
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);

describe("Conversations' times", () => {
  it("reads 'Just now', minutes and hours today", () => {
    expect(relativeTime(minutesAgo(0), LONDON)).toBe('Just now');
    expect(relativeTime(minutesAgo(2), LONDON)).toBe('2 min');
    expect(relativeTime(minutesAgo(190), LONDON)).toBe('3 h');
  });

  it("reads 'Yesterday', a weekday this week, then the date", () => {
    expect(relativeTime(new Date('2026-10-13T09:00:00Z'), LONDON)).toBe('Yesterday');
    expect(relativeTime(new Date('2026-10-12T09:00:00Z'), LONDON)).toBe('Mon');
    expect(relativeTime(new Date('2026-10-02T09:00:00Z'), LONDON)).toBe('2 Oct');
    expect(relativeTime(new Date('2025-10-09T09:00:00Z'), LONDON)).toBe('9 Oct 2025');
    expect(relativeTime(null, LONDON)).toBe('');
  });

  it("counts days on the given timezone's calendar", () => {
    const now = new Date('2026-10-14T00:30:00Z');
    const lateLast = new Date('2026-10-13T23:30:00Z');
    // 01:30 and 00:30 on the 14th in London; 00:30 on the 14th and 23:30 on the 13th in UTC
    expect(sectionOf(lateLast, { now, timeZone: 'Europe/London' })).toBe('today');
    expect(relativeTime(lateLast, { now, timeZone: 'Europe/London' })).toBe('1 h');
    expect(sectionOf(lateLast, { now, timeZone: 'UTC' })).toBe('week');
    expect(relativeTime(lateLast, { now, timeZone: 'UTC' })).toBe('Yesterday');
  });

  it("falls back to the phone's clock for a zone the engine refuses, and says so", () => {
    const debug = vi.spyOn(logger, 'debug').mockImplementation(() => undefined);
    expect(relativeTime(minutesAgo(5), { now: NOW, timeZone: 'Not/AZone' })).toBe('5 min');
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('Not/AZone'), expect.any(RangeError));
    debug.mockRestore();
  });
});

function conversation(id: string, updatedAt: string | null, fields: Partial<PlayConversation> = {}) {
  return { id, title: `Chat ${id}`, updatedAt, preview: null, reports: 0, ...fields };
}

describe("Conversations' sections and rows", () => {
  it('groups Today, This week and Earlier in order, leaving out empty ones', () => {
    const sections = conversationSections(
      [
        conversation('a', minutesAgo(2).toISOString()),
        conversation('b', '2026-10-12T09:00:00Z'),
        conversation('c', '2026-10-11T09:00:00Z'),
        conversation('d', '2026-10-01T09:00:00Z'),
        conversation('e', null),
      ],
      LONDON,
    );
    expect(sections.map((section) => [section.title, section.data.map((row) => row.id)])).toEqual([
      ['Today', ['a']],
      ['This week', ['b', 'c']],
      ['Earlier', ['d', 'e']],
    ]);
    expect(conversationSections([conversation('a', minutesAgo(1).toISOString())], LONDON)).toHaveLength(1);
  });

  it('writes the title, time, preview and badge, and one line for VoiceOver', () => {
    const [today] = conversationSections(
      [
        conversation('a', minutesAgo(2).toISOString(), {
          title: '  Laptop\nfor uni ',
          preview: { text: 'Three laptops make the cut…', from: 'auto' },
          reports: 1,
        }),
      ],
      LONDON,
    );
    expect(today.data[0]).toEqual({
      id: 'a',
      title: 'Laptop for uni',
      time: '2 min',
      preview: 'Auto: Three laptops make the cut…',
      badge: '1 Report',
      label: 'Laptop for uni, 2 min, Auto: Three laptops make the cut…, 1 Report',
    });
  });

  it("uses createdAt when updatedAt can't be read, and 'New chat' with no title", () => {
    const [section] = conversationSections(
      [conversation('a', 'not a date', { title: null, createdAt: minutesAgo(3).toISOString() })],
      LONDON,
    );
    expect(section.title).toBe('Today');
    expect(section.data[0].title).toBe('New chat');
    expect(conversationTitle('   ')).toBe('New chat');
  });

  it("previews 'Auto: …' or 'You: …' when the speaker is known", () => {
    expect(previewText({ text: 'Shorter,  please', from: 'user' })).toBe('You: Shorter, please');
    expect(previewText({ text: 'Week 1 covers bonding', from: 'auto' })).toBe(
      'Auto: Week 1 covers bonding',
    );
    expect(previewText({ text: 'Either side', from: null })).toBe('Either side');
    expect(previewText({ text: '   ', from: 'auto' })).toBeNull();
    expect(previewText(null)).toBeNull();
  });

  it("badges '1 Report', '2 Reports', and nothing at none", () => {
    expect(reportBadge(0)).toBeNull();
    expect(reportBadge(1)).toBe('1 Report');
    expect(reportBadge(2)).toBe('2 Reports');
  });
});
