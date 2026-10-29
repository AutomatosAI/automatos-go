import { describe, expect, it } from 'vitest';

import { parseLine } from '../../core/ai-sdk-stream';
import { ApprovalViewSchema, approvalViewOf } from '../../core/approval-view';
import { initialTurn, turnReducer } from '../../core/turn-reducer';
import { raisedCards } from '../../chat/cards/model';
import { VIEW } from './fixtures';

describe('ApprovalView@1', () => {
  it('reads every field, ignoring unknown ones, with the grant id as a string', () => {
    const view = ApprovalViewSchema.parse({ ...VIEW, grant_id: 31, extra: true });
    expect(view.grant_id).toBe('31');
    expect(view).not.toHaveProperty('extra');
    expect(view.rule.sentence).toBe('Ask before anything that sends to other people');
    expect(view.target).toEqual({ label: 'Press list · 214 people', detail: 'Gmail' });
  });

  it('keeps only the answers this version knows', () => {
    const view = ApprovalViewSchema.parse({
      ...VIEW,
      answers: ['refuse', 'snooze', 'always_allow'],
    });
    expect(view.answers).toEqual(['refuse', 'always_allow']);
  });

  it('drops the view, never the card, when an id, the rule or the action is not what it says', () => {
    for (const broken of [
      { ...VIEW, grant_id: ' ' },
      { ...VIEW, rule: { id: 'x' } },
      { ...VIEW, action: { verb: 'send' } },
    ]) {
      expect(approvalViewOf({ approval_view: broken })).toBeUndefined();
    }
    expect(approvalViewOf({ grant_id: 31 })).toBeUndefined();
    expect(approvalViewOf(null)).toBeUndefined();
  });

  it('reads an optional target or preview of the wrong shape as absent', () => {
    const view = ApprovalViewSchema.parse({ ...VIEW, target: 'Gmail', preview: { body: '' } });
    expect(view.target).toBeUndefined();
    expect(view.preview).toBeUndefined();
  });
});

describe('the view rides on the live card', () => {
  const frame = (data: Record<string, unknown>) =>
    parseLine(`d:${JSON.stringify({ type: 'tool-data', data })}`);

  it('a tool approval and a Mission plan each keep their own payload’s view', () => {
    const parsed = frame({
      tool_approval: { grant_id: 31, action: 'send_email', approval_view: VIEW },
      mission_approval: {
        mission_id: 'm-1',
        goal: 'Launch',
        tasks: [],
        approval_view: { ...VIEW, action: { verb: 'run', summary: 'Run the launch plan' } },
      },
    });
    const approvals = parsed.kind === 'tool-data' ? parsed.approvals : [];
    expect(approvals.map((card) => [card.key, card.view?.action.summary])).toEqual([
      ['mission-m-1', 'Run the launch plan'],
      ['tool-31', 'Send an email'],
    ]);
  });

  it('a card from a server without views is exactly today’s', () => {
    const parsed = frame({ tool_approval: { grant_id: 7, action: 'send_email' } });
    const approvals = parsed.kind === 'tool-data' ? parsed.approvals : [];
    expect(approvals).toHaveLength(1);
    expect(approvals[0]).not.toHaveProperty('view');
  });

  it('the turn files it, and the thread’s card carries it', () => {
    const parsed = frame({
      tool_approval: { grant_id: 31, action: 'send_email', approval_view: VIEW },
    });
    const turn = turnReducer(initialTurn, parsed);
    const [card] = raisedCards(turn);
    expect(card).toMatchObject({ kind: 'tool', view: { grant_id: '31' } });
  });
});
