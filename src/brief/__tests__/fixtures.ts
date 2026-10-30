// A Brief@1 as core W2 posts it (US-C19c), and a saved message carrying it beside its text.

import { StoredMessageSchema, type StoredMessage } from '../../chat/schemas';
import { BriefSchema, type Brief } from '../schema';

export const DATE = '2026-10-28';
export const PROSE = 'Two things need you before lunch.';

export function row(id: string, extra: Record<string, unknown> = {}) {
  return { id, title: `Row ${id}`, why: `Because ${id}`, ...extra };
}

export const WIRE_BRIEF = Object.freeze({
  v: 1,
  date: DATE,
  greeting: 'Morning, Sam.',
  prose: PROSE,
  spoken: 'Morning, Sam. One: the launch email.',
  sections: {
    needs_you: [
      row('n1', {
        title: 'Send the launch email',
        number: '#0846',
        opens: { type: 'question', id: '31' },
        action: { verb: 'answer', label: 'Answer' },
      }),
      row('n2', {
        title: 'Review the pricing table',
        opens: { type: 'ticket', id: '849' },
        action: { verb: 'open', label: 'Open', done_label: 'Opened' },
      }),
    ],
    suggestions: [
      row('s1', {
        title: 'Lisbon flights',
        opens: { type: 'suggestion', id: '5b0c3f7e-8a51-4c1f-9d2e-0f6a7b8c9d10' },
        action: { verb: 'start', label: 'Start', done_label: 'Started' },
      }),
    ],
    today: [row('t1', { at: '11:00', title: 'Weekly SEO report' })],
    since: [row('c1', { title: 'Competitor pricing table', display_state: 'ready' })],
    unchecked: [row('u1', { title: 'Web search', why: "Didn't answer in time" })],
  },
  counts: { needs_you: 2, suggestions: 1, today: 1, since: 1 },
  state_hash: 'h-1',
  generated_at: '2026-10-28T07:58:00Z',
});

export function brief(overrides: Record<string, unknown> = {}): Brief {
  return BriefSchema.parse({ ...WIRE_BRIEF, ...overrides });
}

export function sections(overrides: Record<string, unknown>) {
  return { ...WIRE_BRIEF.sections, ...overrides };
}

/** The brief message as GET /api/chat/{id}/messages answers it: [text(prose), brief@1]. */
export function briefMessage(id = 'm-brief', wire: unknown = WIRE_BRIEF): StoredMessage {
  return StoredMessageSchema.parse({
    id,
    role: 'assistant',
    parts: [
      { type: 'text', text: PROSE },
      { type: 'brief@1', brief: wire },
    ],
    attachments: [],
    source: { label: 'Auto', origin: 'daily_digest', local_date: DATE, via: 'open' },
    createdAt: '2026-10-28T07:58:00.000Z',
  });
}
