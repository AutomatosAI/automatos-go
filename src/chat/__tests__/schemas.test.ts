import { describe, expect, it } from 'vitest';

import { proposedBrief } from '../../core/web/lib/discussion';
import type { ChatMessage } from '../../core/web/types';
import {
  CancelResultSchema,
  ChatAgentsSchema,
  ChatThreadSchema,
  GrantResultSchema,
  HistorySchema,
  MissionRunSchema,
  StoredMessageSchema,
  StoredMessagesSchema,
} from '../schemas';

const CHAT_ID = '0c5a9e1e-0000-4000-8000-00000000c001';
const AT = '2026-10-21T08:30:00Z';

const RECEIPT = {
  action: 'board_move_task',
  kind: 'write',
  status: 'done',
  subject: '#0422',
  effect: 'moved to Done',
  link: '/command-center?tab=board&task_id=422',
  reason: null,
};

/** A saved reply as GET /api/chat/{id}/messages answers it (api/chat.py:778-789). */
const REPLY = {
  id: 'm-2',
  role: 'assistant',
  parts: [
    { type: 'receipts', receipts: [RECEIPT] },
    { type: 'reasoning', reasoning: 'Checking the board' },
    { type: 'narration', narration: 'Let me look.' },
    { type: 'text', text: 'Done: #0422 is in Done.' },
  ],
  attachments: [],
  source: null,
  createdAt: AT,
};

const CARD = {
  id: 431,
  number: '#0431',
  title: 'Draft',
  status: 'inbox',
  assigned_agent: 'Scout',
};

/** A user's parts as api/chat.py saves them: part.dict(), every field present, nulls included. */
const SAVED_FILE_PART = {
  type: 'file',
  text: null,
  filename: 'q3.pdf',
  mediaType: 'application/pdf',
  url: null,
  attachment_id: 'att-2',
};
const SAVED_TEXT_PART = {
  type: 'text',
  text: 'Read this',
  filename: null,
  mediaType: null,
  url: null,
  attachment_id: null,
};

const ATTACHMENT = {
  attachment_id: 'att-1',
  filename: 'a.jpg',
  mime: 'image/jpeg',
  media_type: 'image',
};

describe('ChatThreadSchema', () => {
  const CHAT = {
    id: CHAT_ID,
    userId: 7,
    title: 'Launch post',
    createdAt: AT,
    updatedAt: AT,
    visibility: 'private',
    lastContext: { promptTokens: 1, completionTokens: 2, totalTokens: 3, cost: 0.01 },
    kind: 'user',
    turnInFlight: true,
  };

  it('keeps what the chat shows and drops the rest (user id, usage, visibility)', () => {
    expect(ChatThreadSchema.parse({ ...CHAT, futureField: 'x' })).toEqual({
      id: CHAT_ID,
      title: 'Launch post',
      createdAt: AT,
      updatedAt: AT,
      kind: 'user',
      turnInFlight: true,
    });
  });

  it('reads no turnInFlight as no turn running, and an unknown kind as the user’s', () => {
    const older = { ...CHAT, turnInFlight: undefined, kind: 'team' };
    expect(ChatThreadSchema.parse(older)).toMatchObject({ turnInFlight: false, kind: 'user' });
  });

  it('refuses a chat without an id', () => {
    expect(ChatThreadSchema.safeParse({ ...CHAT, id: '' }).success).toBe(false);
  });
});

describe('StoredMessageSchema', () => {
  it('reads every part kind the chat renders, ignoring unknown fields', () => {
    const message = StoredMessageSchema.parse({
      ...REPLY,
      retrieval_context: { secret: true },
      parts: [...REPLY.parts, { type: 'task_card', card: { ...CARD, extra: 1 } }],
    });
    expect(message).not.toHaveProperty('retrieval_context');
    expect(message.parts.map((part) => part.type)).toEqual([
      'receipts',
      'reasoning',
      'narration',
      'text',
      'task_card',
    ]);
    expect(message.parts[0]).toEqual({ type: 'receipts', receipts: [RECEIPT] });
    expect(message.parts[4]).toEqual({ type: 'task_card', card: CARD });
  });

  it("reads a user's saved file part (url null as sent) and its text", () => {
    const message = StoredMessageSchema.parse({
      ...REPLY,
      id: 'm-1',
      role: 'user',
      parts: [SAVED_FILE_PART, SAVED_TEXT_PART],
      attachments: null,
    });
    expect(message.parts).toEqual([
      {
        type: 'file',
        filename: 'q3.pdf',
        mediaType: 'application/pdf',
        url: '',
        attachment_id: 'att-2',
      },
      { type: 'text', text: 'Read this' },
    ]);
    expect(message.attachments).toEqual([]);
  });

  it('leaves out a part type this version does not know and a receipt it cannot read', () => {
    const message = StoredMessageSchema.parse({
      ...REPLY,
      parts: [
        { type: 'artifact', artifact: { id: 'a' } },
        { type: 'receipts', receipts: [RECEIPT, { action: 'x', status: 'exploded' }, 'junk'] },
        { type: 'text' },
        { type: 'text', text: 'kept' },
      ],
    });
    expect(message.parts).toEqual([
      { type: 'receipts', receipts: [RECEIPT] },
      { type: 'text', text: 'kept' },
    ]);
  });

  it("reads a receipt's missing words as '' and an unknown kind as a read", () => {
    const bare = { action: 'look', status: 'skipped', kind: 'peek' };
    const message = StoredMessageSchema.parse({
      ...REPLY,
      parts: [{ type: 'receipts', receipts: [bare] }],
    });
    expect(message.parts[0]).toEqual({
      type: 'receipts',
      receipts: [
        {
          action: 'look',
          kind: 'read',
          status: 'skipped',
          subject: '',
          effect: '',
          link: null,
          reason: null,
        },
      ],
    });
  });

  it('keeps the provenance (a saved turn error) and the attachments metadata', () => {
    const message = StoredMessageSchema.parse({
      ...REPLY,
      source: { label: 'Auto', origin: 'turn_error', code: 'trial_exhausted', extra: 1 },
      attachments: [{ ...ATTACHMENT, s3_key: 'k' }],
    });
    expect(message.source).toEqual({
      label: 'Auto',
      origin: 'turn_error',
      code: 'trial_exhausted',
    });
    expect(message.attachments).toEqual([ATTACHMENT]);
  });

  it('reads a provenance without a code, or with a code of the wrong type, as code-less', () => {
    const without = StoredMessageSchema.parse({
      ...REPLY,
      source: { label: 'Error', origin: 'x' },
    });
    const wrong = StoredMessageSchema.parse({
      ...REPLY,
      source: { label: 'E', origin: 'x', code: 4 },
    });
    expect(without.source?.code ?? null).toBeNull();
    expect(wrong.source).toEqual({ label: 'E', origin: 'x', code: null });
  });

  it('is the web’s ChatMessage, so the vendored helpers read it (proposedBrief)', () => {
    const messages: ChatMessage[] = StoredMessagesSchema.parse([
      { ...REPLY, parts: [{ type: 'text', text: 'Agreed:\n```\nShorter, two links.\n```' }] },
    ]);
    expect(proposedBrief(messages)).toBe('Shorter, two links.');
  });
});

describe('StoredMessagesSchema', () => {
  it('leaves out a message it cannot read (a system row, no id) and keeps the rest', () => {
    const messages = StoredMessagesSchema.parse([
      { ...REPLY, role: 'system' },
      { ...REPLY, id: '' },
      REPLY,
    ]);
    expect(messages.map((message) => message.id)).toEqual(['m-2']);
  });

  it('refuses a body that is not a list', () => {
    expect(StoredMessagesSchema.safeParse({ messages: [REPLY] }).success).toBe(false);
  });
});

describe('HistorySchema', () => {
  const ROW = {
    id: CHAT_ID,
    userId: 7,
    title: 'Launch post',
    createdAt: AT,
    updatedAt: AT,
    visibility: 'private',
    lastContext: null,
    lastMessagePreview: 'Done: #0422 is in Done.',
    kind: 'auto',
  };
  const READ = {
    id: CHAT_ID,
    title: 'Launch post',
    createdAt: AT,
    updatedAt: AT,
    lastMessagePreview: 'Done: #0422 is in Done.',
    kind: 'auto',
  };

  it("reads each row's title, preview, times and kind, dropping the rest", () => {
    expect(HistorySchema.parse([ROW])).toEqual([READ]);
  });

  it('reads a row without a preview or kind and leaves out one without an id', () => {
    const bare = { ...ROW, lastMessagePreview: undefined, kind: undefined };
    expect(HistorySchema.parse([bare, { ...ROW, id: 5 }])).toEqual([
      { ...READ, lastMessagePreview: null, kind: 'user' },
    ]);
  });
});

describe('ChatAgentsSchema', () => {
  it('keeps id, name, type, description and the default flag; drops config and skills', () => {
    const auto = {
      id: 1,
      name: 'Auto',
      agent_type: 'system',
      description: 'The workspace AI',
      is_default: true,
    };
    const body = ChatAgentsSchema.parse({
      agents: [
        { ...auto, status: 'active', skills: ['x'], model_config: { model: 'm' }, tags: [] },
        { id: 'not-a-number', name: 'Broken' },
      ],
    });
    expect(body.agents).toEqual([auto]);
  });
});

describe('card action responses', () => {
  it('reads a Mission run (create, approve, reject) by id, goal and state', () => {
    const run = { id: 'run-9', goal: 'Launch', state: 'planning' };
    expect(MissionRunSchema.parse({ ...run, plan: {}, workspace_id: 'w' })).toEqual(run);
  });

  it("reads a grant's id and status from {grant}", () => {
    const grant = { id: 12, status: 'granted' };
    const body = { grant: { ...grant, tool_name: 'send_email', reason: 'r' } };
    expect(GrantResultSchema.parse(body)).toEqual({ grant });
  });

  it('reads the cancel answer, false when absent', () => {
    expect(CancelResultSchema.parse({ cancelled: true, extra: 1 })).toEqual({ cancelled: true });
    expect(CancelResultSchema.parse({})).toEqual({ cancelled: false });
  });
});
