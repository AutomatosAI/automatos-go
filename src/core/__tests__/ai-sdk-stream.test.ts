import { describe, expect, it } from 'vitest';

import { parseLine, pushChunk, UNKNOWN_FRAME } from '../ai-sdk-stream';
import { FALLBACK_TURN_ERROR } from '../web/lib/chat/errors';

// Lines as consumers/chatbot/streaming.py writes them: format_aisdk_data goes through Python's
// json.dumps (", " and ": " separators); chat-id, tool-data, usage and finish are f-strings.
const d = (payload: unknown) => `d:${JSON.stringify(payload)}`;

const RECEIPT = {
  action: 'platform_update_task',
  kind: 'write',
  status: 'done',
  subject: '#0422',
  effect: 'moved to Done',
  link: '/command-center?tab=board&task_id=422',
  reason: null,
};

describe('pushChunk', () => {
  it('splits complete lines and keeps the partial tail', () => {
    expect(pushChunk('', '0:"a"\n0:"b"\n0:"c')).toEqual({
      lines: ['0:"a"', '0:"b"'],
      rest: '0:"c',
    });
  });

  it('joins a line cut by a chunk boundary', () => {
    const first = pushChunk('', '0:"Hel');
    expect(first).toEqual({ lines: [], rest: '0:"Hel' });
    const second = pushChunk(first.rest, 'lo"\n');
    expect(second).toEqual({ lines: ['0:"Hello"'], rest: '' });
    expect(parseLine(second.lines[0] ?? '')).toEqual({ kind: 'text', text: 'Hello' });
  });

  it('joins a JSON string cut inside a d: frame across three chunks', () => {
    const chunks = ['d:{"type": "progress", "da', 'ta": {"text": "Read', 'ing the board"}}\n'];
    let rest = '';
    const lines: string[] = [];
    for (const chunk of chunks) {
      const next = pushChunk(rest, chunk);
      lines.push(...next.lines);
      rest = next.rest;
    }
    expect(rest).toBe('');
    expect(lines.map(parseLine)).toEqual([{ kind: 'progress', text: 'Reading the board' }]);
  });

  it('drops blank lines and never mutates its input', () => {
    const buffer = '0:"x"';
    expect(pushChunk(buffer, '\n\n  \n0:"y"\n')).toEqual({ lines: ['0:"x"', '0:"y"'], rest: '' });
    expect(buffer).toBe('0:"x"');
  });
});

describe('parseLine — 0: and e:', () => {
  it('reads a text delta', () => {
    expect(parseLine('0:"Hi there"')).toEqual({ kind: 'text', text: 'Hi there' });
  });

  it('keeps an escaped newline inside a 0: string as a newline in the text', () => {
    const line = `0:${JSON.stringify('line one\nline two')}`;
    expect(pushChunk('', `${line}\n`).lines).toEqual([line]);
    expect(parseLine(line)).toEqual({ kind: 'text', text: 'line one\nline two' });
  });

  it('treats a 0: line that is not a JSON string as unknown', () => {
    expect(parseLine('0:42')).toEqual(UNKNOWN_FRAME);
    expect(parseLine('0:"unterminated')).toEqual(UNKNOWN_FRAME);
  });

  it('reads an e: line with its code', () => {
    expect(parseLine('e:{"message": "The model is busy.", "code": "rate_limited"}')).toEqual({
      kind: 'error',
      message: 'The model is busy.',
      code: 'rate_limited',
    });
  });

  it('reads an e: line without a code, and a blank one, by the web rule', () => {
    expect(parseLine('e:{"message": "Something broke."}')).toEqual({
      kind: 'error',
      message: 'Something broke.',
      code: null,
    });
    expect(parseLine('e:')).toEqual({ kind: 'error', message: FALLBACK_TURN_ERROR, code: null });
  });
});

describe('parseLine — d: frames', () => {
  it('chat-id', () => {
    expect(parseLine('d:{"type":"chat-id","chatId":"c-1","ai_generated":true}')).toEqual({
      kind: 'chat-id',
      chatId: 'c-1',
      aiGenerated: true,
    });
  });

  it('tool-start', () => {
    const line = d({
      type: 'tool-start',
      data: { toolCallId: 't1', toolName: 'search', input: { q: 'x' } },
    });
    expect(parseLine(line)).toEqual({
      kind: 'tool-start',
      toolCallId: 't1',
      toolName: 'search',
      input: { q: 'x' },
    });
  });

  it('tool-end with every field', () => {
    const data = {
      toolCallId: 't1',
      toolName: 'search',
      success: false,
      error: 'timeout',
      durationMs: 1200,
      summary: '3 results',
      skipped: true,
      waiting: true,
    };
    expect(parseLine(d({ type: 'tool-end', data }))).toEqual({ kind: 'tool-end', ...data });
  });

  it('tool-end with only the required fields', () => {
    expect(parseLine(d({ type: 'tool-end', data: { toolCallId: 't1', success: true } }))).toEqual({
      kind: 'tool-end',
      toolCallId: 't1',
      toolName: 'tool',
      success: true,
      skipped: false,
      waiting: false,
    });
  });

  it('tool-data: the task card, the approvals, the Deliverable and the receipts; other keys dropped', () => {
    const data = {
      task_card: {
        id: 422,
        number: '#0422',
        title: 'Ship',
        status: 'in_progress',
        assigned_agent: 'Scout',
      },
      mission_approval: { mission_id: 'm-1', goal: 'Launch', tasks: [{ title: 'Plan' }] },
      tool_approval: { grant_id: 7, action: 'send_email', message: 'Send it?' },
      generated_document: { deliverable_id: 'doc-9', title: 'Brief', format: 'pdf' },
      receipts: { receipts: [RECEIPT], above: ['A refused write'] },
      documents: [{ id: 1 }],
      emails: [{ to: 'x' }],
    };
    const frame = parseLine(`d:{"type":"tool-data","data":${JSON.stringify(data)}}`);
    expect(frame).toMatchObject({
      kind: 'tool-data',
      taskCard: data.task_card,
      deliverables: [{ id: 'doc-9', title: 'Brief', kind: 'document' }],
      receipts: { receipts: [RECEIPT], above: ['A refused write'] },
    });
    const approvals = frame.kind === 'tool-data' ? frame.approvals.map((card) => card.key) : [];
    expect(approvals).toEqual(['mission-m-1', 'tool-7']);
    expect(Object.keys(frame).sort()).toEqual([
      'approvals',
      'deliverables',
      'kind',
      'receipts',
      'taskCard',
    ]);
  });

  it('tool-data with no key acted on is an empty tool-data frame', () => {
    expect(parseLine(d({ type: 'tool-data', data: { documents: [] } }))).toEqual({
      kind: 'tool-data',
      approvals: [],
      deliverables: [],
    });
  });

  it('tool-data with a malformed task card drops the card, keeps the frame', () => {
    const frame = parseLine(d({ type: 'tool-data', data: { task_card: { id: 'x' } } }));
    expect(frame).toEqual({ kind: 'tool-data', approvals: [], deliverables: [] });
  });

  it('tool-result', () => {
    const line = d({
      type: 'tool-result',
      data: { toolCallId: 't1', toolName: 'search', result: 'ok' },
    });
    expect(parseLine(line)).toEqual({
      kind: 'tool-result',
      toolCallId: 't1',
      toolName: 'search',
      result: 'ok',
    });
  });

  it('reasoning', () => {
    expect(parseLine(d({ type: 'reasoning', data: { delta: 'hmm' } }))).toEqual({
      kind: 'reasoning',
      delta: 'hmm',
    });
  });

  it('narration, plain and retracted', () => {
    expect(parseLine(d({ type: 'narration', data: { text: 'Looking' } }))).toEqual({
      kind: 'narration',
      text: 'Looking',
      retracted: false,
    });
    expect(parseLine(d({ type: 'narration', data: { text: 'Done!', retracted: true } }))).toEqual({
      kind: 'narration',
      text: 'Done!',
      retracted: true,
    });
  });

  it('progress', () => {
    expect(parseLine(d({ type: 'progress', data: { text: 'Step 2' } }))).toEqual({
      kind: 'progress',
      text: 'Step 2',
    });
  });

  it('limit_reached', () => {
    const data = { limit: 'max_tool_rounds', value: 12, message: 'Auto stopped after 12 rounds.' };
    expect(parseLine(d({ type: 'limit_reached', data }))).toEqual({
      kind: 'limit_reached',
      limit: data,
    });
  });

  it('mission-suggestion', () => {
    const data = { goal: 'Plan the launch', complexity: 'complex', agent_id: 3 };
    expect(parseLine(d({ type: 'mission-suggestion', data }))).toEqual({
      kind: 'mission-suggestion',
      suggestion: { goal: 'Plan the launch', complexity: 'complex', agentId: 3 },
    });
  });

  it('withdraw_offer keeps only well-formed requests', () => {
    const requests = [{ grant_id: 5, action: 'send_email', reason: 'asked' }, { grant_id: 'bad' }];
    expect(
      parseLine(d({ type: 'withdraw_offer', data: { message: 'Withdraw?', requests } })),
    ).toEqual({
      kind: 'withdraw_offer',
      offer: { message: 'Withdraw?', requests: [requests[0]] },
    });
  });

  it('attachment_unavailable', () => {
    const attachments = [
      { attachment_id: 'a-1', filename: null, reason: 'resolution error' },
      'junk',
    ];
    expect(parseLine(d({ type: 'attachment_unavailable', data: { attachments } }))).toEqual({
      kind: 'attachment_unavailable',
      attachments: [{ attachmentId: 'a-1', filename: null }],
    });
  });

  it('receipts', () => {
    expect(parseLine(d({ type: 'receipts', data: { receipts: [RECEIPT], model: 'm' } }))).toEqual({
      kind: 'receipts',
      receipts: [RECEIPT],
    });
  });

  it('usage', () => {
    const line =
      'd:{"type":"usage","data":{"promptTokens": 10, "completionTokens": 5, "totalTokens": 15}}';
    expect(parseLine(line)).toEqual({
      kind: 'usage',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
  });

  it('finish', () => {
    expect(parseLine('d:{"type":"finish","finishReason":"stop","ai_generated":true}')).toEqual({
      kind: 'finish',
      finishReason: 'stop',
      aiGenerated: true,
    });
  });

  it('agent-info in the correct shape', () => {
    const agent = { id: 4, name: 'Auto CTO', type: 'system', skills: [], is_cto: true };
    expect(parseLine(d({ type: 'agent-info', agent }))).toEqual({
      kind: 'agent-info',
      agent: { id: 4, name: 'Auto CTO', isCto: true },
    });
  });

  it("agent-info in today's malformed nested shape is ignored safely", () => {
    // service.py:2588 passes the whole dict as event_type (digest chat-api.md).
    const line = d({ type: { type: 'agent-info', agent: { id: 4, name: 'Scout' } } });
    expect(parseLine(line)).toEqual(UNKNOWN_FRAME);
  });

  it.each(['memory-injected', 'memory-stored', 'workflow-update'])('%s is ignored', (type) => {
    expect(parseLine(d({ type, data: { anything: 1 } }))).toEqual({ kind: 'ignored' });
  });
});
