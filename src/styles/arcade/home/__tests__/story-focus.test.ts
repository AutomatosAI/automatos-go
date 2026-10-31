// Arcade's story opened at a message (PRD-268 US-G03; story-focus.ts, use-story-focus.ts): the
// story is a ScrollView, so it scrolls to the focus entry's recorded top once that entry is drawn and
// laid out, by focus.ts's rules (once each, and a route's focus never pulls the story back after a
// later one); a focus on the reply the dialogue says settles without a scroll. The chat route hands
// its focus to ArcadeHome as it does to Studio's and Play's threads, and HUD's home is unchanged.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { briefMessage } from '../../../../brief/__tests__/fixtures';
import { saved } from '../../../../chat/__tests__/thread-fixtures';
import { opened } from '../../../../chat/__tests__/view-model-fixtures';
import { threadRows } from '../../../../chat/view-model';
import { sayingOf } from '../../../homes/arcade-home';
import { sayingRowKey, storyEntries } from '../../../homes/arcade-story';
import {
  storyFocusIndex,
  storyFocusStep,
  withPlace,
  type StoryFocusFacts,
  type StoryPlaces,
} from '../story-focus';

const BRIEF = 'm-brief';
const ASKED = saved('u1', 'user', 'Brief me');
const REPLY = saved('a1', 'assistant', 'Here it is.');
const LATER = saved('u2', 'user', 'Start the first one');
const ANSWER = saved('a2', 'assistant', 'On it.');
const NONE: ReadonlySet<string> = new Set();
const NOWHERE: StoryPlaces = new Map();

const facts = (extra: Partial<StoryFocusFacts>): StoryFocusFacts => ({
  focus: BRIEF,
  done: NONE,
  index: 1,
  sayingId: null,
  places: new Map([[BRIEF, 240]]),
  ...extra,
});

/** The story's entries and the dialogue's message over these saved messages, briefs drawn. */
function storyOver(messages: Parameters<typeof opened>[0]) {
  const rows = threadRows(opened(messages), { briefs: true });
  const sayingKey = sayingRowKey(rows);
  return {
    entries: storyEntries(rows, new Map(), sayingKey),
    sayingId: sayingOf(rows, sayingKey)?.messageId ?? null,
  };
}

describe('withPlace: each entry’s top as it is laid out', () => {
  it('records an entry’s top by its key, and hands the same map back when nothing moved', () => {
    const placed = withPlace(NOWHERE, BRIEF, { y: 240, height: 80 });
    expect([...placed]).toEqual([[BRIEF, 240]]);
    expect(withPlace(placed, BRIEF, { y: 240, height: 96 })).toBe(placed);
    expect([...withPlace(placed, BRIEF, { y: 300, height: 80 })]).toEqual([[BRIEF, 300]]);
    expect(placed).not.toBe(NOWHERE);
    expect(NOWHERE.size).toBe(0);
  });

  it('has no place for an entry that draws nothing (no height) or reports no number', () => {
    const placed = withPlace(NOWHERE, BRIEF, { y: 240, height: 80 });
    expect([...withPlace(placed, BRIEF, { y: 0, height: 0 })]).toEqual([]);
    expect(withPlace(NOWHERE, BRIEF, { y: 0, height: 0 })).toBe(NOWHERE);
    expect(withPlace(NOWHERE, BRIEF, { y: Number.NaN, height: 10 })).toBe(NOWHERE);
  });
});

describe('storyFocusStep: focus.ts’s rules over the story’s places', () => {
  it('scrolls to the focus entry’s top once it is drawn and laid out', () => {
    expect(storyFocusStep(facts({}))).toEqual({ kind: 'scroll', messageId: BRIEF, y: 240 });
  });

  it('waits with no focus, while its entry is not drawn, and while it is not laid out', () => {
    expect(storyFocusStep(facts({ focus: null }))).toEqual({ kind: 'wait' });
    expect(storyFocusStep(facts({ index: -1 }))).toEqual({ kind: 'wait' });
    expect(storyFocusStep(facts({ places: NOWHERE }))).toEqual({ kind: 'wait' });
  });

  it('settles the reply the dialogue says without a scroll, laid out or not', () => {
    const settle = { kind: 'settle', messageId: BRIEF };
    expect(storyFocusStep(facts({ sayingId: BRIEF }))).toEqual(settle);
    expect(storyFocusStep(facts({ sayingId: BRIEF, places: NOWHERE }))).toEqual(settle);
    expect(storyFocusStep(facts({ sayingId: BRIEF, index: -1 }))).toEqual({ kind: 'wait' });
  });

  it('handles each focus once, and a route’s focus never pulls the story back after a later one', () => {
    const places = new Map([
      [BRIEF, 240],
      ['a2', 600],
    ]);
    const route = facts({ places });
    expect(storyFocusStep(route).kind).toBe('scroll');
    const afterRoute = new Set([BRIEF]);
    expect(storyFocusStep({ ...route, done: afterRoute })).toEqual({ kind: 'wait' });
    const request = { ...route, focus: 'a2', index: 3, done: afterRoute };
    expect(storyFocusStep(request)).toEqual({ kind: 'scroll', messageId: 'a2', y: 600 });
    // the request settled: the focus is the route's again, already scrolled to
    expect(storyFocusStep({ ...route, done: new Set([BRIEF, 'a2']) })).toEqual({ kind: 'wait' });
  });
});

describe('the story’s entries as focus targets', () => {
  it('finds a saved message’s entry by its id, as focus.ts finds a row', () => {
    const { entries, sayingId } = storyOver([ASKED, briefMessage(BRIEF), LATER, ANSWER]);
    expect(storyFocusIndex(entries, BRIEF)).toBe(1);
    expect(storyFocusIndex(entries, 'not-here')).toBe(-1);
    expect(storyFocusIndex(entries, null)).toBe(-1);
    expect(sayingId).toBe('a2');
  });

  it('the brief on open landing as the newest message is the dialogue’s: it settles', () => {
    const { entries, sayingId } = storyOver([ASKED, REPLY, briefMessage(BRIEF)]);
    const index = storyFocusIndex(entries, BRIEF);
    expect([index, sayingId]).toEqual([2, BRIEF]);
    const step = storyFocusStep({ focus: BRIEF, done: NONE, index, sayingId, places: NOWHERE });
    expect(step).toEqual({ kind: 'settle', messageId: BRIEF });
  });

  it('an older brief in the story scrolls there once laid out', () => {
    const { entries, sayingId } = storyOver([briefMessage(BRIEF), LATER, ANSWER]);
    const index = storyFocusIndex(entries, BRIEF);
    const places = withPlace(NOWHERE, BRIEF, { y: 56, height: 120 });
    expect(storyFocusStep({ focus: BRIEF, done: NONE, index, sayingId, places })).toEqual({
      kind: 'scroll',
      messageId: BRIEF,
      y: 56,
    });
  });
});

describe('the wiring', () => {
  const read = (file: string) =>
    readFileSync(path.resolve(__dirname, '..', '..', '..', '..', '..', file), 'utf8');

  it('the chat route’s focus reaches ArcadeHome as it reaches Play’s; HUD’s home is unchanged', () => {
    const styleChat = read('src/styles/homes/StyleHome.tsx');
    expect(styleChat).toMatch(/<ArcadeHome[^>]*focusMessageId=\{focusMessageId\}/);
    expect(styleChat).toMatch(/<PlayHome[^>]*focusMessageId=\{focusMessageId\}/);
    expect(styleChat).toMatch(/<HudHome chatId=\{chatId\} ticketId=\{ticketId\} \/>/);
    expect(read('src/styles/homes/HudHome.tsx')).not.toMatch(/focusMessageId|useThreadFocus/);
  });

  it('ArcadeHome takes the thread’s focus and hands it to the story while the chat is on screen', () => {
    const home = read('src/styles/homes/ArcadeHome.tsx');
    expect(home).toMatch(/useThreadFocus\(state\.chatId, focusMessageId\)/);
    expect(home).toMatch(/focusMessageId=\{chatShown \? focus : null\}/);
    expect(home).toMatch(/onFocused=\{settle\}/);
    expect(home).toMatch(/sayingId=\{story\.sayingId\}/);
    expect(read('src/styles/homes/use-arcade-home.ts')).toMatch(
      /const sayingId = sayingRow\?\.messageId \?\? null;/,
    );
  });

  it('the story records each entry’s place, and the focus runs after the jump to the end', () => {
    const story = read('src/styles/arcade/home/StoryWindow.tsx');
    expect(story).toMatch(/useStoryFocus\(scroller, \{ entries, focus: focusMessageId/);
    expect(story).toMatch(
      /onLayout=\{\(event\) => onPlaced\(entry\.key, event\.nativeEvent\.layout\)\}/,
    );
    expect(story).toMatch(/scrollOnAdd\(\);\s+focusRun\(\);/);
    expect(story).toMatch(/^\s+<AiLabel \/>/m);
  });

  it('story-focus.ts imports no React, React Native, Expo or Skia (D-SHAPE)', () => {
    const source = read('src/styles/arcade/home/story-focus.ts');
    expect(source).not.toMatch(/from '(react|react-native[^']*|expo[^']*|@shopify\/[^']*)'/);
  });
});
