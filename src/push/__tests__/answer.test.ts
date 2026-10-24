// A reply's answer read honestly (US-015d, KP8): the words compared after JavaScript's trim() and
// Python's strip() both, the ticket's number with one '#', and what each failure means — 422 already
// answered, network or an id refused unsent 'Not sent', anything else the taxonomy's words.

import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/errors';
import { API_ERROR_COPY } from '../../api/strings';
import {
  sameAnswer,
  settlesQuestion,
  strippedBothWays,
  ticketLabel,
  verdictOfError,
  verdictOfResult,
} from '../inbound/answer';
import { PUSH_ACTION_COPY } from '../strings';
import { grantAnswer } from './handler-fixtures';

const REPLY = { grantId: '42', answerText: 'Ship it', ticketNumber: '#0419' };

describe('strippedBothWays / sameAnswer', () => {
  it.each([
    ['  Ship it  ', 'Ship it'],
    ['\u001cShip it\u001f', 'Ship it'],
    ['\u0085Ship it﻿', 'Ship it'],
    [' 　Ship it ', 'Ship it'],
    ['Ship \u001f it', 'Ship \u001f it'],
    ['\u001f \u0085', ''],
    ['', ''],
  ])('%j → %j', (raw, stripped) => {
    expect(strippedBothWays(raw)).toBe(stripped);
  });

  it('compares the words after both strips; null never matches', () => {
    expect(sameAnswer('\u001fShip it', 'Ship it')).toBe(true);
    expect(sameAnswer('Ship it', 'ship it')).toBe(false);
    expect(sameAnswer('Ship it', null)).toBe(false);
  });
});

describe('ticketLabel', () => {
  it.each([
    ['#0419', '#0419'],
    ['0419', '#0419'],
    ['##0419', '#0419'],
    [' #0051.3 ', '#0051.3'],
    ['#', null],
    ['', null],
    [undefined, null],
  ])('%j → %j', (number, label) => {
    expect(ticketLabel(number)).toBe(label);
  });
});

describe('verdictOfResult / verdictOfError', () => {
  it('granted with these words → answered; another status or answer → already answered', () => {
    expect(verdictOfResult(grantAnswer('granted', 'Ship it'), REPLY)).toEqual({
      kind: 'answered',
      toast: 'Answered #0419.',
    });
    expect(verdictOfResult(grantAnswer('denied', 'Ship it'), REPLY).kind).toBe('already_answered');
    expect(verdictOfResult(grantAnswer('granted', 'Hold it'), REPLY).kind).toBe('already_answered');
    expect(verdictOfResult(grantAnswer('granted', null), REPLY).kind).toBe('already_answered');
  });

  it.each([
    [
      '422',
      new ApiError('server', { status: 422 }),
      'already_answered',
      PUSH_ACTION_COPY.alreadyAnswered,
    ],
    ['network', new ApiError('network'), 'not_sent', PUSH_ACTION_COPY.notSent],
    [
      'an id refused unsent',
      new TypeError('A question id is not one the server can take'),
      'not_sent',
      PUSH_ACTION_COPY.notSent,
    ],
    ['403', new ApiError('forbidden', { status: 403 }), 'refused', API_ERROR_COPY.forbidden],
    ['404', new ApiError('not_found', { status: 404 }), 'refused', API_ERROR_COPY.not_found],
    ['500', new ApiError('server', { status: 500 }), 'refused', API_ERROR_COPY.server],
  ])('%s → %s', (_name, error, kind, toast) => {
    expect(verdictOfError(error)).toEqual({ kind, toast });
  });

  it('only an answer or an already-answered question settles it', () => {
    expect(settlesQuestion({ kind: 'answered', toast: '' })).toBe(true);
    expect(settlesQuestion({ kind: 'already_answered', toast: '' })).toBe(true);
    expect(settlesQuestion({ kind: 'not_sent', toast: '' })).toBe(false);
    expect(settlesQuestion({ kind: 'refused', toast: '' })).toBe(false);
  });
});
