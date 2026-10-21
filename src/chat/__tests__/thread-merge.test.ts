import { describe, expect, it } from 'vitest';

import { loadedAction, mergeById } from '../controller/thread';
import { AT, CHAT_ID, saved } from './thread-fixtures';

const ASKED = saved('m-1', 'user', 'What needs me?');
const REPLIED = saved('m-2', 'assistant', 'Two things need you.');

describe('mergeById', () => {
  it('mergeById never duplicates, keeps the fresh copy and returns the same list when nothing is new', () => {
    const fresh = saved('m-1', 'user', 'What needs me today?');
    expect(mergeById([ASKED], [fresh, REPLIED, REPLIED])).toEqual([fresh, REPLIED]);
    const known = [ASKED, REPLIED];
    expect(mergeById(known, [ASKED, REPLIED])).toBe(known);
    expect(mergeById(known, [])).toBe(known);
  });
});

describe('loadedAction', () => {
  it('loadedAction waits for both answers, and turns a refused check into a draft', () => {
    const thread = {
      id: CHAT_ID,
      title: null,
      createdAt: AT,
      updatedAt: AT,
      kind: 'user' as const,
      turnInFlight: true,
    };
    expect(loadedAction(undefined, [ASKED])).toBeNull();
    expect(loadedAction(thread, undefined)).toBeNull();
    expect(loadedAction(null, undefined)).toEqual({
      type: 'loaded',
      chatId: null,
      messages: [],
      turnInFlight: false,
    });
    expect(loadedAction(thread, [ASKED])).toEqual({
      type: 'loaded',
      chatId: CHAT_ID,
      messages: [ASKED],
      turnInFlight: true,
    });
  });
});
