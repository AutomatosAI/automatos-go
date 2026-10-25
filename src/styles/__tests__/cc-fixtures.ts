// What cc-dress.test.ts reads from A3's modules: a Board row as the Board parses it, every status
// a card can carry, every stream state, the day strip's eight cells and the shell's dress.

import type { LiveStatus } from '../../api/live-events';
import { BOARD_STATUSES } from '../../cc/board/board';
import { BoardSchema, type BoardTicket } from '../../cc/board/schemas';
import { STATUS_CONFIG } from '../../core/web/types/board';
import { shellDress } from '../dress/cc-dress';
import { dressOf } from '../dress/dress';
import type { ResolvedStyle } from '../provider/resolve';

let nextId = 500;

/** A row as api/board_tasks.py serves it (src/cc/__tests__/board-view.test.ts's fixture). */
export function ticket(overrides: Record<string, unknown> = {}): BoardTicket {
  nextId += 1;
  const row = {
    id: nextId,
    number: `#0${nextId}`,
    workspace_seq: nextId,
    source_type: 'user',
    title: 'Reconcile October invoices',
    status: 'inbox',
    priority: 'medium',
    tags: [],
    review_reason: null,
    blocked_code: null,
    parent_task_id: null,
    agent: { id: 7, name: 'Ledger' },
    ...overrides,
  };
  return BoardSchema.parse({ tasks: [row] }).tasks[0];
}

/** Every column, every status the web names (closed too) and the web's two old aliases. */
export const BOARD_SERVER_STATUSES: readonly string[] = [
  ...new Set([...BOARD_STATUSES, ...Object.keys(STATUS_CONFIG), 'running', 'completed']),
];

/** Every stream state; a state added to LiveStatus fails the typecheck here. */
const LIVE_STATES: Readonly<Record<LiveStatus, true>> = {
  live: true,
  connecting: true,
  offline: true,
};
export const LIVE_STATUSES = Object.keys(LIVE_STATES) as LiveStatus[];

/** The day strip's eight cells: chosen or not, today or not, with items or not. */
export const STRIP_CELLS = [true, false].flatMap((selected) =>
  [true, false].flatMap((today) =>
    [true, false].map((hasItems) => ({ selected, today, hasItems })),
  ),
);

export const CHOSEN_DAY = { selected: true, today: false, hasItems: true } as const;
export const TODAY_WITH_ITEMS = { selected: false, today: true, hasItems: true } as const;
export const BARE_DAY = { selected: false, today: false, hasItems: false } as const;

export const shell = (style: ResolvedStyle) => shellDress(style, dressOf(style));
