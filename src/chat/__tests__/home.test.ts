import { describe, expect, it } from 'vitest';

import { routes } from '../../navigation/routes';
import { headerLine, keptChatId, newestChatId } from '../home/home';
import { HOME_HISTORY_LIMIT } from '../home/use-home';
import { HistorySchema } from '../schemas';
import { NEW_CHAT_ID, routeChatId } from '../screens/chat-route';
import { CHAT_ID, OTHER_CHAT_ID } from './thread-fixtures';

const history = (...ids: string[]) =>
  HistorySchema.parse(
    ids.map((id, index) => ({
      id,
      title: `Chat ${index}`,
      createdAt: '2026-10-22T08:00:00Z',
      updatedAt: '2026-10-23T08:00:00Z',
      lastMessagePreview: 'Morning digest',
      kind: index === 0 ? 'auto' : 'user',
    })),
  );

describe("the home header's mono line", () => {
  it('names the workspace and its agents, as the handoff\'s "NORTHWIND · 5 AGENTS"', () => {
    expect(headerLine({ workspace: 'Northwind', agents: 5, working: false })).toBe(
      'Northwind · 5 agents',
    );
    expect(headerLine({ workspace: 'Northwind', agents: 1, working: false })).toBe(
      'Northwind · 1 agent',
    );
  });

  it('says Auto is working while a turn runs, whatever the agents', () => {
    expect(headerLine({ workspace: 'Northwind', agents: 5, working: true })).toBe(
      'Northwind · Auto is working',
    );
    expect(headerLine({ workspace: 'Northwind', agents: null, working: true })).toBe(
      'Northwind · Auto is working',
    );
  });

  it('is the name alone until the agents are known', () => {
    expect(headerLine({ workspace: ' Northwind ', agents: null, working: false })).toBe(
      'Northwind',
    );
  });
});

describe('the home thread (KC4)', () => {
  it('reads one chat: the newest is all home needs', () => {
    expect(HOME_HISTORY_LIMIT).toBe(1);
  });

  it('is the newest conversation in the history, of either kind (Auto starts some)', () => {
    expect(newestChatId(history(CHAT_ID, OTHER_CHAT_ID))).toBe(CHAT_ID);
  });

  it('is a draft when there are no chats yet, and undecided while the list is out', () => {
    expect(newestChatId([])).toBeNull();
    expect(newestChatId(undefined)).toBeUndefined();
  });

  it('stays the chat first chosen when a later list names another, or none', () => {
    expect(keptChatId(undefined, CHAT_ID)).toBe(CHAT_ID);
    expect(keptChatId(CHAT_ID, OTHER_CHAT_ID)).toBe(CHAT_ID);
    expect(keptChatId(null, OTHER_CHAT_ID)).toBeNull();
    expect(keptChatId(CHAT_ID, undefined)).toBe(CHAT_ID);
    expect(keptChatId(undefined, undefined)).toBeUndefined();
  });
});

describe("the chat route's id", () => {
  it('opens the conversation routes.chat(id) names', () => {
    expect(routes.chat(CHAT_ID)).toBe(`/chat/${CHAT_ID}`);
    expect(routeChatId({ id: CHAT_ID })).toBe(CHAT_ID);
    expect(routeChatId({ id: [CHAT_ID, OTHER_CHAT_ID] })).toBe(CHAT_ID);
  });

  it("opens a draft for routes.chat('new'), and for no usable id", () => {
    expect(routes.chat(NEW_CHAT_ID)).toBe('/chat/new');
    expect(routeChatId({ id: NEW_CHAT_ID })).toBeNull();
    expect(routeChatId({ id: ' ' })).toBeNull();
    expect(routeChatId({ id: '..' })).toBeNull();
    expect(routeChatId({})).toBeNull();
  });
});
