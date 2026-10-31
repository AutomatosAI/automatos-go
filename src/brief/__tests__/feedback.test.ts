// The thumbs on the brief (§6.4 'Feedback'): core's existing digest feedback route with the brief's
// state and 1 or -1; offered only with a state and a role that may use Auto; a press shows chosen at
// once, one send at a time; a refusal puts the last agreed choice back with a line; no cost words.

import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/errors';
import {
  createFeedbackMemory,
  feedbackBody,
  feedbackOffered,
  feedbackRefused,
  feedbackSent,
  feedbackStart,
  pressFeedback,
  sendBriefFeedback,
  shownRating,
} from '../feedback';
import { BRIEF_ROUTES } from '../routes';
import { BRIEF_COPY } from '../strings';

describe('the route and its body', () => {
  it("posts core's existing POST /api/activity/digest/feedback {state_hash, rating}", async () => {
    const request = vi.fn(async () => undefined);
    await sendBriefFeedback({ request } as never, 'h-1', 'down');
    expect(BRIEF_ROUTES.feedback).toEqual({
      method: 'POST',
      path: '/api/activity/digest/feedback',
    });
    expect(request).toHaveBeenCalledWith(BRIEF_ROUTES.feedback, {
      body: { state_hash: 'h-1', rating: -1 },
    });
    expect(feedbackBody('h-1', 'up')).toEqual({ state_hash: 'h-1', rating: 1 });
  });

  it("is refused as the client's error, which the card turns into one line", async () => {
    const request = vi.fn(async () => {
      throw new ApiError('forbidden', { status: 403 });
    });
    await expect(sendBriefFeedback({ request } as never, 'h-1', 'up')).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe('who sees the thumbs', () => {
  it('needs the state the brief described and a role that may use Auto', () => {
    expect(feedbackOffered({ state_hash: 'h-1' }, 'editor')).toBe(true);
    expect(feedbackOffered({ state_hash: '  ' }, 'owner')).toBe(false);
    expect(feedbackOffered({ state_hash: 'h-1' }, 'viewer')).toBe(false);
    expect(feedbackOffered({ state_hash: 'h-1' }, null)).toBe(false);
  });
});

describe('a press', () => {
  it('shows as chosen at once and sends; the agreed choice stays', () => {
    const pressed = pressFeedback(feedbackStart(null), 'up');
    expect(pressed.send).toBe(true);
    expect(shownRating(pressed.state)).toBe('up');
    const agreed = feedbackSent(pressed.state, 'up');
    expect(agreed).toEqual({ chosen: 'up', sending: null, failed: false });
  });

  it('sends nothing for the chosen one again, or while one is on its way', () => {
    expect(pressFeedback(feedbackStart('up'), 'up').send).toBe(false);
    const out = pressFeedback(feedbackStart(null), 'up').state;
    expect(pressFeedback(out, 'down')).toEqual({ state: out, send: false });
  });

  it('can change its mind: down after up is sent', () => {
    const pressed = pressFeedback(feedbackStart('up'), 'down');
    expect(pressed.send).toBe(true);
    expect(shownRating(pressed.state)).toBe('down');
  });

  it('a refusal puts the last agreed choice back and says one line, never a crash', () => {
    const out = pressFeedback(feedbackStart('up'), 'down').state;
    const refused = feedbackRefused(out);
    expect(shownRating(refused)).toBe('up');
    expect(refused.failed).toBe(true);
    expect(pressFeedback(refused, 'down').state.failed).toBe(false);
  });
});

describe('the launch memory', () => {
  it('keeps the agreed choice per brief state, so every card of it agrees', () => {
    const memory = createFeedbackMemory();
    expect(memory.get('h-1')).toBeNull();
    memory.set('h-1', 'down');
    expect(memory.get('h-1')).toBe('down');
    expect(memory.get('h-2')).toBeNull();
  });
});

describe('the words', () => {
  it('name the brief, never a cost, a credit or a plan (D8)', () => {
    const words = Object.values(BRIEF_COPY.feedback).join(' ');
    expect(words).not.toMatch(/credit|cost|price|plan|\$|€/i);
    expect(BRIEF_COPY.feedback.up).toMatch(/brief/);
  });
});
