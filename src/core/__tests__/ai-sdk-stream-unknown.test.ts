import { describe, expect, it } from 'vitest';

import { parseLine, UNKNOWN_FRAME, type Frame } from '../ai-sdk-stream';

// Frames this version does not know (split from ai-sdk-stream.test.ts): ignored, never a crash.
// Lines as consumers/chatbot/streaming.py writes them (Python json.dumps separators).
const d = (payload: unknown) => `d:${JSON.stringify(payload)}`;

describe('parseLine — what this version does not know', () => {
  it.each([
    ['an unknown prefix', '2:["x"]'],
    ['a legacy data: SSE line', 'data: {"type":"text-delta","delta":"x"}'],
    ['an unknown type', d({ type: 'brand-new-frame', data: {} })],
    ['a type that names an Object.prototype key', d({ type: 'constructor' })],
    ['__proto__ as the type', 'd:{"type":"__proto__"}'],
    ['malformed JSON', 'd:{"type": "usage", '],
    ['a JSON array', 'd:[1,2]'],
    ['no type', d({ data: { text: 'x' } })],
    ['a known type with a wrong shape', d({ type: 'progress', data: { text: 3 } })],
    ['a chat-id without an id', d({ type: 'chat-id', chatId: '' })],
    ['a tool-start without a call id', d({ type: 'tool-start', data: { toolName: 'x' } })],
    ['a receipts frame without a list', d({ type: 'receipts', data: { model: 'm' } })],
    ['a mission-suggestion without a goal', d({ type: 'mission-suggestion', data: { goal: ' ' } })],
    [
      'a withdraw_offer with no usable request',
      d({ type: 'withdraw_offer', data: { requests: [] } }),
    ],
    ['an empty line', ''],
  ])('%s → unknown', (_label, line) => {
    expect(parseLine(line)).toEqual(UNKNOWN_FRAME);
  });

  it('ignores unknown fields on a known frame', () => {
    const line = d({ type: 'reasoning', data: { delta: 'x', extra: { deep: true } }, also: 1 });
    expect(parseLine(line)).toEqual({ kind: 'reasoning', delta: 'x' });
  });

  it('drops an optional field of the wrong type instead of the frame', () => {
    const line = d({
      type: 'tool-end',
      data: { toolCallId: 't1', success: true, durationMs: 'slow' },
    });
    expect(parseLine(line)).toEqual({
      kind: 'tool-end',
      toolCallId: 't1',
      toolName: 'tool',
      success: true,
      skipped: false,
      waiting: false,
    });
  });

  it('never throws, whatever the line', () => {
    const shapes: unknown[] = [
      null,
      0,
      'x',
      [],
      {},
      { data: null },
      { data: [] },
      { data: 'x' },
      { agent: null },
    ];
    const types = [
      'chat-id',
      'tool-start',
      'tool-end',
      'tool-data',
      'tool-result',
      'reasoning',
      'narration',
      'progress',
      'limit_reached',
      'mission-suggestion',
      'withdraw_offer',
      'attachment_unavailable',
      'receipts',
      'usage',
      'finish',
      'agent-info',
      'toString',
      'hasOwnProperty',
    ];
    const frames: Frame[] = [];
    for (const type of types) {
      for (const shape of shapes) {
        const payload =
          shape !== null && typeof shape === 'object' && !Array.isArray(shape)
            ? { ...shape, type }
            : shape;
        frames.push(parseLine(d(payload)));
        frames.push(parseLine(d({ type, data: shape })));
      }
    }
    for (const line of [
      'd:',
      'e:',
      '0:',
      'd:null',
      'e:null',
      'e:[1]',
      'd:"str"',
      '\u0000',
      'd:{"type":1}',
    ]) {
      frames.push(parseLine(line));
    }
    expect(frames.every((frame) => typeof frame.kind === 'string')).toBe(true);
  });
});
