// The dialogue window's view (dialogue.ts; README Motion; the kit's chat/dialogue.tsx): '…' while
// Auto thinks, the typed part of the reply with the ▼ cursor and Skip while it types, the cursor
// blinking only once the line is whole and Arcade moves, VoiceOver hearing nothing of the typing
// and the whole reply once, and the portrait's state in words; and the parts' pure modules.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { dialogueView, portraitWords, type DialogueReply } from '../dialogue';

const REPLY: DialogueReply = {
  id: 'm1',
  text: 'Your report is ready.',
  streaming: false,
  whole: false,
};

const TYPING = { shown: 4, done: false, typing: true };
const DONE = { shown: REPLY.text.length, done: true, typing: false };

describe('while Auto thinks', () => {
  it('shows … with no cursor and no Skip, and VoiceOver hears that Auto is thinking', () => {
    expect(dialogueView(REPLY, DONE, true, true)).toEqual({
      words: '…',
      label: 'Auto is thinking',
      hidden: false,
      cursor: false,
      blinking: false,
      skip: false,
      announce: false,
    });
  });
});

describe('while the reply types', () => {
  const view = dialogueView(REPLY, TYPING, false, true);

  it('shows the typed part with the cursor held on, and Skip', () => {
    expect(view).toMatchObject({ words: 'Your', cursor: true, blinking: false, skip: true });
  });

  it('is hidden from VoiceOver and says nothing yet', () => {
    expect(view).toMatchObject({ hidden: true, label: undefined, announce: false });
  });
});

describe('once the reply is whole', () => {
  it('reads as the whole reply, blinks the cursor while Arcade moves, and drops Skip', () => {
    expect(dialogueView(REPLY, DONE, false, true)).toEqual({
      words: REPLY.text,
      label: REPLY.text,
      hidden: false,
      cursor: true,
      blinking: true,
      skip: false,
      announce: true,
    });
  });

  it('holds the cursor on under Reduce Motion or the pause', () => {
    expect(dialogueView(REPLY, DONE, false, false)).toMatchObject({
      cursor: true,
      blinking: false,
    });
  });

  it('is not said again when it was already there when the chat opened', () => {
    expect(dialogueView({ ...REPLY, whole: true }, DONE, false, true).announce).toBe(false);
  });

  it('is not said while more is still coming, or when there is no reply', () => {
    const caughtUp = { shown: REPLY.text.length, done: false, typing: false };
    expect(dialogueView({ ...REPLY, streaming: true }, caughtUp, false, true)).toMatchObject({
      announce: false,
      skip: false,
      hidden: false,
    });
    const empty = { id: null, text: '', streaming: false, whole: false };
    expect(dialogueView(empty, { shown: 0, done: true, typing: false }, false, true).announce).toBe(
      false,
    );
  });
});

describe('the portrait’s state word', () => {
  it('is the state in capitals, and Auto’s state for VoiceOver', () => {
    expect(portraitWords('thinking')).toEqual({ word: 'THINKING', label: 'Auto: thinking' });
    expect(portraitWords('celebrate')).toEqual({ word: 'CELEBRATE', label: 'Auto: celebrate' });
  });
});

describe('the parts’ pure modules (D-SHAPE, D-TOKENS)', () => {
  const PURE = ['window-frame.ts', 'counters.ts', 'pad-grid.ts', 'dialogue.ts'];

  it.each(PURE)('%s imports no React, React Native, Expo or Skia and holds no colour', (file) => {
    const source = readFileSync(path.resolve(__dirname, '..', file), 'utf8');
    expect(source).not.toMatch(
      /from '(react|react-native[^']*|expo[^']*|@shopify\/react-native-skia)'/,
    );
    expect(source).not.toMatch(/#[0-9a-fA-F]{6}\b|rgba?\(/);
  });
});
