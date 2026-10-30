// HUD's sheet opens on the newest card waiting with a view; none, and HUD is as today.

import { describe, expect, it } from 'vitest';

import { ApprovalViewSchema } from '../../core/approval-view';
import type { ChatRow } from '../../chat/view-model';
import type { PlanRow, ToolApprovalRow } from '../../chat/cards/view';
import { waitingSheetCard } from '../waiting';
import { VIEW } from './fixtures';

const VIEWED = ApprovalViewSchema.parse(VIEW);

function tool(key: string, extra: Partial<ToolApprovalRow> = {}): ToolApprovalRow {
  return {
    kind: 'tool',
    key,
    grantId: 31,
    action: 'send_email',
    question: null,
    permission: null,
    oversight: null,
    params: [],
    outcome: { state: 'open' },
    line: { mark: '◆', tone: 'muted', text: 'Waiting for you' },
    decided: false,
    view: VIEWED,
    ...extra,
  } as ToolApprovalRow;
}

function plan(key: string, extra: Partial<PlanRow> = {}): PlanRow {
  return {
    kind: 'plan',
    key,
    missionId: 'm-1',
    goal: 'Launch',
    summary: '1 task',
    tasks: [],
    oversight: null,
    outcome: { state: 'open' },
    decided: null,
    view: VIEWED,
    ...extra,
  };
}

const reply = (cards: unknown[]): ChatRow =>
  ({ type: 'cards', key: 'loose-cards', cards }) as unknown as ChatRow;

describe('waitingSheetCard', () => {
  it('is the newest card waiting with a view', () => {
    const rows = [reply([tool('tool-1'), plan('mission-2')])];
    expect(waitingSheetCard(rows)?.key).toBe('mission-2');
  });

  it('skips a decided card, one without a view, and every other kind', () => {
    const rows = [
      reply([
        tool('tool-1', { decided: true }),
        plan('mission-2', { decided: 'Plan rejected.' }),
        tool('tool-3', { view: null }),
        { kind: 'suggestion', key: 'suggestion-0' },
      ]),
    ];
    expect(waitingSheetCard(rows)).toBeNull();
    expect(waitingSheetCard([])).toBeNull();
  });
});
