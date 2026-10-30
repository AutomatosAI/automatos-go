import { describe, expect, it } from 'vitest';

import { StoredMessageSchema, StoredMessagesSchema } from '../../chat/schemas';
import type { ChatMessage } from '../../core/web/types';
import { messageText } from '../../core/web/lib/chat/message-text';
import { BriefOpenSchema, BriefSchema } from '../schema';
import { PROSE, WIRE_BRIEF, briefMessage, row, sections } from './fixtures';

describe('BriefSchema (Brief@1)', () => {
  it('reads every section, count and row field, ignoring unknown fields', () => {
    const brief = BriefSchema.parse({
      ...WIRE_BRIEF,
      extra: true,
      counts: { ...WIRE_BRIEF.counts, x: 9 },
    });
    expect(brief).not.toHaveProperty('extra');
    expect(brief.sections.needs_you.map((each) => each.id)).toEqual(['n1', 'n2']);
    expect(brief.sections.needs_you[0]).toEqual({
      id: 'n1',
      title: 'Send the launch email',
      why: 'Because n1',
      number: '#0846',
      display_state: undefined,
      opens: { type: 'question', id: '31' },
      action: { verb: 'answer', label: 'Answer' },
    });
    expect(brief.counts).toEqual({ needs_you: 2, suggestions: 1, today: 1, since: 1 });
    expect(brief.spoken).toBe('Morning, Sam. One: the launch email.');
  });

  it('leaves out a row it cannot read and keeps the rest of the section', () => {
    const brief = BriefSchema.parse({
      ...WIRE_BRIEF,
      sections: sections({
        today: [{ id: '', title: 'x' }, { title: 'no id' }, 'junk', row('t2')],
      }),
    });
    expect(brief.sections.today.map((each) => each.id)).toEqual(['t2']);
  });

  it('drops an opens or an action it does not know, never the row', () => {
    const brief = BriefSchema.parse({
      ...WIRE_BRIEF,
      sections: sections({
        today: [
          row('t1', {
            opens: { type: 'calendar', id: 'c1' },
            action: { verb: 'snooze', label: 'Snooze' },
            display_state: 'sleeping',
          }),
        ],
      }),
    });
    const [only] = brief.sections.today;
    expect(only.id).toBe('t1');
    expect(only.opens).toBeUndefined();
    expect(only.action).toBeUndefined();
    expect(only.display_state).toBeNull();
  });

  it('reads missing sections and counts as empty, and refuses another version', () => {
    const bare = BriefSchema.parse({ v: 1, date: '2026-10-28' });
    expect(bare.sections.needs_you).toEqual([]);
    expect(bare.counts.needs_you).toBe(0);
    expect(bare.greeting).toBe('');
    expect(BriefSchema.safeParse({ ...WIRE_BRIEF, v: 2 }).success).toBe(false);
  });
});

describe('a saved message carrying brief@1', () => {
  it('keeps the text part as the answer and the brief beside the core parts', () => {
    const message = briefMessage();
    expect(message.parts).toEqual([{ type: 'text', text: PROSE }]);
    expect(message.structured?.map((part) => part.type)).toEqual(['brief@1']);
    expect(messageText(message as unknown as ChatMessage)).toBe(PROSE);
  });

  it('is still the web’s ChatMessage, and a message without one has no structured parts', () => {
    const messages: ChatMessage[] = StoredMessagesSchema.parse([
      { id: 'm1', role: 'assistant', parts: [{ type: 'text', text: 'Hi' }] },
    ]);
    expect(messages[0]).not.toHaveProperty('structured');
  });

  it('leaves out a brief of another version: the text part shows as today', () => {
    const message = briefMessage('m-2', { ...WIRE_BRIEF, v: 2 });
    expect(message.parts).toEqual([{ type: 'text', text: PROSE }]);
    expect(message).not.toHaveProperty('structured');
  });

  it('reads the parts of any saved message unchanged without a brief', () => {
    const message = StoredMessageSchema.parse({
      id: 'm3',
      role: 'user',
      parts: [{ type: 'text', text: 'Brief me' }],
    });
    expect(message.parts).toEqual([{ type: 'text', text: 'Brief me' }]);
  });
});

describe('BriefOpenSchema', () => {
  it('reads won, taken and pending answers', () => {
    expect(BriefOpenSchema.parse({ chat_id: 'c1', message_id: 'm1', posted: true })).toEqual({
      chat_id: 'c1',
      message_id: 'm1',
      posted: true,
      pending: false,
    });
    expect(BriefOpenSchema.parse({ posted: false, pending: true })).toEqual({
      chat_id: null,
      message_id: null,
      posted: false,
      pending: true,
    });
    expect(BriefOpenSchema.parse({ chat_id: 4, posted: 'yes' })).toMatchObject({
      chat_id: null,
      posted: false,
    });
  });
});
