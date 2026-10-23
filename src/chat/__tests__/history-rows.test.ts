import { describe, expect, it } from 'vitest';

import { routes } from '../../navigation/routes';
import {
  chatRowView,
  chatRowViews,
  chatTitle,
  lastActive,
  previewLine,
  relativeTime,
} from '../history/rows';
import { HistoryRowSchema, type HistoryRow } from '../schemas';
import { NEW_CHAT_ID } from '../screens/chat-route';
import { HISTORY_COPY } from '../strings';

// local times, so the calendar-day rules read the same in any time zone
const NOW = new Date(2026, 9, 23, 15, 0, 0);
const at = (year: number, month: number, day: number, hour = 12, minute = 0, second = 0) =>
  new Date(year, month, day, hour, minute, second);

const row = (fields: Record<string, unknown> = {}): HistoryRow =>
  HistoryRowSchema.parse({
    id: 'chat-1',
    title: 'Plan the launch',
    createdAt: at(2026, 9, 20).toISOString(),
    updatedAt: at(2026, 9, 23, 14, 58).toISOString(),
    lastMessagePreview: 'Here is the plan',
    kind: 'user',
    ...fields,
  });

describe("an older chat's time (the web's relativeTime)", () => {
  it('counts minutes and hours today', () => {
    expect(relativeTime(at(2026, 9, 23, 14, 59, 40), NOW)).toBe('Just now');
    expect(relativeTime(at(2026, 9, 23, 14, 58), NOW)).toBe('2 min');
    expect(relativeTime(at(2026, 9, 23, 12, 0), NOW)).toBe('3 h');
    expect(relativeTime(at(2026, 9, 23, 0, 5), NOW)).toBe('14 h');
  });

  it("reads a time slightly ahead of the phone's clock as just now", () => {
    expect(relativeTime(at(2026, 9, 23, 15, 3), NOW)).toBe('Just now');
  });

  it('says Yesterday, then the weekday for the rest of the week', () => {
    expect(relativeTime(at(2026, 9, 22, 23, 0), NOW)).toBe('Yesterday');
    expect(relativeTime(at(2026, 9, 19), NOW)).toBe('Mon');
    expect(relativeTime(at(2026, 9, 17), NOW)).toBe('Sat');
  });

  it('gives the day and month from a week back, and the year when it is not this one', () => {
    expect(relativeTime(at(2026, 9, 16), NOW)).toBe('16 Oct');
    expect(relativeTime(at(2025, 11, 9), NOW)).toBe('9 Dec 2025');
  });

  it('is empty when the server sent no readable time', () => {
    expect(relativeTime(null, NOW)).toBe('');
  });
});

describe('when an older chat last moved', () => {
  it('is updatedAt, else createdAt, else unknown', () => {
    expect(lastActive(row())).toEqual(at(2026, 9, 23, 14, 58));
    expect(lastActive(row({ updatedAt: 'not a date' }))).toEqual(at(2026, 9, 20));
    expect(lastActive(row({ updatedAt: null, createdAt: null }))).toBeNull();
  });
});

describe("an older chat's words", () => {
  it('puts the title on one line, and names an untitled chat as the web does', () => {
    expect(chatTitle(row({ title: '  Plan\n the   launch ' }))).toBe('Plan the launch');
    expect(chatTitle(row({ title: null }))).toBe(HISTORY_COPY.untitled);
    expect(chatTitle(row({ title: '   ' }))).toBe('New chat');
  });

  it('puts the newest message on one line, or none', () => {
    expect(previewLine(row({ lastMessagePreview: 'Here is\n\nthe plan' }))).toBe(
      'Here is the plan',
    );
    expect(previewLine(row({ lastMessagePreview: null }))).toBeNull();
    expect(previewLine(row({ lastMessagePreview: ' ' }))).toBeNull();
  });
});

describe('one older chat as its row shows it', () => {
  it('carries the title, the time, the preview and one label with all three', () => {
    expect(chatRowView(row(), NOW)).toEqual({
      id: 'chat-1',
      title: 'Plan the launch',
      time: '2 min',
      preview: 'Here is the plan',
      auto: false,
      accessibilityLabel: 'Plan the launch, 2 min, Here is the plan',
    });
  });

  it("marks a chat Auto started, in a word VoiceOver reads too (kind 'auto')", () => {
    const view = chatRowView(row({ kind: 'auto', title: 'Morning digest' }), NOW);
    expect(view.auto).toBe(true);
    expect(view.accessibilityLabel).toBe(
      `Morning digest, ${HISTORY_COPY.autoMarkerLabel}, 2 min, Here is the plan`,
    );
  });

  it('leaves out of the label what the row does not show', () => {
    const view = chatRowView(
      row({ updatedAt: null, createdAt: null, lastMessagePreview: null }),
      NOW,
    );
    expect(view.time).toBe('');
    expect(view.preview).toBeNull();
    expect(view.accessibilityLabel).toBe('Plan the launch');
  });

  it('lists chats of both kinds in the server order, newest first', () => {
    const views = chatRowViews(
      [row({ id: 'a', kind: 'auto' }), row({ id: 'b' }), row({ id: 'c', kind: 'whatever' })],
      NOW,
    );
    expect(views.map((view) => [view.id, view.auto])).toEqual([
      ['a', true],
      ['b', false],
      ['c', false],
    ]);
  });

  it('opens a row at routes.chat(id), and New chat at a draft', () => {
    expect(routes.chat('chat-1')).toBe('/chat/chat-1');
    expect(routes.chat(NEW_CHAT_ID)).toBe('/chat/new');
    expect(routes.chats).toBe('/chats');
  });
});
