// Start on the brief's suggestion rows (§6.12.3 'Brief card': a row pressed → '✓ {done_label}' in
// place): a row that opens a suggestion with the verb start offers Start through src/suggestions'
// Start, named to VoiceOver with the row; every other row is as before; a Start that went through
// marks its rows.

import { describe, expect, it } from 'vitest';

import { briefStartOf, briefView, doneWordsOf, startedRowKeys } from '../model';
import { BriefRowSchema } from '../schema';
import { BRIEF_COPY } from '../strings';
import { brief, row } from './fixtures';

const SUGGESTION_ID = '5b0c3f7e-8a51-4c1f-9d2e-0f6a7b8c9d10';
const parsed = (extra: Record<string, unknown>) => BriefRowSchema.parse(row('x', extra));

describe('briefStartOf', () => {
  it("a suggestion row's Start: the suggestion's id, the row's words, the server's label", () => {
    const start = briefStartOf(
      parsed({
        title: 'Lisbon flights',
        why: 'Fares drop on Tuesdays',
        opens: { type: 'suggestion', id: ` ${SUGGESTION_ID} ` },
        action: { verb: 'start', label: 'Começar', done_label: 'Começou' },
      }),
    );
    expect(start).toMatchObject({
      id: SUGGESTION_ID,
      title: 'Lisbon flights',
      detail: 'Fares drop on Tuesdays',
      does: null,
      startLabel: 'Começar: Lisbon flights',
    });
  });

  it('is none for any other row: another verb, another place, or no id', () => {
    const suggestion = { type: 'suggestion', id: SUGGESTION_ID };
    expect(briefStartOf(parsed({ opens: suggestion }))).toBeNull();
    expect(
      briefStartOf(parsed({ opens: suggestion, action: { verb: 'open', label: 'Open' } })),
    ).toBeNull();
    expect(
      briefStartOf(
        parsed({ opens: { type: 'ticket', id: '849' }, action: { verb: 'start', label: 'Start' } }),
      ),
    ).toBeNull();
    expect(
      briefStartOf(
        parsed({
          opens: { type: 'suggestion', id: '..' },
          action: { verb: 'start', label: 'Start' },
        }),
      ),
    ).toBeNull();
  });
});

describe('the card’s rows', () => {
  it("offer Start on the suggestions section's row, and nothing new anywhere else", () => {
    const view = briefView(brief(), { needsYou: 2 });
    const starts = view.sections.map((section) =>
      section.shown.map((each) => each.start?.id ?? null),
    );
    expect(starts).toEqual([[null, null], [SUGGESTION_ID], [null], [null], [null]]);
    const [lisbon] = view.sections[1].shown;
    expect(lisbon.start?.startLabel).toBe('Start: Lisbon flights');
    // a Start is not a link: the row still has nowhere to go
    expect(lisbon.target).toBeNull();
  });

  it('a Start that went through marks every row of that suggestion, and only those', () => {
    const view = briefView(brief(), { needsYou: 2 });
    const rows = view.sections.flatMap((section) => section.shown);
    expect(startedRowKeys(rows, SUGGESTION_ID)).toEqual([`suggestions:0:s1`]);
    expect(startedRowKeys(rows, 'another')).toEqual([]);
  });
});

describe('a pressed row says its done words in place', () => {
  it("'Started' from the brief once its Start went through; 'Started' when the brief named none", () => {
    const view = briefView(brief(), { needsYou: 2 });
    const [lisbon] = view.sections[1].shown;
    expect(doneWordsOf(lisbon, false)).toBeNull();
    expect(doneWordsOf(lisbon, true)).toBe('Started');
    const bare = { row: parsed({ action: { verb: 'start', label: 'Go' } }), start: lisbon.start };
    expect(doneWordsOf(bare, true)).toBe(BRIEF_COPY.started);
  });

  it('a link row without done words keeps its action once pressed, as before', () => {
    const view = briefView(brief(), { needsYou: 2 });
    const [answer, review] = view.sections[0].shown;
    expect(doneWordsOf(answer, true)).toBeNull();
    expect(doneWordsOf(review, true)).toBe('Opened');
  });
});
