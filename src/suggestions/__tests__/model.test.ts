import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/errors';
import {
  HIDE_MENU,
  STARTED_FOR_MS,
  countText,
  hideChoiceOf,
  isShowable,
  openSuggestions,
  pinnedForm,
  startRefusal,
  suggestionView,
  withoutSuggestion,
} from '../model';
import { SUGGESTION_COPY } from '../strings';
import { suggestion } from './fixtures';

const NOW = Date.parse('2026-10-28T09:00:00Z');

describe('openSuggestions: the newest open one first', () => {
  it('sorts by when each was made, newest first, and keeps the open ones only', () => {
    const list = [
      suggestion('a', { created_at: '2026-10-28T07:00:00Z' }),
      suggestion('b', { created_at: '2026-10-28T08:30:00Z' }),
      suggestion('c', { status: 'started' }),
      suggestion('d', { created_at: null }),
    ];
    expect(openSuggestions(list, NOW).map((each) => each.id)).toEqual(['b', 'a', 'd']);
  });

  it('leaves out an open one past its expiry (the server lapses it on its next read)', () => {
    expect(isShowable(suggestion('e', { expires_at: '2026-10-28T08:59:00Z' }), NOW)).toBe(false);
    expect(isShowable(suggestion('f', { expires_at: null }), NOW)).toBe(true);
  });
});

describe('suggestionView', () => {
  it('says what Start does and names the suggestion in every action, never its cost', () => {
    const view = suggestionView(suggestion('a'));
    expect(view.does).toBe(SUGGESTION_COPY.does.board_task);
    expect(view.startLabel).toBe('Start: Idea a');
    expect(view.hideLabel).toBe('Hide: Idea a');
    expect(view.cardLabel).toBe('Auto suggests: Idea a. Because a');
    expect(JSON.stringify(view)).not.toMatch(/credit|40/i);
  });

  it('says nothing about Start for a kind this version does not know', () => {
    expect(
      suggestionView(suggestion('x', { proposed_action: { kind: 'teleport' } })).does,
    ).toBeNull();
    expect(suggestionView(suggestion('y', { proposed_action: null })).does).toBeNull();
  });
});

describe('the pinned card and the count', () => {
  it('is one line while the keyboard is up', () => {
    expect(pinnedForm(0)).toBe('card');
    expect(pinnedForm(301)).toBe('line');
  });

  it('counts the open ones in the header, and hides the count at zero', () => {
    expect(countText(3)).toBe('Ideas · 3');
    expect(countText(0)).toBeNull();
  });

  it('shows Started for 4 s', () => {
    expect(STARTED_FOR_MS).toBe(4000);
  });
});

describe('startRefusal: one line in the app’s words', () => {
  it.each([
    [new ApiError('network'), SUGGESTION_COPY.refused.offline],
    [new ApiError('conflict', { status: 409, code: 'expired' }), SUGGESTION_COPY.refused.expired],
    [
      new ApiError('conflict', { status: 409, code: 'already_started' }),
      SUGGESTION_COPY.refused.already_started,
    ],
    [
      new ApiError('conflict', { status: 409, code: 'not_available' }),
      SUGGESTION_COPY.refused.not_available,
    ],
    [
      new ApiError('conflict', { status: 409, code: 'spend_ceiling' }),
      SUGGESTION_COPY.refused.spend_ceiling,
    ],
    [new ApiError('conflict', { status: 409, code: 'offline' }), SUGGESTION_COPY.refused.other],
    [new ApiError('server', { status: 503, code: 'unavailable' }), SUGGESTION_COPY.refused.other],
    [new Error('boom'), SUGGESTION_COPY.refused.other],
  ])('%s', (error, line) => {
    expect(startRefusal(error)).toBe(line);
  });

  it('never names a spend, a credit or a cost (D8)', () => {
    for (const line of Object.values(SUGGESTION_COPY.refused)) {
      expect(line).not.toMatch(/spend|credit|cost|price|plan/i);
    }
  });
});

describe('Hide', () => {
  it('takes the suggestion off the list at once, leaving the rest', () => {
    const list = [suggestion('a'), suggestion('b')];
    expect(withoutSuggestion(list, 'a')?.map((each) => each.id)).toEqual(['b']);
    expect(withoutSuggestion(undefined, 'a')).toBeUndefined();
  });

  it('offers the three reasons then Cancel, and Cancel hides nothing', () => {
    expect(HIDE_MENU).toEqual(['not_now', 'not_useful', 'wrong_agent', 'cancel']);
    expect(hideChoiceOf(0)).toEqual({ hide: true, reason: 'not_now' });
    expect(hideChoiceOf(2)).toEqual({ hide: true, reason: 'wrong_agent' });
    expect(hideChoiceOf(3)).toEqual({ hide: false });
    expect(hideChoiceOf(-1)).toEqual({ hide: false });
  });
});
