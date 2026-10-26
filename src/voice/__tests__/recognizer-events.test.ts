import { describe, expect, it } from 'vitest';

import {
  RECOGNIZER_EVENTS,
  toRecognizerEvent,
  volumeLevel,
  type NativeEventName,
} from '../quick-ask/recognizer-events';

const voice = (event: object) => ({ kind: 'voice', event });

describe('toRecognizerEvent — the module events', () => {
  it('lists the eight events quick-ask subscribes', () => {
    expect([...RECOGNIZER_EVENTS].sort()).toEqual(
      [
        'audioend',
        'audiostart',
        'end',
        'error',
        'nomatch',
        'result',
        'start',
        'volumechange',
      ].sort(),
    );
  });

  it('maps a partial result to partial and a final one to final, the first alternative only', () => {
    const results = [
      { transcript: 'turn on the lights', confidence: 0.9, segments: [] },
      { transcript: 'turn on the light', confidence: 0.4, segments: [] },
    ];
    expect(toRecognizerEvent('result', { isFinal: false, results })).toEqual(
      voice({ type: 'partial', text: 'turn on the lights' }),
    );
    expect(toRecognizerEvent('result', { isFinal: true, results })).toEqual(
      voice({ type: 'final', text: 'turn on the lights' }),
    );
  });

  it('maps a result with no alternatives to empty words', () => {
    expect(toRecognizerEvent('result', { isFinal: true, results: [] })).toEqual(
      voice({ type: 'final', text: '' }),
    );
  });

  it('follows the real capture: audiostart opens the mic, audioend closes it', () => {
    expect(toRecognizerEvent('audiostart', { uri: null })).toEqual(voice({ type: 'mic_open' }));
    expect(toRecognizerEvent('audioend', { uri: null })).toEqual(voice({ type: 'mic_closed' }));
  });

  it('maps nomatch to nothing heard, start and end to the session edges', () => {
    expect(toRecognizerEvent('nomatch', null)).toEqual(voice({ type: 'nothing_heard' }));
    expect(toRecognizerEvent('start', null)).toEqual({ kind: 'started' });
    expect(toRecognizerEvent('end', null)).toEqual({ kind: 'ended' });
  });

  it('drops a payload that does not parse, ignoring unknown fields in one that does', () => {
    expect(toRecognizerEvent('result', { isFinal: 'yes', results: [] })).toBeNull();
    expect(toRecognizerEvent('result', null)).toBeNull();
    expect(toRecognizerEvent('volumechange', { value: 'loud' })).toBeNull();
    expect(
      toRecognizerEvent('result', {
        isFinal: false,
        results: [{ transcript: 'hi', extra: 1 }],
        future: true,
      }),
    ).toEqual(voice({ type: 'partial', text: 'hi' }));
  });

  it('says nothing for an event it does not know', () => {
    expect(toRecognizerEvent('speechstart' as NativeEventName, null)).toBeNull();
  });
});

describe('toRecognizerEvent — error codes', () => {
  const error = (code: string) => toRecognizerEvent('error', { error: code, message: 'native' });

  it.each([
    ['no-speech', voice({ type: 'nothing_heard' })],
    ['speech-timeout', voice({ type: 'nothing_heard' })],
    ['not-allowed', voice({ type: 'permission', step: 'settings' })],
    ['interrupted', voice({ type: 'interrupted', reason: 'audio-session' })],
    ['audio-capture', voice({ type: 'error', kind: 'mic-busy' })],
    ['language-not-supported', voice({ type: 'unavailable', reason: 'no-on-device' })],
    ['service-not-allowed', voice({ type: 'unavailable', reason: 'no-on-device' })],
    ['network', voice({ type: 'unavailable', reason: 'no-on-device' })],
    ['busy', voice({ type: 'error', kind: 'busy' })],
    ['too-many-requests', voice({ type: 'error', kind: 'busy' })],
    ['client', voice({ type: 'error', kind: 'recognizer' })],
    ['unknown', voice({ type: 'error', kind: 'recognizer' })],
    ['bad-grammar', voice({ type: 'error', kind: 'recognizer' })],
    ['a-future-code', voice({ type: 'error', kind: 'recognizer' })],
    ['constructor', voice({ type: 'error', kind: 'recognizer' })],
  ])('maps %s', (code, expected) => {
    expect(error(code)).toEqual(expected);
  });

  it('ignores aborted: STOP or the background asked for it', () => {
    expect(error('aborted')).toBeNull();
  });

  it('treats an error it cannot read as a recognizer failure', () => {
    expect(toRecognizerEvent('error', { code: 5 })).toEqual(
      voice({ type: 'error', kind: 'recognizer' }),
    );
  });
});

describe('volumeLevel', () => {
  it.each([
    [-2, 0],
    [-0.5, 0],
    [0, 0],
    [2.5, 0.25],
    [5, 0.5],
    [10, 1],
    [12, 1],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])('turns %d into %d', (value, level) => {
    expect(volumeLevel(value)).toBe(level);
  });

  it('arrives as a level event', () => {
    expect(toRecognizerEvent('volumechange', { value: 5 })).toEqual({ kind: 'level', level: 0.5 });
  });
});
