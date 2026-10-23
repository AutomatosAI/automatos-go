import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { logger } from '../../lib/logger';
import {
  countByProvenance,
  loadCorpus,
  type ContractTurnFile,
  type CorpusEntry,
  type RecordedTurnFile,
  type SseFile,
} from '../parity/corpus';
import {
  liveOutcome,
  persistedReply,
  replaySse,
  replayTurn,
  savedOutcome,
  withLinesAbove,
} from '../parity/replay';

// The corpus (PRD-001 §4.3, K10): every file in src/core/__fixtures__/parity, replayed through the
// app's own parser. 'contract' files hold the catalogue's frames; 'recorded' files are real turns
// from scripts/record-turn.ts and are held to the message the server saved.
const CORPUS_DIR = path.join(__dirname, '..', '__fixtures__', 'parity');
const MIN_CONTRACT_FILES = 6;
const corpus = loadCorpus(CORPUS_DIR);

type Entry<F> = { readonly name: string; readonly file: F };

const isContractTurn = (e: CorpusEntry): e is Entry<ContractTurnFile> =>
  e.file.provenance === 'contract' && e.file.kind === 'chat-turn';
const isRecordedTurn = (e: CorpusEntry): e is Entry<RecordedTurnFile> =>
  e.file.provenance === 'recorded' && e.file.kind === 'chat-turn';
const isSse = (e: CorpusEntry): e is Entry<SseFile> => e.file.kind === 'sse';

/** Every chunk boundary: the body cut after each character. */
const byCharacter = (chunks: readonly string[]) => [...chunks.join('')];

describe('the parity corpus', () => {
  it('loads, every file valid, and logs the count per provenance (zero recorded is allowed)', () => {
    const counts = countByProvenance(corpus);
    logger.info(`[parity] ${counts.contract} contract, ${counts.recorded} recorded`);
    expect(counts.contract).toBeGreaterThanOrEqual(MIN_CONTRACT_FILES);
    expect(counts.recorded).toBeGreaterThanOrEqual(0);
  });

  it('has a contract file for each catalogue case the story names', () => {
    const turns = corpus.filter(isContractTurn).map((entry) => entry.file.expected.frames);
    expect(turns.some((frames) => frames.includes('finish') && frames.includes('receipts'))).toBe(
      true,
    );
    expect(corpus.filter(isSse)).not.toHaveLength(0);
    const codes = corpus
      .filter(isContractTurn)
      .map((entry) => (entry.file.expected.turn.error as { code?: string } | null)?.code);
    expect(codes).toEqual(expect.arrayContaining(['provider_failed', 'session_agent_terminal']));
  });
});

describe.each(corpus.filter(isContractTurn))('contract chat turn $name', ({ file }) => {
  it('replays to the frames, the tail and the turn it states', () => {
    const replay = replayTurn(file.chunks);
    expect(replay.frames.map((frame) => frame.kind)).toEqual(file.expected.frames);
    expect(replay.rest).toBe(file.expected.rest ?? '');
    expect(replay.turn).toMatchObject(file.expected.turn);
  });

  it('reads the same turn whatever the chunk boundaries', () => {
    const replay = replayTurn(file.chunks);
    expect(replayTurn([file.chunks.join('')])).toEqual(replay);
    expect(replayTurn(byCharacter(file.chunks))).toEqual(replay);
  });
});

describe.each(corpus.filter(isSse))('SSE stream $name', ({ file }) => {
  it('replays through the vendored parseSSEFrames to the events it states', () => {
    expect(replaySse(file.chunks)).toEqual({
      events: file.expected.events,
      rest: file.expected.rest ?? '',
    });
  });

  it('reads the same events whatever the chunk boundaries', () => {
    expect(replaySse(byCharacter(file.chunks))).toEqual(replaySse(file.chunks));
  });
});

// The comparison a recording meets, on inline rows (test inputs, not corpus files: K10).
const ABOVE = "I tried to move the card and it didn't go through: the card is locked.";
const REFUSED = {
  action: 'platform_update_task_status',
  kind: 'write',
  status: 'refused',
  subject: '#0422',
  effect: 'moved to Done',
  link: null,
  reason: 'the card is locked',
};
const receiptsFrame = (above?: string[]) =>
  `d:${JSON.stringify({ type: 'receipts', data: { receipts: [REFUSED], ...(above ? { above } : {}) } })}\n`;
const row = (
  id: string,
  role: string,
  parts: Record<string, unknown>[],
  source: unknown = null,
) => ({
  id,
  role,
  parts: parts.map((part) => ({ type: 'text', ...part })),
  attachments: [],
  source,
  createdAt: '2026-10-21T08:00:00Z',
});

describe('recorded chat turns', () => {
  for (const { name, file } of corpus.filter(isRecordedTurn)) {
    it(`${name}: the replayed answer and receipts are the message the server saved`, () => {
      const reply = persistedReply(file.expected.persisted);
      expect(reply).not.toBeNull();
      if (reply === null) return;
      expect(liveOutcome(replayTurn(file.chunks).turn)).toEqual(savedOutcome(reply));
    });
  }

  it('the server saves the lines above the answer first, then the answer (receipts.py)', () => {
    expect(withLinesAbove('Done.', undefined)).toBe('Done.');
    expect(withLinesAbove('Done.', [])).toBe('Done.');
    expect(withLinesAbove('Done.', [ABOVE])).toBe(`${ABOVE}\n\nDone.`);
  });
});

describe('liveOutcome / savedOutcome / persistedReply', () => {
  it('agree on an answer saved with its lines above and its receipts', () => {
    const live = replayTurn(['0:"The card stays in Review."\n', receiptsFrame([ABOVE])]).turn;
    const saved = row('m2', 'assistant', [
      { type: 'receipts', receipts: [REFUSED] },
      { type: 'text', text: `${ABOVE}\n\nThe card stays in Review.` },
    ]);
    const reply = persistedReply([row('m1', 'user', [{ text: 'Move #0422 to Done' }]), saved]);
    expect(reply).not.toBeNull();
    expect(liveOutcome(live)).toEqual(savedOutcome(reply!));
  });

  it('tell a streamed answer the server saved differently apart', () => {
    const live = replayTurn(['0:"Moved."\n', receiptsFrame()]).turn;
    const saved = row('m2', 'assistant', [
      { type: 'receipts', receipts: [REFUSED] },
      { type: 'text', text: 'Not moved.' },
    ]);
    expect(liveOutcome(live)).not.toEqual(savedOutcome(persistedReply([saved])!));
  });

  it('compare a failed turn with the error note the server saved (⚠️ off)', () => {
    const message = 'Auto could not finish this reply: the AI provider took too long to answer.';
    const live = replayTurn([`e:${JSON.stringify({ message, code: 'provider_failed' })}\n`]).turn;
    const note = row('m2', 'assistant', [{ text: `⚠️ ${message}` }], {
      origin: 'turn_error',
      label: 'Error',
      code: 'provider_failed',
    });
    expect(liveOutcome(live)).toEqual({ outcome: 'failed', message });
    expect(savedOutcome(persistedReply([note])!)).toEqual({ outcome: 'failed', message });
  });

  it('take the newest assistant row, and nothing when the server saved no reply', () => {
    const first = row('a1', 'assistant', [{ text: 'first' }]);
    const second = row('a2', 'assistant', [{ text: 'second' }]);
    expect(persistedReply([first, row('u', 'user', [{ text: 'q' }]), second])?.id).toBe('a2');
    expect(persistedReply([row('u', 'user', [{ text: 'q' }])])).toBeNull();
  });
});
