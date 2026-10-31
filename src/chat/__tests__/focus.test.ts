// Opening the Auto thread at the brief (PRD-268 US-G03): the chat route's focus param, the row a
// thread view scrolls to, the store the brief on open asks first, and what it does when no thread
// on screen shows the brief's chat.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { briefMessage } from '../../brief/__tests__/fixtures';
import { FOCUS_PARAM, focusFromChatParams, routes } from '../../navigation/routes';
import {
  FOCUS_RETRIES,
  approximateOffset,
  briefOpenStep,
  createThreadFocus,
  focusIndex,
  focusTargetOf,
  shouldFocus,
} from '../focus';
import { foldNotices } from '../components/thread-look';
import { threadRows } from '../view-model';
import { CHAT_ID, saved } from './thread-fixtures';
import { opened } from './view-model-fixtures';

const MESSAGE_ID = 'm-brief';
const read = (file: string) =>
  readFileSync(path.resolve(__dirname, '..', '..', '..', file), 'utf8');

describe('the chat route opens at a message', () => {
  it('routes.chatAt carries the message as the focus param, which the route reads back', () => {
    const href = routes.chatAt(CHAT_ID, MESSAGE_ID);
    expect(href).toBe(`/chat/${CHAT_ID}?${FOCUS_PARAM}=${MESSAGE_ID}`);
    const query = Object.fromEntries(new URLSearchParams(href.split('?')[1]));
    expect(focusFromChatParams(query)).toBe(MESSAGE_ID);
  });

  it('reads no focus from a blank, missing or dot value, and refuses to build one', () => {
    expect(focusFromChatParams({})).toBeNull();
    expect(focusFromChatParams({ focus: '  ' })).toBeNull();
    expect(focusFromChatParams({ focus: '..' })).toBeNull();
    expect(focusFromChatParams({ focus: ['m-1', 'm-2'] })).toBe('m-1');
    expect(() => routes.chatAt(CHAT_ID, ' ')).toThrow(TypeError);
  });

  it("is wired from the route to Studio's and Play's thread lists", () => {
    expect(read('app/(app)/chat/[id].tsx')).toMatch(
      /focusMessageId=\{focusFromChatParams\(params\)\}/,
    );
    const styleChat = read('src/styles/homes/StyleHome.tsx');
    expect(styleChat).toMatch(/<PlayHome[^>]*focusMessageId=\{focusMessageId\}/);
    expect(styleChat).toMatch(/<ChatScreen[\s\S]*?focusMessageId=\{focusMessageId\}/);
    for (const file of ['src/chat/screens/ChatScreen.tsx', 'src/styles/homes/PlayHome.tsx'])
      expect(read(file)).toMatch(/useThreadFocus\(state\.chatId, focusMessageId\)/);
    for (const file of ['src/chat/components/MessageList.tsx', 'src/styles/homes/PlayThread.tsx'])
      expect(read(file)).toMatch(/useFocusScroll\(list, \w+, focusMessageId, onFocused\)/);
  });
});

describe('the row a thread view scrolls to', () => {
  it("is the saved message's own row, found in the rows the list draws", () => {
    const state = opened([saved('u1', 'user', 'Brief me'), briefMessage(MESSAGE_ID)]);
    const rows = foldNotices(threadRows(state, { briefs: true }));
    expect(focusIndex(rows, MESSAGE_ID)).toBe(1);
    expect(focusIndex(rows, 'not-here')).toBe(-1);
  });

  it('scrolls once, only when the row is drawn', () => {
    expect(shouldFocus(MESSAGE_ID, null, 3)).toBe(true);
    expect(shouldFocus(MESSAGE_ID, MESSAGE_ID, 3)).toBe(false);
    expect(shouldFocus(MESSAGE_ID, null, -1)).toBe(false);
    expect(shouldFocus(null, null, 3)).toBe(false);
  });

  it('jumps near a row not laid out yet, a few times at most', () => {
    expect(approximateOffset({ index: 10, averageItemLength: 80 })).toBe(800);
    expect(approximateOffset({ index: 10, averageItemLength: Number.NaN })).toBe(0);
    expect(FOCUS_RETRIES).toBeGreaterThan(0);
  });
});

describe('the brief on open', () => {
  it('names the day’s message from its answer, or nothing', () => {
    expect(focusTargetOf({ chat_id: CHAT_ID, message_id: MESSAGE_ID })).toEqual({
      chatId: CHAT_ID,
      messageId: MESSAGE_ID,
    });
    expect(focusTargetOf({ chat_id: CHAT_ID, message_id: null })).toBeNull();
    expect(focusTargetOf({ chat_id: null, message_id: MESSAGE_ID })).toBeNull();
  });

  it('scrolls the thread on screen; else opens it from home in Studio or Play; else nothing', () => {
    expect(briefOpenStep({ shown: true, onHome: false, threadLayout: false })).toBe('focus');
    expect(briefOpenStep({ shown: false, onHome: true, threadLayout: true })).toBe('open');
    expect(briefOpenStep({ shown: false, onHome: false, threadLayout: true })).toBe('none');
    expect(briefOpenStep({ shown: false, onHome: true, threadLayout: false })).toBe('none');
  });

  it('opens the chat at the message through routes.chatAt (BriefOnOpen)', () => {
    const source = read('src/brief/BriefOnOpen.tsx');
    expect(source).toMatch(/threadFocus\.request\(target\)/);
    expect(source).toMatch(/routes\.chatAt\(target\.chatId, target\.messageId\)/);
  });
});

describe('the store a thread view and the brief on open share', () => {
  it('holds a request only for a chat a thread view shows, until it scrolled there', () => {
    const store = createThreadFocus();
    const told = vi.fn();
    store.subscribe(told);
    expect(store.request({ chatId: CHAT_ID, messageId: MESSAGE_ID })).toBe(false);
    expect(store.pending(CHAT_ID)).toBeNull();
    const hide = store.show(CHAT_ID);
    expect(store.request({ chatId: CHAT_ID, messageId: MESSAGE_ID })).toBe(true);
    expect(store.pending(CHAT_ID)).toBe(MESSAGE_ID);
    store.settle(CHAT_ID, 'another');
    expect(store.pending(CHAT_ID)).toBe(MESSAGE_ID);
    store.settle(CHAT_ID, MESSAGE_ID);
    expect(store.pending(CHAT_ID)).toBeNull();
    expect(store.pending(null)).toBeNull();
    hide();
    expect(told).toHaveBeenCalled();
  });

  it('counts the views of a chat: it stays shown until the last one goes, and a remove is once', () => {
    const store = createThreadFocus();
    const first = store.show(CHAT_ID);
    const second = store.show(CHAT_ID);
    first();
    first();
    expect(store.request({ chatId: CHAT_ID, messageId: MESSAGE_ID })).toBe(true);
    second();
    expect(store.request({ chatId: CHAT_ID, messageId: 'next' })).toBe(false);
  });
});
