import { describe, expect, it } from 'vitest';

import { parseLine, pushChunk, type Frame } from '../ai-sdk-stream';
import {
  DEFAULT_TURN_ERROR_CODE,
  initialTurn,
  PROGRESS_LINES_KEPT,
  TURN_ERROR_CODES,
  turnErrorCode,
  turnReducer,
  type TurnState,
} from '../turn-reducer';

const d = (payload: unknown) => `d:${JSON.stringify(payload)}`;
const text = (value: string) => `0:${JSON.stringify(value)}`;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Every state and frame is deep-frozen before the next step: any mutation throws (strict mode). */
function fold(lines: readonly string[], start: TurnState = initialTurn, at?: string): TurnState {
  return lines
    .map(parseLine)
    .reduce(
      (state, frame) => turnReducer(deepFreeze(state), deepFreeze(frame), at),
      deepFreeze(start),
    );
}

const RECEIPT = {
  action: 'platform_update_task',
  kind: 'write',
  status: 'done',
  subject: '#0422',
  effect: 'moved to Done',
  link: '/command-center?tab=board&task_id=422',
  reason: null,
};
const RECEIPTS_DATA = { receipts: [RECEIPT], model: 'claude-sonnet-5-5' };
const TASK_CARD = {
  id: 422,
  number: '#0422',
  title: 'Ship it',
  status: 'in_progress',
  assigned_agent: 'Scout',
};
const WITHDRAW = {
  message: 'Withdraw?',
  requests: [{ grant_id: 5, action: 'send_email', reason: 'asked' }],
};

// digests/chat-api.md line 9: [mission-suggestion] → chat-id → [withdraw_offer] → agent-info
// (malformed) → [attachment_unavailable] → tool and text frames interleaved → tool-data{receipts}
// → receipts → [usage] → finish.
const NORMAL_TURN: readonly string[] = [
  d({
    type: 'mission-suggestion',
    data: { goal: 'Ship the release', complexity: 'complex', agent_id: 2 },
  }),
  'd:{"type":"chat-id","chatId":"chat-1","ai_generated":true}',
  d({ type: 'withdraw_offer', data: WITHDRAW }),
  d({ type: { type: 'agent-info', agent: { id: 2, name: 'Scout' } } }),
  d({
    type: 'attachment_unavailable',
    data: { attachments: [{ attachment_id: 'a-1', filename: 'x.pdf' }] },
  }),
  d({ type: 'reasoning', data: { delta: 'Check ' } }),
  d({ type: 'reasoning', data: { delta: 'the board.' } }),
  text('Let me look at the board. '),
  d({ type: 'narration', data: { text: 'Let me look at the board. ' } }),
  d({
    type: 'tool-start',
    data: { toolCallId: 't1', toolName: 'platform_update_task', input: { id: 422 } },
  }),
  d({ type: 'memory-injected', data: { memories: [], totalMatched: 0 } }),
  d({ type: 'progress', data: { text: 'Moving #0422' } }),
  d({
    type: 'tool-end',
    data: {
      toolCallId: 't1',
      toolName: 'platform_update_task',
      success: true,
      durationMs: 800,
      summary: 'moved',
    },
  }),
  `d:{"type":"tool-data","data":${JSON.stringify({ task_card: TASK_CARD, documents: [] })}}`,
  d({
    type: 'tool-result',
    data: { toolCallId: 't1', toolName: 'platform_update_task', result: '{"ok":true}' },
  }),
  d({ type: 'tool-start', data: { toolCallId: 't2', toolName: 'platform_search' } }),
  text('#0422 is '),
  text('now Done.'),
  `d:{"type":"tool-data","data":${JSON.stringify({ receipts: RECEIPTS_DATA })}}`,
  d({ type: 'receipts', data: RECEIPTS_DATA }),
  'd:{"type":"usage","data":{"promptTokens": 100, "completionTokens": 20, "totalTokens": 120}}',
  'd:{"type":"finish","finishReason":"stop","ai_generated":true}',
];

describe('turnReducer — a normal turn', () => {
  it('folds the digest order to the expected final state', () => {
    const state = fold(NORMAL_TURN);
    expect(state).toEqual({
      ...initialTurn,
      chatId: 'chat-1',
      aiGenerated: true,
      agent: null,
      text: '#0422 is now Done.',
      reasoning: 'Check the board.',
      progress: ['Let me look at the board. ', 'Moving #0422'],
      toolCalls: [
        {
          toolCallId: 't1',
          toolName: 'platform_update_task',
          state: 'completed',
          input: { id: 422 },
          durationMs: 800,
          summary: 'moved',
          skipped: false,
        },
        { toolCallId: 't2', toolName: 'platform_search', state: 'completed' },
      ],
      receipts: [RECEIPT],
      receiptsAbove: undefined,
      taskCards: [TASK_CARD],
      missionSuggestion: { goal: 'Ship the release', complexity: 'complex', agentId: 2 },
      withdrawOffer: WITHDRAW,
      attachmentsUnavailable: [{ attachmentId: 'a-1', filename: 'x.pdf' }],
      usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
      finish: { finishReason: 'stop', aiGenerated: true },
      error: null,
    });
  });

  it('folds the same turn fed as arbitrary chunks', () => {
    const wire = NORMAL_TURN.map((line) => `${line}\n`).join('');
    let rest = '';
    let state = initialTurn;
    for (let at = 0; at < wire.length; at += 7) {
      const next = pushChunk(rest, wire.slice(at, at + 7));
      state = next.lines.map(parseLine).reduce((s, frame) => turnReducer(s, frame), state);
      rest = next.rest;
    }
    expect(rest).toBe('');
    expect(state).toEqual(fold(NORMAL_TURN));
  });

  it('stamps tool calls with the arrival time when given', () => {
    const state = fold(
      [
        d({ type: 'tool-start', data: { toolCallId: 't1', toolName: 'x' } }),
        d({ type: 'finish', finishReason: 'stop' }),
      ],
      initialTurn,
      '2026-10-21T10:00:00.000Z',
    );
    expect(state.toolCalls).toEqual([
      {
        toolCallId: 't1',
        toolName: 'x',
        state: 'completed',
        startedAt: '2026-10-21T10:00:00.000Z',
        endedAt: '2026-10-21T10:00:00.000Z',
      },
    ]);
  });

  it('keeps an agent from an agent-info frame in the correct shape', () => {
    const state = fold([d({ type: 'agent-info', agent: { id: 2, name: 'Scout' } })]);
    expect(state.agent).toEqual({ id: 2, name: 'Scout', isCto: false });
  });

  it('collects approval cards and Deliverables from tool-data, one per key', () => {
    const data = {
      tool_approval: { grant_id: 7, action: 'send_email' },
      mission_approval: { mission_id: 'm-1', goal: 'Launch' },
      generated_document: { deliverable_id: 'doc-1', title: 'Brief' },
    };
    const line = `d:{"type":"tool-data","data":${JSON.stringify(data)}}`;
    const state = fold([line, line]);
    expect(state.approvals.map((card) => card.key)).toEqual(['mission-m-1', 'tool-7']);
    expect(state.deliverables).toEqual([{ id: 'doc-1', title: 'Brief', kind: 'document' }]);
  });

  it('upserts a task card by id, newest data wins', () => {
    const card = (status: string) =>
      `d:{"type":"tool-data","data":${JSON.stringify({ task_card: { ...TASK_CARD, status } })}}`;
    expect(fold([card('in_progress'), card('done')]).taskCards).toEqual([
      { ...TASK_CARD, status: 'done' },
    ]);
  });

  it('keeps the newest progress lines only', () => {
    const lines = Array.from({ length: PROGRESS_LINES_KEPT + 2 }, (_, i) =>
      d({ type: 'progress', data: { text: `p${i}` } }),
    );
    const state = fold(lines);
    expect(state.progress).toHaveLength(PROGRESS_LINES_KEPT);
    expect(state.progress.at(-1)).toBe(`p${PROGRESS_LINES_KEPT + 1}`);
  });

  it('records a limit that ended the turn', () => {
    const limit = { limit: 'max_tool_rounds', value: 12, message: 'Auto stopped after 12 rounds.' };
    expect(fold([d({ type: 'limit_reached', data: limit })]).limitReached).toEqual(limit);
  });
});

describe('turnReducer — narration', () => {
  it('a retracted claim leaves the answer and never joins the trail', () => {
    const state = fold([
      text('I moved it to Done. '),
      d({ type: 'narration', data: { text: 'I moved it to Done. ', retracted: true } }),
      text('It is still in progress.'),
    ]);
    expect(state.text).toBe('It is still in progress.');
    expect(state.progress).toEqual([]);
  });

  it('plain narration leaves the answer and joins the trail', () => {
    const state = fold([
      text('Checking. '),
      d({ type: 'narration', data: { text: 'Checking. ' } }),
      text('Done.'),
    ]);
    expect(state.text).toBe('Done.');
    expect(state.progress).toEqual(['Checking. ']);
  });
});

describe('turnReducer — tool calls', () => {
  it('a waiting tool-end is drawn as waiting, not failed', () => {
    const state = fold([
      d({ type: 'tool-start', data: { toolCallId: 'ask-1', toolName: 'send_email' } }),
      d({
        type: 'tool-end',
        data: { toolCallId: 'ask-1', toolName: 'send_email', success: false, waiting: true },
      }),
      d({ type: 'finish', finishReason: 'stop' }),
    ]);
    expect(state.toolCalls).toEqual([
      {
        toolCallId: 'ask-1',
        toolName: 'send_email',
        state: 'completed',
        skipped: false,
        waiting: true,
      },
    ]);
    expect(state.waitingToolCallId).toBe('ask-1');
  });

  it('a failed tool-end is an error; a skipped one completes', () => {
    const state = fold([
      d({ type: 'tool-end', data: { toolCallId: 'a', success: false, error: 'boom' } }),
      d({ type: 'tool-end', data: { toolCallId: 'b', success: false, skipped: true } }),
    ]);
    expect(state.toolCalls.map((call) => [call.toolCallId, call.state, call.error])).toEqual([
      ['a', 'error', 'boom'],
      ['b', 'completed', undefined],
    ]);
    expect(state.waitingToolCallId).toBeNull();
  });
});

describe('turnReducer — errors', () => {
  it('an e: mid-turn keeps the text so far, closes running calls and carries its code', () => {
    const state = fold([
      'd:{"type":"chat-id","chatId":"chat-1","ai_generated":true}',
      text('Working on '),
      d({ type: 'tool-start', data: { toolCallId: 't1', toolName: 'search' } }),
      'e:{"message": "The model provider is busy. Try again in a minute.", "code": "provider_failed"}',
    ]);
    expect(state.text).toBe('Working on ');
    expect(state.toolCalls.map((call) => call.state)).toEqual(['completed']);
    expect(state.error).toEqual({
      message: 'The model provider is busy. Try again in a minute.',
      code: 'provider_failed',
    });
    expect(state.finish).toBeNull();
  });

  it('a session-agent lane: one e: with session_agent_terminal and no finish', () => {
    const state = fold([
      'e:{"message": "This ticket\'s agent has finished.", "code": "session_agent_terminal"}',
    ]);
    expect(state.error).toEqual({
      message: "This ticket's agent has finished.",
      code: 'session_agent_terminal',
    });
    expect(state.finish).toBeNull();
    expect(state.chatId).toBeNull();
  });

  it('maps every taxonomy code through, and anything else to turn_failed', () => {
    for (const code of TURN_ERROR_CODES) expect(turnErrorCode(code)).toBe(code);
    expect(turnErrorCode(null)).toBe(DEFAULT_TURN_ERROR_CODE);
    expect(turnErrorCode('something_new')).toBe('turn_failed');
    expect(fold(['e:{"message": "x"}']).error).toEqual({ message: 'x', code: 'turn_failed' });
  });
});

describe('turnReducer — immutability', () => {
  it('never mutates a deep-frozen state or frame and returns a new state', () => {
    const frozen = deepFreeze(fold(NORMAL_TURN.slice(0, 12)));
    // the proof works: a write to a deep-frozen state throws in this (strict) module
    expect(() => {
      (frozen.toolCalls as unknown[]).push({});
    }).toThrow(TypeError);
    const snapshot = JSON.stringify(frozen);
    const frames: Frame[] = NORMAL_TURN.slice(12).map((line) => deepFreeze(parseLine(line)));
    const next = frames.reduce((state, frame) => turnReducer(state, frame), frozen);
    expect(JSON.stringify(frozen)).toBe(snapshot);
    expect(next).not.toBe(frozen);
    expect(next.toolCalls).not.toBe(frozen.toolCalls);
  });

  it('returns the same state for frames it does not use', () => {
    const state = deepFreeze(fold([text('x')]));
    for (const line of [
      '2:x',
      d({ type: 'memory-stored', data: {} }),
      d({ type: 'tool-result', data: { toolCallId: 't', result: '' } }),
    ]) {
      expect(turnReducer(state, parseLine(line))).toBe(state);
    }
  });
});
