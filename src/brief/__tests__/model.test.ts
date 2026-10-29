import { describe, expect, it } from 'vitest';

import { NO_NEEDS_YOU } from '../../api/needs-you';
import { needsStrip } from '../../chat/home/needs-strip';
import {
  BRIEF_FOLD_AT,
  briefDateLabel,
  briefNeedsCount,
  briefOf,
  briefOnScreen,
  briefTarget,
  briefView,
  foldRows,
  sectionHeading,
} from '../model';
import { BRIEF_COPY } from '../strings';
import { brief, briefMessage, row, sections } from './fixtures';

const WEB = 'https://ui.example.test';
const rows = (count: number) => Array.from({ length: count }, (_, index) => row(`r${index + 1}`));

describe('briefOf', () => {
  it('reads the brief beside the text part, and null for any other message', () => {
    expect(briefOf(briefMessage())?.greeting).toBe('Morning, Sam.');
    expect(briefOf({ structured: undefined })).toBeNull();
  });
});

describe('the needs-you count: the strip’s and the badge’s, never a recount', () => {
  it('says the strip’s total once it has loaded, whatever the brief counted at 07:58', () => {
    const made = brief({ counts: { needs_you: 2, suggestions: 1, today: 1, since: 1 } });
    const answer = { ...NO_NEEDS_YOU, total: 3 };
    const strip = needsStrip(answer);
    const view = briefView(made, { needsYou: answer.total, webUrl: WEB });
    expect(view.needsYou).toBe(strip?.count);
    expect(view.sections[0]).toMatchObject({ name: 'needs_you', count: 3 });
    expect(sectionHeading(view.sections[0])).toBe('Needs you · 3');
  });

  it('says the brief’s own count until the strip has answered', () => {
    expect(briefNeedsCount(brief(), null)).toBe(2);
    expect(briefNeedsCount(brief(), 0)).toBe(0);
    expect(briefNeedsCount(brief(), Number.NaN)).toBe(2);
  });
});

describe('briefView', () => {
  it('draws the sections in order, each with its label and exact count', () => {
    const view = briefView(brief(), { needsYou: 2, webUrl: WEB });
    expect(view.sections.map((section) => [section.name, section.label, section.count])).toEqual([
      ['needs_you', 'Needs you', 2],
      ['suggestions', 'Ideas', 1],
      ['today', 'Today', 1],
      ['since', 'Since your last brief', 1],
      ['unchecked', "Couldn't check", null],
    ]);
    expect(view.dateLabel).toBe('Wednesday, 28 October');
    expect(view.prose).toBe('Two things need you before lunch.');
    expect(view.empty).toBeNull();
  });

  it('folds at 5 and never at 6: 5 and 6 show whole, 7 shows 5 and two more', () => {
    for (const [count, shown, folded] of [
      [5, 5, 0],
      [6, 6, 0],
      [7, 5, 2],
    ] as const) {
      const view = briefView(brief({ sections: sections({ today: rows(count) }) }), {
        needsYou: 2,
      });
      const today = view.sections.find((section) => section.name === 'today');
      expect([today?.shown.length, today?.folded.length]).toEqual([shown, folded]);
    }
    expect(BRIEF_FOLD_AT).toBe(5);
    expect(foldRows([1, 2, 3, 4, 5, 6, 7, 8]).folded).toEqual([6, 7, 8]);
    expect(BRIEF_COPY.showMore(2)).toBe('Show 2 more');
  });

  it('leaves out an empty section, and an empty brief says so in words', () => {
    const none = sections({ needs_you: [], suggestions: [], today: [], since: [], unchecked: [] });
    const view = briefView(brief({ sections: none }), { needsYou: 0 });
    expect(view.sections).toEqual([]);
    expect(view.empty).toBe('Nothing new needs you, and nothing is scheduled today.');
  });

  it('numbers what asks for something, needs you first, so "start three" names a row', () => {
    const view = briefView(brief(), { needsYou: 2, webUrl: WEB });
    const numbers = view.sections.map((section) => section.shown.map((each) => each.number));
    expect(numbers).toEqual([['01', '02'], ['03'], [null], [null], [null]]);
  });

  it('names the row in the action VoiceOver hears, and draws none where the row goes nowhere', () => {
    const view = briefView(brief(), { needsYou: 2, webUrl: WEB });
    const [answer] = view.sections[0].shown;
    expect(answer.actionLabel).toBe('Answer');
    expect(answer.actionAccessibilityLabel).toBe('Answer: Send the launch email');
    const [start] = view.sections[1].shown;
    // a suggestion's Start is US-G01's: no link to draw here
    expect(start.target).toBeNull();
    expect(start.actionLabel).toBeNull();
    const [today] = view.sections[2].shown;
    expect(today.actionLabel).toBeNull();
  });
});

describe('briefTarget: Start and Answer route by opens.type', () => {
  const opens = (type: string, id: string) => row('x', { opens: { type, id } }) as never;

  it('a question opens Command Centre → Questions; a ticket its sheet; a Deliverable its page', () => {
    expect(briefTarget(opens('question', '31'), WEB)).toEqual({ app: '/cc/questions' });
    expect(briefTarget(opens('ticket', '849'), WEB)).toEqual({ app: '/cc/ticket/849' });
    expect(briefTarget(opens('deliverable', 'd-1'), WEB)).toEqual({ app: '/cc/deliverables/d-1' });
    expect(briefTarget(opens('chat', 'c-1'), WEB)).toEqual({ app: '/chat/c-1' });
    expect(briefTarget(opens('settings', 'readiness'), WEB)).toEqual({ app: '/settings' });
  });

  it('a Mission opens where the phone opens one; a ticket id that is not a row id goes nowhere', () => {
    expect(briefTarget(opens('mission', 'm-9'), WEB)).not.toBeNull();
    expect(briefTarget(opens('ticket', '#0849'), WEB)).toBeNull();
    expect(briefTarget(row('y') as never, WEB)).toBeNull();
  });
});

describe('briefDateLabel', () => {
  it('reads the local date, and keeps anything else as given', () => {
    expect(briefDateLabel('2026-10-27')).toBe('Tuesday, 27 October');
    expect(briefDateLabel('2026-02-30')).toBe('2026-02-30');
    expect(briefDateLabel('today')).toBe('today');
  });
});

describe('briefOnScreen', () => {
  it('is true only while a row on screen carries the brief', () => {
    const made = brief();
    expect(briefOnScreen([{ item: { type: 'auto', brief: made } }])).toBe(true);
    expect(
      briefOnScreen([{ item: { type: 'auto', brief: null } }, { item: { type: 'user' } }]),
    ).toBe(false);
    expect(briefOnScreen([])).toBe(false);
  });
});
