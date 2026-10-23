// The thread's rows in order (US-008c): the receipts' closing notes and links through the
// foundation's appRouteForWebLink, tool lines while and after a reply, Auto's paragraphs, the draft
// and 'Auto is working…', Try again's message (words and files), the scroll rule and the pulse
// under Reduce Motion.

import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/errors';
import { NO_ACTIONS, NOTHING_ON_THE_BOARD } from '../../core/web/lib/chat/receipts';
import { createThread, type ThreadState } from '../controller/thread';
import type { ChatFile } from '../request';
import type { StoredMessage } from '../schemas';
import {
  LIVE_AUTO_KEY,
  LIVE_USER_KEY,
  WORKING_KEY,
  paragraphs,
  receiptsView,
  retryInput,
  shouldScrollToEnd,
  threadRows,
  toolLineRows,
  workingMotion,
} from '../view-model';
import { AT, CHAT_ID, deepFreeze, saved } from './thread-fixtures';
import {
  WEB,
  apply,
  autoRows,
  frames,
  notices,
  opened,
  receipt,
  streaming,
} from './view-model-fixtures';

describe('receipts: notes and links', () => {
  it('closes with the core’s notes: nothing ran, nothing moved on the board, or none', () => {
    expect(receiptsView([])).toEqual({ lines: [], note: NO_ACTIONS });
    expect(receiptsView([receipt({ kind: 'read' })])?.note).toBe(NOTHING_ON_THE_BOARD);
    expect(receiptsView([receipt({ subject: 'Scout' })])?.note).toBe(NOTHING_ON_THE_BOARD);
    expect(receiptsView([receipt({})])?.note).toBeNull();
  });

  it('shows nothing for a reply from before receipts', () => {
    expect(receiptsView(undefined)).toBeNull();
  });

  it('maps links through appRouteForWebLink: app screens, Studio, never another site', () => {
    const view = receiptsView(
      [
        receipt({ link: '/command-center?tab=board&task_id=42' }),
        receipt({ link: '/agents?agent=3' }),
        receipt({ link: '//evil.example/x' }),
        receipt({ link: 'https://evil.example/x' }),
        receipt({ link: null }),
      ],
      { webUrl: WEB },
    );
    expect(view?.lines.map((line) => line.link)).toEqual([
      { app: '/cc/ticket/42' },
      { external: `${WEB}/agents?agent=3` },
      null,
      null,
      null,
    ]);
  });
});

describe('tool lines while and after the reply', () => {
  it('spins while the reply is written; a call left running by Stop reads Stopped', () => {
    const state = streaming({
      kind: 'tool-start',
      toolCallId: 't1',
      toolName: 'platform_web_search',
      input: { query: 'ferry times' },
    });
    const [running] = autoRows(threadRows(state))[0].toolLines;
    expect(running).toMatchObject({ mark: null, tone: 'running' });
    expect(running.text).toBe("Searching the web: 'ferry times'");
    expect(running.accessibilityLabel).toBe("Running, Searching the web: 'ferry times'");
    const [stopped] = autoRows(threadRows(apply(state, { type: 'stopped', at: AT })))[0].toolLines;
    expect(stopped).toEqual({
      key: 't1',
      mark: '–',
      tone: 'muted',
      text: 'Stopped: searching the web',
      accessibilityLabel: 'Stopped: searching the web',
    });
  });

  it('says done and failed calls in words, each with its status word', () => {
    const lines = toolLineRows(
      [
        {
          toolCallId: 'a',
          toolName: 'platform_web_search',
          state: 'completed',
          summary: '3 results',
          durationMs: 2140,
        },
        { toolCallId: 'b', toolName: 'send_email', state: 'error', error: 'Mailbox is full' },
      ],
      false,
    );
    expect(lines.map((line) => [line.mark, line.text, line.accessibilityLabel])).toEqual([
      ['✓', 'Searched the web · 3 results · 2.1 s', 'Done, Searched the web · 3 results · 2.1 s'],
      [
        '✕',
        "Send email didn't work · Mailbox is full",
        "Failed, Send email didn't work · Mailbox is full",
      ],
    ]);
  });
});

describe('Auto’s paragraphs', () => {
  it('splits paragraphs on blank lines and keeps single line breaks', () => {
    expect(paragraphs('One\nline two\n\n\nThree\n\n  ')).toEqual(['One\nline two', 'Three']);
  });

  it('puts the platform’s lines above a live reply before its words', () => {
    const state = streaming(
      { kind: 'text', text: 'Here you go.' },
      { kind: 'receipts', receipts: [], above: ['I could not send the letter.'] },
    );
    const [auto] = autoRows(threadRows(state));
    expect(auto.paragraphs).toEqual(['I could not send the letter.', 'Here you go.']);
    expect(auto.receipts?.note).toBe(NO_ACTIONS);
  });
});

describe('rows', () => {
  it('draws saved messages in order with their receipts and the user’s files', () => {
    const user: StoredMessage = {
      ...saved('m1', 'user', 'Look at this'),
      attachments: [
        { attachment_id: 'a1', filename: 'plan.pdf', mime: 'x', media_type: 'document' },
      ],
    };
    const reply: StoredMessage = {
      ...saved('m2', 'assistant', 'Filed.'),
      parts: [
        { type: 'receipts', receipts: [receipt({})] },
        { type: 'text', text: 'Filed.' },
      ],
    };
    const rows = threadRows(deepFreeze(opened([user, reply])));
    expect(rows.map((row) => [row.type, row.key])).toEqual([
      ['user', 'm1'],
      ['auto', 'm2'],
    ]);
    expect(rows[0]).toMatchObject({
      text: 'Look at this',
      files: ['plan.pdf'],
      accessibilityLabel: 'You said, Look at this, Attached: plan.pdf',
    });
    expect(rows[1]).toMatchObject({ messageId: 'm2', paragraphs: ['Filed.'] });
    expect(autoRows(rows)[0].receipts?.lines).toHaveLength(1);
  });

  it('shows nothing while the chat is being checked', () => {
    expect(threadRows(createThread(CHAT_ID))).toEqual([]);
  });

  it('shows the draft and Auto is working until the answer starts', () => {
    const sent = streaming();
    expect(threadRows(sent).map((row) => row.key)).toEqual([LIVE_USER_KEY, WORKING_KEY]);
    const answering = apply(sent, ...frames({ kind: 'text', text: 'On it.' }));
    expect(threadRows(answering).map((row) => row.key)).toEqual([LIVE_USER_KEY, LIVE_AUTO_KEY]);
  });

  it('shows Auto is working on a chat reopened while its turn runs', () => {
    const reopened = apply(createThread(CHAT_ID), {
      type: 'loaded',
      chatId: CHAT_ID,
      messages: [saved('m1', 'user', 'Status?')],
      turnInFlight: true,
    });
    expect(threadRows(reopened).map((row) => row.type)).toEqual(['user', 'working']);
  });
});

const PHOTO: ChatFile = {
  filename: 'photo.jpg',
  mediaType: 'image/jpeg',
  attachmentId: 'att-photo',
};

/** After 'summarise the board' and Auto's reply, the user sent this and the network failed. */
function failedAfterQuestion(text: string, files: readonly ChatFile[]): ThreadState {
  const earlier = opened([
    saved('m1', 'user', 'summarise the board'),
    saved('m2', 'assistant', 'Three tickets.'),
  ]);
  return apply(
    earlier,
    { type: 'send', draft: { text, files, sentAt: null } },
    { type: 'failed', error: new ApiError('network') },
  );
}

const offersRetry = (state: ThreadState) =>
  notices(threadRows(state)).map((notice) => [notice.kind, notice.retry]);

describe('Try again', () => {
  it('repeats a files-only message: blank words and its files, never the earlier question', () => {
    const failed = deepFreeze(failedAfterQuestion('', [PHOTO]));
    expect(retryInput(failed)).toEqual({ text: '', files: [PHOTO] });
    expect(offersRetry(failed)).toEqual([['failed', true]]);
  });

  it('repeats a message’s words and its files together', () => {
    const failed = failedAfterQuestion('  What is this?  ', [PHOTO]);
    expect(retryInput(failed)).toEqual({ text: 'What is this?', files: [PHOTO] });
    expect(
      retryInput(apply(streaming(), { type: 'failed', error: new ApiError('network') })),
    ).toEqual({ text: 'Status?', files: [] });
  });

  it('with no live draft (a saved failure), asks the newest saved words again, no files', () => {
    const error: StoredMessage = {
      ...saved('m2', 'assistant', 'Something broke.'),
      source: { label: 'Error', origin: 'turn_error', code: 'turn_failed' },
    };
    const state = opened([saved('m1', 'user', 'First'), error]);
    expect(retryInput(state)).toEqual({ text: 'First', files: [] });
    expect(offersRetry(state)).toEqual([['failed', true]]);
    expect(retryInput(opened())).toBeNull();
  });

  it('a live draft with neither words nor files asks nothing: its notice has no Try again', () => {
    const failed = failedAfterQuestion('   ', []);
    expect(retryInput(failed)).toBeNull();
    expect(offersRetry(failed)).toEqual([['failed', false]]);
  });
});

describe('scrolling and motion', () => {
  it('scrolls only when a row is added', () => {
    expect(shouldScrollToEnd(2, 3)).toBe(true);
    expect(shouldScrollToEnd(3, 3)).toBe(false);
    expect(shouldScrollToEnd(3, 2)).toBe(false);
  });

  it('stops the working pulse under Reduce Motion', () => {
    expect(workingMotion(true)).toEqual({ pulse: false });
    expect(workingMotion(false)).toEqual({ pulse: true });
  });
});
