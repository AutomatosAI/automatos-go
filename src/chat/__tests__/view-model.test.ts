// The thread's rows (US-008c): each receipt status with its mark, word and tag, a waiting tool line
// (never failed), narration kept out of the answer, and every notice in the kit's words: a limit
// never echoes the server's. Rows, links, Try again and scrolling: view-model-rows.test.ts.

import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/errors';
import { API_ERROR_COPY } from '../../api/strings';
import { TURN_ERROR_CODES } from '../../core/turn-reducer';
import type { StoredMessage } from '../schemas';
import { CHAT_COPY, RECEIPT_STATUS_WORDS, TURN_ERROR_COPY } from '../strings';
import { receiptsView, threadRows } from '../view-model';
import { AT, saved } from './thread-fixtures';
import {
  allText,
  apply,
  autoRows,
  notices,
  opened,
  receipt,
  streaming,
} from './view-model-fixtures';

describe('receiptsView', () => {
  it('draws each status with its mark, tone, words and Play’s tag', () => {
    const view = receiptsView([
      receipt({}),
      receipt({ kind: 'read', subject: 'the board', effect: 'read 9 tickets' }),
      receipt({ status: 'waiting', subject: '', effect: 'card raised: change an agent' }),
      receipt({ status: 'refused', subject: 'Letter to Maya', reason: 'not allowed' }),
      receipt({ status: 'skipped', subject: '#0419', reason: null }),
    ]);
    expect(
      view?.lines.map(({ status, mark, tone, text, badge }) => ({
        status,
        mark,
        tone,
        text,
        badge,
      })),
    ).toEqual([
      { status: 'done', mark: '✓', tone: 'done', text: '#0425: moved to Review', badge: 'Done' },
      { status: 'done', mark: '✓', tone: 'done', text: 'the board: read 9 tickets', badge: null },
      {
        status: 'waiting',
        mark: '…',
        tone: 'waiting',
        text: 'card raised: change an agent — waiting for you',
        badge: null,
      },
      {
        status: 'refused',
        mark: '✕',
        tone: 'failed',
        text: 'Letter to Maya: tried, refused: not allowed',
        badge: 'Not done',
      },
      {
        status: 'skipped',
        mark: '–',
        tone: 'muted',
        text: '#0419: not run: no reason given',
        badge: 'Skipped',
      },
    ]);
  });

  it('gives every line its status word for screen readers, never the mark alone', () => {
    const view = receiptsView([
      receipt({}),
      receipt({ status: 'waiting', effect: 'card raised' }),
      receipt({ status: 'refused', reason: 'no' }),
      receipt({ status: 'skipped' }),
    ]);
    const labels = view?.lines.map((line) => line.accessibilityLabel) ?? [];
    expect(labels).toEqual([
      'Done, #0425: moved to Review',
      'card raised — waiting for you',
      'Not done, #0425: tried, refused: no',
      'Skipped, #0425: not run: no reason given',
    ]);
    labels.forEach((label, index) => {
      const word = Object.values(RECEIPT_STATUS_WORDS)[index];
      expect(label.toLowerCase()).toContain(word.toLowerCase());
      expect(label).not.toMatch(/[✓…✕–]/u);
    });
  });
});

describe('tool lines', () => {
  it('draws a waiting call as waiting, never as failed', () => {
    const state = streaming(
      { kind: 'tool-start', toolCallId: 't1', toolName: 'platform_request_approval' },
      {
        kind: 'tool-end',
        toolCallId: 't1',
        toolName: 'platform_request_approval',
        success: false,
        summary: 'Approval card raised',
        skipped: false,
        waiting: true,
      },
    );
    const [line] = autoRows(threadRows(state))[0].toolLines;
    expect(line).toMatchObject({ mark: '…', tone: 'waiting' });
    expect(line.text).toBe('Waiting for you · Approval card raised');
    expect(line.accessibilityLabel).not.toMatch(/fail/i);
  });
});

describe('Auto’s text', () => {
  it('takes the narration out of a live answer', () => {
    const state = streaming(
      { kind: 'text', text: 'Let me check the board. ' },
      { kind: 'narration', text: 'Let me check the board. ', retracted: false },
      { kind: 'text', text: 'Two tickets are blocked.' },
    );
    expect(autoRows(threadRows(state))[0].paragraphs).toEqual(['Two tickets are blocked.']);
  });

  it('never shows a saved reply’s narration part', () => {
    const reply: StoredMessage = {
      ...saved('m2', 'assistant', 'Done.'),
      parts: [
        { type: 'narration', narration: 'Looking now…' },
        { type: 'text', text: 'Done.' },
      ],
    };
    const rows = threadRows(opened([saved('m1', 'user', 'Go'), reply]));
    expect(autoRows(rows)[0].paragraphs).toEqual(['Done.']);
    expect(allText(rows)).not.toContain('Looking now');
  });
});

describe('notices', () => {
  it('says a limit in the kit’s words, never the server’s', () => {
    const state = streaming(
      {
        kind: 'limit_reached',
        limit: { limit: 'turns', value: 50, message: 'Upgrade to Pro for more credits' },
      },
      { kind: 'finish', finishReason: 'stop', aiGenerated: true },
    );
    const rows = threadRows(apply(state, { type: 'finished' }));
    expect(notices(rows)).toEqual([
      expect.objectContaining({ kind: 'limit', text: CHAT_COPY.limit }),
    ]);
    expect(allText(rows)).not.toMatch(/upgrade|credit|pro\b/i);
  });

  it('names a file Auto could not open, or says an attachment when it has no name', () => {
    const state = streaming({
      kind: 'attachment_unavailable',
      attachments: [
        { attachmentId: 'a1', filename: 'scan.heic' },
        { attachmentId: 'a2', filename: null },
      ],
    });
    expect(notices(threadRows(state)).map((notice) => [notice.kind, notice.text])).toEqual([
      ['attachment', CHAT_COPY.attachmentUnavailable('scan.heic')],
      ['attachment', CHAT_COPY.attachmentUnavailable(null)],
    ]);
  });

  it.each(TURN_ERROR_CODES)('says a turn that failed with %s in the kit’s words', (code) => {
    const failed = apply(
      streaming({ kind: 'error', message: 'Your trial credit is spent: upgrade', code }),
      { type: 'finished' },
    );
    const [notice] = notices(threadRows(failed));
    expect(notice).toMatchObject({
      kind: 'failed',
      text: TURN_ERROR_COPY[code].text,
      retry: TURN_ERROR_COPY[code].canRetry,
    });
    expect(allText(threadRows(failed))).not.toMatch(/credit|upgrade/i);
  });

  it('says a trial or rate limit as the kit’s limit copy, never a plan', () => {
    expect(TURN_ERROR_COPY.trial_exhausted).toEqual({ text: CHAT_COPY.limit, canRetry: false });
    expect(TURN_ERROR_COPY.rate_limited.text).not.toMatch(/plan|credit|upgrade|price/i);
  });

  it('says a request that failed by its kind, or by a turn code it carries', () => {
    const failWith = (error: unknown) =>
      notices(threadRows(apply(streaming(), { type: 'failed', error })))[0];
    expect(failWith(new ApiError('network'))).toMatchObject({
      text: API_ERROR_COPY.network,
      retry: true,
    });
    expect(failWith(new ApiError('forbidden', { serverMessage: 'Plan X only' }))).toMatchObject({
      text: API_ERROR_COPY.forbidden,
      retry: false,
    });
    expect(
      failWith(new ApiError('server', { status: 402, code: 'trial_exhausted' })),
    ).toMatchObject({ text: CHAT_COPY.limit, retry: false });
  });

  it('says a stop, and a stop that did not reach the server', () => {
    const stopped = apply(streaming(), { type: 'stopped', at: AT });
    expect(notices(threadRows(stopped))).toEqual([
      expect.objectContaining({ kind: 'stopped', text: CHAT_COPY.stopped, retry: false }),
    ]);
    const stillRunning = apply(stopped, { type: 'stopFailed', error: new ApiError('network') });
    const rows = threadRows(stillRunning);
    expect(rows.map((row) => row.type)).toEqual(['user', 'working', 'notice']);
    expect(notices(rows)[0]).toMatchObject({ kind: 'stopFailed', text: CHAT_COPY.stopFailed });
  });

  it('says a saved failure by its code, never its saved words; only the newest asks again', () => {
    const failure = (id: string, code: string | null): StoredMessage => ({
      ...saved(id, 'assistant', '⚠️ Your trial credit ran out. Upgrade now.'),
      source: { label: 'Error', origin: 'turn_error', code },
    });
    const state = opened([
      saved('m1', 'user', 'One'),
      failure('m2', 'trial_exhausted'),
      saved('m3', 'user', 'Two'),
      failure('m4', 'mystery_code'),
    ]);
    const found = notices(threadRows(state));
    expect(found.map((notice) => [notice.text, notice.retry])).toEqual([
      [CHAT_COPY.limit, false],
      [TURN_ERROR_COPY.turn_failed.text, true],
    ]);
    expect(allText(threadRows(state))).not.toMatch(/credit|upgrade/i);
  });

  it('gives every notice its word for screen readers', () => {
    const state = apply(streaming(), { type: 'stopped', at: AT });
    expect(notices(threadRows(state))[0].accessibilityLabel).toBe(`Stopped, ${CHAT_COPY.stopped}`);
  });
});
