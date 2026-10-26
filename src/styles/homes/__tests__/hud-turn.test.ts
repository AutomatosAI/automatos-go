import { describe, expect, it } from 'vitest';

import { AT, CHAT_ID, saved } from '../../../chat/__tests__/thread-fixtures';
import { opened } from '../../../chat/__tests__/view-model-fixtures';
import { createThread, threadReducer, type ThreadAction } from '../../../chat/controller/thread';
import type { StoredMessage } from '../../../chat/schemas';
import { CHAT_COPY, TURN_ERROR_COPY } from '../../../chat/strings';
import { EMPTY_TURN, transcriptHint, transcriptRows } from '../../hud/core/model';
import { hudTurn, plainText } from '../hud-turn';
import { SEND, frame } from './fixtures';

const LATER = '2026-10-21T08:30:12.000Z';

function failure(id: string, code: string): StoredMessage {
  return {
    ...saved(id, 'assistant', '⚠️ Something about your plan'),
    source: { label: null, origin: 'turn_error', code },
  };
}

const apply = (...actions: ThreadAction[]) => actions.reduce(threadReducer, opened());

describe('Auto’s markdown as the transcript’s plain words', () => {
  it('keeps the words and drops the marks, one block a line', () => {
    const markdown = [
      '## Three picks',
      'The **ASUS Vivobook** is _my_ pick.',
      '- 16 GB of memory',
      '- 10+ hours',
      '| Laptop | Price |',
      '| --- | --- |',
      '| Vivobook | £679 |',
      '```',
      'npm run go',
      '```',
    ].join('\n');
    expect(plainText(markdown)).toBe(
      [
        'Three picks',
        'The ASUS Vivobook is my pick.',
        '16 GB of memory',
        '10+ hours',
        'Laptop · Price',
        'Vivobook · £679',
        'npm run go',
      ].join('\n'),
    );
  });

  it('is empty for nothing', () => {
    expect(plainText('')).toBe('');
    expect(plainText('---')).toBe('');
  });
});

describe('the newest turn over A2’s thread', () => {
  it('a blank draft is First open’s empty turn', () => {
    const turn = hudTurn(createThread(null));
    expect(turn).toBe(EMPTY_TURN);
    expect(transcriptHint(turn)).not.toBeNull();
    expect(hudTurn(createThread(CHAT_ID))).toBe(EMPTY_TURN);
  });

  it('a saved exchange: the user’s last message and the reply after it, timed', () => {
    const reply = { ...saved('m4', 'assistant', 'Aim for **16 GB**.'), createdAt: LATER };
    const turn = hudTurn(
      opened([
        saved('m1', 'user', 'Hello'),
        saved('m2', 'assistant', 'Hi.'),
        saved('m3', 'user', 'What laptop?'),
        reply,
      ]),
    );
    expect(turn).toMatchObject({ you: 'What laptop?', auto: 'Aim for 16 GB.', streaming: false });
    expect((turn.endedAt ?? 0) - (turn.startedAt ?? 0)).toBe(12_000);
  });

  it('while Auto writes: the words so far, a half-written list marker held back', () => {
    const turn = hudTurn(apply(SEND, frame({ kind: 'text', text: 'Three picks:\n-' })));
    expect(turn).toMatchObject({ you: 'Find me a laptop', auto: 'Three picks:', streaming: true });
    expect(turn.startedAt).toBe(Date.parse(AT));
    expect(turn.endedAt).toBeNull();
    const rows = transcriptRows(turn);
    expect(rows.map((row) => row.who)).toEqual(['you', 'auto']);
  });

  it('before the first word: the cursor alone, and the agent who answers', () => {
    const agent = { kind: 'agent-info', agent: { id: 7, name: 'Scout', isCto: false } } as const;
    const turn = hudTurn(apply(SEND, frame(agent)));
    expect(turn).toMatchObject({ auto: null, streaming: true, agent: { name: 'Scout' } });
  });

  it('a chat reopened mid-turn answers the user’s last saved message', () => {
    const state = threadReducer(createThread(CHAT_ID), {
      type: 'loaded',
      chatId: CHAT_ID,
      messages: [saved('m1', 'user', 'Still there?')],
      turnInFlight: true,
    });
    expect(hudTurn(state)).toMatchObject({ you: 'Still there?', auto: null, streaming: true });
  });

  it('a failure says A2’s words, never the server’s', () => {
    const savedFailure = hudTurn(opened([saved('m1', 'user', 'Go'), failure('m2', 'turn_failed')]));
    expect(savedFailure.auto).toBe(TURN_ERROR_COPY.turn_failed.text);
    expect(savedFailure.auto).not.toMatch(/plan/);
    const stopped = hudTurn(apply(SEND, { type: 'stopped', at: AT }));
    expect(stopped).toMatchObject({ auto: CHAT_COPY.stopped, streaming: false });
  });

  it('a saved turn_stopped note says the live Stop’s words, never a failure', () => {
    const savedStop = hudTurn(opened([saved('m1', 'user', 'Go'), failure('m2', 'turn_stopped')]));
    expect(savedStop.auto).toBe(CHAT_COPY.stopped);
    expect(savedStop.auto).not.toBe(TURN_ERROR_COPY.turn_failed.text);
  });
});
