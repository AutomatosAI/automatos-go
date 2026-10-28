// PRD-268 US-C17's row fields (display_state, next_step, retry) as the app parses them: optional,
// so a server without them parses as before; a value this version does not know is null, never a
// row left out; and needs-you's rows carry them (US-G05).

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { NeedsYouSchema } from '../needs-you';
import { DISPLAY_STATES, NEXT_STEP_MAX_CHARS, RETRY_KINDS, ROW_STATUS_FIELDS } from '../row-status';

const Row = z.object({ id: z.number(), ...ROW_STATUS_FIELDS });
const parse = (fields: Record<string, unknown>) => Row.parse({ id: 1, ...fields });

describe('the row status fields', () => {
  it('are absent on a server without them, and the row parses as before', () => {
    const row = parse({});
    expect(row).toEqual({ id: 1 });
    for (const field of Object.keys(ROW_STATUS_FIELDS)) expect(row).not.toHaveProperty(field);
  });

  it('keep every state, every retry kind and a next step as sent', () => {
    for (const state of DISPLAY_STATES)
      expect(parse({ display_state: state }).display_state).toBe(state);
    for (const kind of RETRY_KINDS) expect(parse({ retry: { kind } }).retry).toEqual({ kind });
    expect(parse({ next_step: '  Allow me to send it, or refuse.  ' }).next_step).toBe(
      'Allow me to send it, or refuse.',
    );
  });

  it('keep null as null', () => {
    expect(parse({ display_state: null, next_step: null, retry: null })).toEqual({
      id: 1,
      display_state: null,
      next_step: null,
      retry: null,
    });
  });

  it('read a value this version does not know as null, never the row as unreadable', () => {
    const row = parse({
      display_state: 'snoozed',
      next_step: 'x'.repeat(NEXT_STEP_MAX_CHARS + 1),
      retry: { kind: 'reboot' },
    });
    expect(row).toEqual({ id: 1, display_state: null, next_step: null, retry: null });
    expect(parse({ display_state: 7, next_step: '   ', retry: 'again' })).toEqual({
      id: 1,
      display_state: null,
      next_step: null,
      retry: null,
    });
  });

  it('keep a next step of exactly 90 characters', () => {
    const words = 'y'.repeat(NEXT_STEP_MAX_CHARS);
    expect(parse({ next_step: words }).next_step).toBe(words);
  });

  it('ignore anything else a retry carries', () => {
    expect(parse({ retry: { kind: 'retry_ticket', note: 'x' } }).retry).toEqual({
      kind: 'retry_ticket',
    });
  });
});

describe('needs-you rows carry them', () => {
  it('on ticket rows and on question and approval rows', () => {
    const parsed = NeedsYouSchema.parse({
      total: 2,
      rows: {
        failed: [
          {
            ticket_id: 9,
            display_state: 'failed',
            next_step: 'The search tool timed out.',
            retry: { kind: 'retry_ticket' },
          },
        ],
        question: [
          { source: 'grant', id: '17', display_state: 'needs_you', next_step: 'Pick a tone.' },
        ],
      },
    });
    expect(parsed.rows.failed[0]).toMatchObject({
      display_state: 'failed',
      next_step: 'The search tool timed out.',
      retry: { kind: 'retry_ticket' },
    });
    expect(parsed.rows.question[0]).toMatchObject({
      display_state: 'needs_you',
      next_step: 'Pick a tone.',
    });
    expect(parsed.rows.question[0]).not.toHaveProperty('retry');
  });
});
