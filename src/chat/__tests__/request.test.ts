import { describe, expect, it } from 'vitest';

import { discussionSelection, type Discussion } from '../../core/web/lib/discussion';
import {
  CHAT_PAGE,
  ChatRequestSchema,
  buildChatRequest,
  localeTag,
  type ChatFile,
} from '../request';

const CHAT_ID = '0c5a9e1e-0000-4000-8000-00000000c001';

const PHOTO: ChatFile = {
  filename: 'receipt.jpg',
  mediaType: 'image/jpeg',
  attachmentId: 'att-1',
};
const REPORT: ChatFile = {
  filename: 'q3.pdf',
  mediaType: 'application/pdf',
  attachmentId: 'att-2',
  url: 'https://files.example.test/att-2',
};

const TICKET: Discussion = {
  ticketId: '612',
  number: '#0419',
  title: 'Draft the launch post',
  agentName: 'Scout',
  missionId: null,
};

describe('buildChatRequest', () => {
  it('sends a draft as one trimmed text part, private, with the page context, no id', () => {
    expect(buildChatRequest({ text: '  What needs me today?\n' })).toEqual({
      message: { role: 'user', parts: [{ type: 'text', text: 'What needs me today?' }] },
      selectedVisibilityType: 'private',
      context: { page: CHAT_PAGE, route: '/chat' },
    });
  });

  it("sends the live chat's id and keeps the text's own newlines", () => {
    const body = buildChatRequest({ chatId: CHAT_ID, text: 'line one\nline two' });
    expect(body.id).toBe(CHAT_ID);
    expect(body.message.parts).toEqual([{ type: 'text', text: 'line one\nline two' }]);
  });

  it('leaves the id out for a draft held as null', () => {
    expect(buildChatRequest({ chatId: null, text: 'hi' })).not.toHaveProperty('id');
  });

  it('puts the file parts first, then the text, and lists the attachment ids', () => {
    const body = buildChatRequest({ text: 'Read these', files: [PHOTO, REPORT] });
    expect(body.message).toEqual({
      role: 'user',
      parts: [
        { type: 'file', filename: 'receipt.jpg', mediaType: 'image/jpeg', attachment_id: 'att-1' },
        {
          type: 'file',
          filename: 'q3.pdf',
          mediaType: 'application/pdf',
          url: 'https://files.example.test/att-2',
          attachment_id: 'att-2',
        },
        { type: 'text', text: 'Read these' },
      ],
      attachment_ids: ['att-1', 'att-2'],
    });
  });

  it('sends a message of files only without a text part', () => {
    const body = buildChatRequest({ text: '   ', files: [PHOTO] });
    expect(body.message.parts).toEqual([
      { type: 'file', filename: 'receipt.jpg', mediaType: 'image/jpeg', attachment_id: 'att-1' },
    ]);
    expect(body.message.attachment_ids).toEqual(['att-1']);
  });

  it('carries the discussed ticket as the selected reference (lib/discussion.ts)', () => {
    const body = buildChatRequest({
      text: 'Why was this sent back?',
      context: { selected: discussionSelection(TICKET) },
    });
    expect(body.context).toEqual({
      page: 'chat',
      route: '/chat',
      selected: { type: 'board_task', id: '#0419' },
    });
  });

  it("selects the Mission on a Mission's ticket", () => {
    const body = buildChatRequest({
      text: 'Talk me through the plan',
      context: { selected: discussionSelection({ ...TICKET, missionId: 'run-9' }) },
    });
    expect(body.context.selected).toEqual({ type: 'mission', id: 'run-9' });
  });

  it('never sends planMode or missionMode (D30)', () => {
    const body = buildChatRequest({ chatId: CHAT_ID, text: 'Plan the launch', files: [PHOTO] });
    const wire = JSON.stringify(body);
    expect(wire).not.toMatch(/planMode|missionMode/);
    expect(ChatRequestSchema.safeParse({ ...body, planMode: true }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ ...body, missionMode: true }).success).toBe(false);
  });

  it('refuses a message with nothing to send before anything goes out', () => {
    expect(() => buildChatRequest({ text: '  \n ' })).toThrow(TypeError);
    expect(() => buildChatRequest({ text: '', files: [] })).toThrow(/message\.parts/);
  });

  it('refuses a file without an attachment id and a route that is not a path', () => {
    expect(() => buildChatRequest({ text: 'x', files: [{ ...PHOTO, attachmentId: '' }] })).toThrow(
      TypeError,
    );
    expect(() => buildChatRequest({ text: 'x', context: { route: 'chat' } })).toThrow(TypeError);
  });

  it('refuses a selection longer than the server keeps', () => {
    const long = { type: 'board_task', id: 'x'.repeat(129) };
    expect(() => buildChatRequest({ text: 'x', context: { selected: long } })).toThrow(TypeError);
  });

  it('never mutates its input', () => {
    const files = Object.freeze([Object.freeze({ ...PHOTO })]);
    const input = Object.freeze({ text: 'hi', files, context: Object.freeze({ route: '/chat' }) });
    expect(() => buildChatRequest(input)).not.toThrow();
    expect(input.files[0]).toEqual(PHOTO);
  });
});

describe('the locale (BCP 47)', () => {
  it('goes out as given: the language the person speaks', () => {
    expect(buildChatRequest({ text: 'Oi', locale: 'pt-BR' })).toHaveProperty('locale', 'pt-BR');
    expect(buildChatRequest({ text: 'Hola', locale: 'es-419' })).toHaveProperty('locale', 'es-419');
  });

  it("writes iOS's underscore form with a hyphen and trims it", () => {
    expect(localeTag(' pt_BR ')).toBe('pt-BR');
    expect(buildChatRequest({ text: 'Oi', locale: 'pt_BR' })).toHaveProperty('locale', 'pt-BR');
  });

  it('is left out when absent, blank or not a tag: never sent malformed, never thrown on', () => {
    for (const locale of [undefined, '', '  ', 'pt BR', 'português', 'p', `en-${'x'.repeat(40)}`]) {
      const body = buildChatRequest({ text: 'hi', locale });
      expect(body).not.toHaveProperty('locale');
    }
  });

  it('is a field the strict schema knows, and only as a tag', () => {
    const body = buildChatRequest({ text: 'hi' });
    expect(ChatRequestSchema.safeParse({ ...body, locale: 'en-GB' }).success).toBe(true);
    expect(ChatRequestSchema.safeParse({ ...body, locale: 'not a tag' }).success).toBe(false);
  });
});
