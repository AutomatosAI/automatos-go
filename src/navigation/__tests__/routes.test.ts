import { describe, expect, it } from 'vitest';

import {
  QUESTION_PARAM,
  TICKET_PARAM,
  chatWithTicket,
  isTaskId,
  isUsableId,
  questionFromTicketParams,
  routes,
  ticketFromChatParams,
  type RouteParams,
} from '../routes';

/** The params expo-router hands a screen for a URL: its query string, as useLocalSearchParams. */
function paramsOf(href: string): RouteParams {
  const query = href.split('?')[1] ?? '';
  return Object.fromEntries(new URLSearchParams(query));
}

describe('app routes', () => {
  it('has a fixed path for every screen the kits build', () => {
    expect(routes.home).toBe('/');
    expect(routes.signIn).toBe('/sign-in');
    expect(routes.chats).toBe('/chats');
    expect(routes.settings).toBe('/settings');
    expect(routes.cc.board).toBe('/cc');
    expect(routes.cc.calendar).toBe('/cc/calendar');
    expect(routes.cc.questions).toBe('/cc/questions');
    expect(routes.cc.deliverables).toBe('/cc/deliverables');
  });

  it('builds one conversation, one ticket, one social post and one Deliverable', () => {
    expect(routes.chat('3f2a-chat')).toBe('/chat/3f2a-chat');
    expect(routes.cc.ticket('419')).toBe('/cc/ticket/419');
    expect(routes.cc.ticket(419)).toBe('/cc/ticket/419');
    expect(routes.cc.social('post-7')).toBe('/cc/social/post-7');
    expect(routes.cc.deliverable('9b1c-dlv')).toBe('/cc/deliverables/9b1c-dlv');
  });

  it('URI-encodes an id into its one segment', () => {
    expect(routes.chat('a/b?c')).toBe('/chat/a%2Fb%3Fc');
    expect(routes.cc.deliverable(' d 1 ')).toBe('/cc/deliverables/d%201');
  });

  it('refuses an id that is blank or a dot segment', () => {
    for (const bad of ['', '   ', '.', '..']) {
      expect(() => routes.chat(bad)).toThrow(TypeError);
      expect(() => routes.cc.deliverable(bad)).toThrow(TypeError);
      expect(() => routes.cc.social(bad)).toThrow(TypeError);
    }
  });

  it('opens a ticket at one of its questions, as the web link does', () => {
    expect(routes.cc.ticket(42, 'g-9')).toBe('/cc/ticket/42?question=g-9');
    expect(routes.cc.ticket(42, 7)).toBe('/cc/ticket/42?question=7');
    expect(routes.cc.ticket(42, null)).toBe('/cc/ticket/42');
    expect(questionFromTicketParams(paramsOf(routes.cc.ticket(42, 'g-9')))).toBe('g-9');
    expect(questionFromTicketParams({})).toBeNull();
    expect(questionFromTicketParams({ [QUESTION_PARAM]: '  ' })).toBeNull();
  });

  it('takes only a board row id for a ticket (digits, as GET /api/v1/tasks/{task_id})', () => {
    expect(isTaskId('0419')).toBe(true);
    for (const bad of ['#0419', '0051.3', 'abc', '', '-1', '1e3']) {
      expect(isTaskId(bad)).toBe(false);
      expect(() => routes.cc.ticket(bad)).toThrow(TypeError);
    }
  });

  it('says which ids can be a path segment', () => {
    expect(isUsableId('c-1')).toBe(true);
    expect(isUsableId(' .. ')).toBe(false);
    expect(isUsableId('')).toBe(false);
  });
});

describe('chatWithTicket (D31: a new conversation with the ticket as context)', () => {
  it('has the web link shape, /chat?ticket=<row id>', () => {
    expect(chatWithTicket('419')).toBe(`/chat?${TICKET_PARAM}=419`);
    expect(chatWithTicket(419)).toBe('/chat?ticket=419');
    expect(routes.chatWithTicket).toBe(chatWithTicket);
  });

  it('decodes what it encodes', () => {
    for (const id of ['1', '419', '000042', 98765432101234]) {
      expect(ticketFromChatParams(paramsOf(chatWithTicket(id)))).toBe(String(id));
    }
  });

  it('refuses to encode anything but a row id', () => {
    for (const bad of ['#0419', 'abc', '', '4 1 9', '0051.3']) {
      expect(() => chatWithTicket(bad)).toThrow(TypeError);
    }
  });

  it('decodes no ticket from a link without one, or with one that is not a row id', () => {
    expect(ticketFromChatParams({})).toBeNull();
    expect(ticketFromChatParams({ ticket: '' })).toBeNull();
    expect(ticketFromChatParams({ ticket: '#0419' })).toBeNull();
    expect(ticketFromChatParams({ ticket: '419; drop' })).toBeNull();
    expect(ticketFromChatParams({ other: '419' })).toBeNull();
  });

  it('reads the first value when expo-router hands a repeated param as an array', () => {
    expect(ticketFromChatParams({ ticket: ['419', '7'] })).toBe('419');
    expect(ticketFromChatParams({ ticket: [] })).toBeNull();
    expect(ticketFromChatParams({ ticket: ' 419 ' })).toBe('419');
  });
});
