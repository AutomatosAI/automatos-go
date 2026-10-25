// Frames → Auto's events (behaviour reference: the web's lib/mascot/data-events.ts and
// lib/mascot/events.ts @ 630fc1c85). Frames are built by the foundation's parser from lines as
// consumers/chatbot/streaming.py writes them, so the mapping is held to the real wire shapes.

import { describe, expect, it } from 'vitest';

import { parseLine, type Frame } from '../../../core/ai-sdk-stream';
import { INITIAL_MASCOT, mascotReducer } from '../../../core/web/lib/mascot/reducer';
import type { MascotEvent } from '../../../core/web/lib/mascot/types';
import {
  mascotEventsFromFrame,
  mascotEventsFromReply,
  mascotEventsFromStatus,
  NO_REPLY,
  UNKNOWN_FRAME_TYPE,
} from '../chat-events';

const d = (payload: unknown) => parseLine(`d:${JSON.stringify(payload)}`);

const RECEIPT = {
  action: 'platform_update_task',
  kind: 'write',
  status: 'done',
  subject: '#0422',
  effect: 'moved to Done',
  link: '/command-center?tab=board&task_id=422',
  reason: null,
} as const;

describe('mascotEventsFromFrame', () => {
  it('words and reasoning', () => {
    expect(mascotEventsFromFrame(parseLine('0:"Hello"'))).toEqual([
      { type: 'text', text: 'Hello' },
    ]);
    expect(mascotEventsFromFrame(d({ type: 'reasoning', data: { delta: 'hmm' } }))).toEqual([
      { type: 'reasoning', delta: 'hmm' },
    ]);
  });

  it('words and reasoning while a tool runs are nothing (the tool’s state wins)', () => {
    expect(mascotEventsFromFrame(parseLine('0:"Hello"'), true)).toEqual([]);
    expect(mascotEventsFromFrame(d({ type: 'reasoning', data: { delta: 'hmm' } }), true)).toEqual(
      [],
    );
  });

  it('a tool’s start, with its input as a record', () => {
    const start = d({
      type: 'tool-start',
      data: { toolCallId: 'c1', toolName: 'platform_web_search', input: { q: 'x' } },
    });
    expect(mascotEventsFromFrame(start)).toEqual([
      { type: 'tool-start', toolCallId: 'c1', toolName: 'platform_web_search', input: { q: 'x' } },
    ]);
    const noInput = d({
      type: 'tool-start',
      data: { toolCallId: 'c2', input: ['not', 'a', 'record'] },
    });
    expect(mascotEventsFromFrame(noInput)).toEqual([
      { type: 'tool-start', toolCallId: 'c2', toolName: 'tool', input: {} },
    ]);
  });

  it('a tool’s end: failed, skipped, and an ask that waits for the owner', () => {
    const end = d({
      type: 'tool-end',
      data: {
        toolCallId: 'c1',
        toolName: 'send_email',
        success: false,
        error: 'nope',
        durationMs: 120,
      },
    });
    expect(mascotEventsFromFrame(end)).toEqual([
      {
        type: 'tool-end',
        toolCallId: 'c1',
        toolName: 'send_email',
        success: false,
        error: 'nope',
        durationMs: 120,
        summary: null,
        skipped: false,
        waiting: false,
      },
    ]);
    const ask = d({ type: 'tool-end', data: { toolCallId: 'c2', success: false, waiting: true } });
    expect(mascotEventsFromFrame(ask)).toMatchObject([
      { type: 'tool-end', waiting: true, success: false },
    ]);
    const skipped = d({
      type: 'tool-end',
      data: { toolCallId: 'c3', skipped: true, summary: 'done' },
    });
    expect(mascotEventsFromFrame(skipped)).toMatchObject([
      { skipped: true, summary: 'done', error: null },
    ]);
  });

  it('the turn’s receipts, from their own frame or from tool-data', () => {
    const own = d({ type: 'receipts', data: { receipts: [RECEIPT], above: ['A refused write'] } });
    const expected = [
      { type: 'receipts', receipts: [RECEIPT], model: null, above: ['A refused write'] },
    ];
    expect(mascotEventsFromFrame(own)).toEqual(expected);
    const toolData = d({
      type: 'tool-data',
      data: { receipts: { receipts: [RECEIPT], above: ['A refused write'] } },
    });
    expect(mascotEventsFromFrame(toolData)).toEqual(expected);
    const noAbove = d({ type: 'receipts', data: { receipts: [RECEIPT] } });
    expect(mascotEventsFromFrame(noAbove)).toMatchObject([{ above: [] }]);
  });

  it('tool-data without receipts is nothing', () => {
    expect(mascotEventsFromFrame(d({ type: 'tool-data', data: { documents: [] } }))).toEqual([]);
  });

  it('a cap, the finish and a failure', () => {
    const cap = d({
      type: 'limit_reached',
      data: { limit: 'tool_calls', value: 25, message: 'Too many' },
    });
    expect(mascotEventsFromFrame(cap)).toEqual([
      { type: 'limit_reached', limit: 'tool_calls', value: 25, message: 'Too many' },
    ]);
    expect(mascotEventsFromFrame(d({ type: 'finish', finishReason: 'stop' }))).toEqual([
      { type: 'finish', finishReason: 'stop' },
    ]);
    expect(mascotEventsFromFrame(parseLine('e:{"message":"Boom","code":"x"}'))).toEqual([
      { type: 'error', message: 'Boom', code: 'x' },
    ]);
  });

  it('a frame the parser did not know is the unknown event', () => {
    expect(mascotEventsFromFrame(d({ type: 'brand-new' }))).toEqual([
      { type: 'unknown', eventType: UNKNOWN_FRAME_TYPE },
    ]);
  });

  const quiet: [string, Frame][] = [
    ['chat-id', d({ type: 'chat-id', chatId: 'abc' })],
    ['tool-result', d({ type: 'tool-result', data: { toolCallId: 'c1', result: 'ok' } })],
    ['narration', d({ type: 'narration', data: { text: 'Looking' } })],
    ['progress', d({ type: 'progress', data: { text: 'Reading the board' } })],
    ['usage', d({ type: 'usage', data: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } })],
    ['attachment_unavailable', d({ type: 'attachment_unavailable', data: { attachments: [] } })],
    ['agent-info', d({ type: 'agent-info', agent: { id: 1, name: 'Scout' } })],
    [
      'memory-injected (ignored by the parser)',
      d({ type: 'memory-injected', data: { memories: [] } }),
    ],
    [
      'workflow-update (ignored by the parser)',
      d({ type: 'workflow-update', data: { workflowId: 'w' } }),
    ],
  ];

  it.each(quiet)('%s is nothing, as on the web', (_, frame) => {
    expect(mascotEventsFromFrame(frame)).toEqual([]);
  });
});

describe('a turn through the reducer', () => {
  const run = (events: readonly MascotEvent[]) => events.reduce(mascotReducer, INITIAL_MASCOT);
  const fromFrames = (frames: readonly Frame[]) =>
    frames.flatMap((frame) => mascotEventsFromFrame(frame));

  it('send → thinking → searching → idle on words → celebrate on a done receipt', () => {
    const send: MascotEvent = { type: 'send' };
    const thinking = run([send, ...fromFrames([d({ type: 'reasoning', data: { delta: 'a' } })])]);
    expect(thinking.mascot).toBe('thinking');
    const searching = run([
      send,
      ...fromFrames([
        d({ type: 'tool-start', data: { toolCallId: 'c1', toolName: 'platform_web_search' } }),
      ]),
    ]);
    expect(searching.mascot).toBe('searching');
    const answered = run([
      send,
      ...fromFrames([
        d({ type: 'tool-start', data: { toolCallId: 'c1', toolName: 'platform_web_search' } }),
        d({ type: 'tool-end', data: { toolCallId: 'c1', success: true } }),
        parseLine('0:"Here"'),
        d({ type: 'receipts', data: { receipts: [RECEIPT] } }),
        d({ type: 'finish', finishReason: 'stop' }),
      ]),
    ]);
    expect(answered.mascot).toBe('celebrate');
  });

  it('an ask leaves Auto listening; a failed call is oops', () => {
    const ask = run([
      { type: 'send' },
      ...fromFrames([d({ type: 'tool-end', data: { toolCallId: 'c', waiting: true } })]),
    ]);
    expect(ask.mascot).toBe('listening');
    const failed = run([{ type: 'send' }, ...fromFrames([parseLine('e:"Boom"')])]);
    expect(failed.mascot).toBe('oops');
  });
});

describe('status and reply changes (the vendored rules, re-exported)', () => {
  it('streaming starts the turn, idle ends it, an errorCode blocks it', () => {
    expect(mascotEventsFromStatus('idle', 'streaming', null)).toEqual([{ type: 'send' }]);
    expect(mascotEventsFromStatus('streaming', 'idle', null)).toEqual([
      { type: 'finish', finishReason: null },
    ]);
    expect(mascotEventsFromStatus('streaming', 'idle', 'trial_exhausted')).toMatchObject([
      { type: 'error', code: 'trial_exhausted' },
    ]);
  });

  it('the newest reply’s reasoning and first words', () => {
    const started = { ...NO_REPLY, id: 'r1' };
    const reply = { ...started, reasoningChars: 4, hasText: true };
    expect(mascotEventsFromReply(started, reply, 'streaming').map((e) => e.type)).toEqual([
      'reasoning',
      'text',
    ]);
  });
});
