// When a thread row draws again (row-same.ts, pure), and MessageList's memo on it (read from source:
// vitest runs no React renderer). threadRows builds every row anew on each streamed delta; a saved
// message's row stays equal in value, so only the reply being written draws again.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { sameThreadRow, sameValue, type ThreadRowInputs } from '../components/row-same';
import { rowPlace } from '../components/thread-look';
import { threadRows, type ChatRow } from '../view-model';
import { saved } from './thread-fixtures';
import { apply, frames, opened } from './view-model-fixtures';

const handlers = { onLink: () => undefined, onRetry: () => undefined, onCard: () => undefined };
const report = { allowed: true, open: () => undefined };

function inputs(row: ChatRow, extra: Partial<ThreadRowInputs> = {}): ThreadRowInputs {
  return { row, place: rowPlace(undefined, row), ...handlers, report, ...extra };
}

describe('sameValue', () => {
  it('compares primitives, arrays and object literals by value', () => {
    expect(sameValue('a', 'a')).toBe(true);
    expect(sameValue(Number.NaN, Number.NaN)).toBe(true);
    expect(sameValue({ a: [1, { b: 'x' }], c: null }, { a: [1, { b: 'x' }], c: null })).toBe(true);
    expect(sameValue({ a: [1, { b: 'x' }] }, { a: [1, { b: 'y' }] })).toBe(false);
    expect(sameValue([1, 2], [1, 2, 3])).toBe(false);
    expect(sameValue({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(sameValue({ a: undefined }, { b: undefined })).toBe(false);
    expect(sameValue([], {})).toBe(false);
    expect(sameValue(null, {})).toBe(false);
  });

  it('compares anything else only by identity', () => {
    const at = new Date(0);
    expect(sameValue(at, at)).toBe(true);
    expect(sameValue(new Date(0), new Date(1))).toBe(false);
    expect(
      sameValue(
        () => 1,
        () => 1,
      ),
    ).toBe(false);
  });
});

describe('a streamed delta', () => {
  const history = opened([
    saved('m1', 'user', 'Status?'),
    saved('m2', 'assistant', 'Three tickets.'),
  ]);
  const sent = apply(history, { type: 'send', draft: { text: 'And now?', files: [], sentAt: '' } });
  const before = threadRows(apply(sent, ...frames({ kind: 'text', text: 'On it' })));
  const after = threadRows(apply(sent, ...frames({ kind: 'text', text: 'On it. Two' })));

  it('builds every row anew', () => {
    expect(before[0]).not.toBe(after[0]);
  });

  it('leaves the saved rows equal, so they do not draw again', () => {
    for (const index of [0, 1, 2]) {
      expect(before[index].key).toBe(after[index].key);
      expect(sameThreadRow(inputs(before[index]), inputs(after[index]))).toBe(true);
    }
  });

  it('redraws the reply being written', () => {
    const reply = before.findIndex((row) => row.type === 'auto' && row.messageId === null);
    expect(reply).toBeGreaterThan(-1);
    expect(sameThreadRow(inputs(before[reply]), inputs(after[reply]))).toBe(false);
  });
});

describe('sameThreadRow', () => {
  const row = threadRows(opened([saved('m2', 'assistant', 'Three tickets.')]))[0];

  it('redraws when a handler or Report this changes, or the row moves', () => {
    const base = inputs(row);
    expect(sameThreadRow(base, { ...base, onLink: () => undefined })).toBe(false);
    expect(sameThreadRow(base, { ...base, onRetry: undefined })).toBe(false);
    expect(sameThreadRow(base, { ...base, onCard: () => undefined })).toBe(false);
    expect(sameThreadRow(base, { ...base, report: { ...report } })).toBe(false);
    expect(sameThreadRow(base, { ...base, place: { ...base.place, gapAbove: 'space9' } })).toBe(
      false,
    );
    expect(sameThreadRow(base, { ...base, place: { ...base.place } })).toBe(true);
  });
});

describe('MessageList', () => {
  const list = readFileSync(path.resolve(__dirname, '..', 'components', 'MessageList.tsx'), 'utf8');

  it('memoises each row on sameThreadRow', () => {
    expect(list).toMatch(/const ThreadRow = memo\(ThreadRowView, sameThreadRow\);/);
    expect(list).toMatch(/<ThreadRow\s+row=\{item\}/);
  });

  it('hands every row one stable Try again that calls the screen’s latest', () => {
    expect(list).toMatch(/const retry = useStableRetry\(onRetry\);/);
    expect(list).toMatch(/onRetry=\{retry\}/);
    expect(list).toMatch(/const retry = useCallback\(\(\) => latest\.current\?\.\(\), \[\]\);/);
    expect(list).toMatch(/return onRetry \? retry : undefined;/);
  });
});
