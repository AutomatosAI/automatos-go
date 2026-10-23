import { describe, expect, it } from 'vitest';

import { ADDRESS_MAX_LENGTH, PAIR_CODE_INPUT_MAX_LENGTH } from '../../connect/config';
import {
  CONNECT_CODE_PARAM,
  CONNECT_ORIGIN_PARAM,
  QUESTION_PARAM,
  TICKET_PARAM,
  chatWithTicket,
  connectPrefillFromParams,
  connectWith,
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

describe("Connect's routes and prefill (US-006d)", () => {
  it('has the connect paths: Welcome, Connect, the scanner and the pairing link', () => {
    expect(routes.welcome).toBe('/welcome');
    expect(routes.connect).toBe('/connect');
    expect(routes.connectScan).toBe('/connect/scan');
    expect(routes.pairLink).toBe('/go/pair');
    expect(routes.connectWith).toBe(connectWith);
  });

  it('is plain /connect with nothing to prefill', () => {
    expect(connectWith()).toBe('/connect');
    expect(connectWith({ origin: '  ', code: '' })).toBe('/connect');
  });

  it('carries the server and the code, URI-encoded, as origin and code', () => {
    const href = connectWith({ origin: 'http://192.168.1.20:8000', code: 'ABCD-2345' });
    expect(href).toBe('/connect?origin=http%3A%2F%2F192.168.1.20%3A8000&code=ABCD-2345');
    expect(paramsOf(href)).toEqual({
      [CONNECT_ORIGIN_PARAM]: 'http://192.168.1.20:8000',
      [CONNECT_CODE_PARAM]: 'ABCD-2345',
    });
  });

  it('decodes what it encodes, either value alone', () => {
    const both = { origin: 'https://nas.example.com/a?b=c&d', code: 'abcd 2345' };
    expect(connectPrefillFromParams(paramsOf(connectWith(both)))).toEqual(both);
    expect(connectPrefillFromParams(paramsOf(connectWith({ origin: 'nas.local' })))).toEqual({
      origin: 'nas.local',
    });
    expect(connectPrefillFromParams(paramsOf(connectWith({ code: 'ABCD2345' })))).toEqual({
      code: 'ABCD2345',
    });
  });

  it('keeps no value longer than any real one, or blank, from untrusted params', () => {
    const long = {
      origin: `https://${'a'.repeat(ADDRESS_MAX_LENGTH)}`,
      code: 'A'.repeat(PAIR_CODE_INPUT_MAX_LENGTH + 1),
    };
    expect(connectWith(long)).toBe('/connect');
    expect(connectPrefillFromParams(long)).toEqual({});
    expect(connectPrefillFromParams({ origin: '   ', code: '' })).toEqual({});
  });

  it('reads the first value of a repeated param, trimmed, and ignores every other param', () => {
    expect(
      connectPrefillFromParams({
        origin: [' nas.local ', 'evil.example'],
        code: ['ABCD-2345'],
        token: 'x',
      }),
    ).toEqual({ origin: 'nas.local', code: 'ABCD-2345' });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(connectPrefillFromParams({ origin: 'nas.local' }))).toBe(true);
  });
});
