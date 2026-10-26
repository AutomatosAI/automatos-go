// One hold is one session (recognizer-core.ts): the module's events played in the order each phone
// sends them (expo-speech-recognition 3.1.3: ExpoSpeechService.kt onSegmentResults / onError /
// teardownAndEnd; ExpoSpeechRecognitionModule.swift handleRecognitionResult, abort).

import { describe, expect, it } from 'vitest';

import { recognitionPolicy } from '../quick-ask/recognition-policy';
import { listening, result, voiced } from './recognizer-port';

const READY = recognitionPolicy({
  platform: 'ios',
  supportsOnDevice: true,
  recognitionAvailable: true,
  locale: 'en-GB',
});

const STARTED = { kind: 'started' };
const ENDED = { kind: 'ended' };
const MIC_OPEN = voiced({ type: 'mic_open' });
const MIC_CLOSED = voiced({ type: 'mic_closed' });
const partial = (text: string) => voiced({ type: 'partial', text });
const final = (text: string) => voiced({ type: 'final', text });

function held() {
  const harness = listening();
  harness.recognizer.start(READY);
  harness.emit('start');
  harness.emit('audiostart', { uri: null });
  return harness;
}

describe('a hold', () => {
  it('shows the words as they come and says final once, at the end after the release', () => {
    const { emit, recognizer, heard } = held();
    emit('result', result('turn on'));
    emit('result', result('turn on the lights'));
    recognizer.stop();
    emit('result', result('Turn on the lights.', true));
    emit('audioend', { uri: null });
    emit('end');
    expect(heard).toEqual([
      STARTED,
      MIC_OPEN,
      partial('turn on'),
      partial('turn on the lights'),
      partial('Turn on the lights.'),
      MIC_CLOSED,
      final('Turn on the lights.'),
      ENDED,
    ]);
  });

  it("joins Android's segments, and a silent segment mid-hold does not end it", () => {
    const { emit, heard } = held();
    emit('result', result('turn on', true));
    emit('nomatch');
    emit('result', result('the'));
    emit('result', result('the lights', true));
    emit('end');
    expect(heard.slice(2)).toEqual([
      partial('turn on'),
      partial('turn on the'),
      partial('turn on the lights'),
      final('turn on the lights'),
      ENDED,
    ]);
  });

  it("joins iOS 18's early finals, whose later pieces start with a space", () => {
    const { emit, heard } = held();
    emit('result', result('What is on', true));
    emit('result', result(' my calendar', true));
    emit('result', result('', true));
    emit('end');
    expect(heard.slice(-2)).toEqual([final('What is on my calendar'), ENDED]);
  });

  it('sends the words still being heard when the end comes before their final', () => {
    const { emit, heard } = held();
    emit('result', result('hello'));
    emit('end');
    expect(heard.slice(-2)).toEqual([final('hello'), ENDED]);
  });

  it('says nothing heard once when the hold had no words', () => {
    const { emit, heard } = held();
    emit('nomatch');
    emit('error', { error: 'no-speech', message: 'No speech' });
    emit('audioend', { uri: null });
    emit('end');
    expect(heard).toEqual([
      STARTED,
      MIC_OPEN,
      MIC_CLOSED,
      voiced({ type: 'nothing_heard' }),
      ENDED,
    ]);
  });

  it('keeps the words heard before a no-speech error', () => {
    const { emit, heard } = held();
    emit('result', result('hello', true));
    emit('error', { error: 'speech-timeout', message: 'timeout' });
    emit('end');
    expect(heard.slice(-2)).toEqual([final('hello'), ENDED]);
  });

  it('passes the level through', () => {
    const { emit, heard } = held();
    emit('volumechange', { value: 2.5 });
    expect(heard.at(-1)).toEqual({ kind: 'level', level: 0.25 });
  });
});

describe('STOP and failures', () => {
  it('sends nothing after abort(), while MIC LIVE still follows the capture', () => {
    const { emit, recognizer, heard, port } = held();
    emit('result', result('delete every'));
    recognizer.abort();
    emit('error', { error: 'aborted', message: 'Speech recognition aborted.' });
    emit('result', result('delete everything', true));
    emit('audioend', { uri: null });
    emit('end');
    expect(port.abort).toHaveBeenCalledTimes(1);
    expect(heard).toEqual([STARTED, MIC_OPEN, partial('delete every'), MIC_CLOSED, ENDED]);
  });

  it('tells a failure once and sends nothing after it, even with words heard', () => {
    const { emit, heard } = held();
    emit('result', result('remind me', true));
    emit('error', { error: 'interrupted', message: 'call' });
    emit('error', { error: 'audio-capture', message: 'late' });
    emit('result', result('remind me to call', true));
    emit('end');
    expect(heard.slice(2)).toEqual([
      partial('remind me'),
      voiced({ type: 'interrupted', reason: 'audio-session' }),
      ENDED,
    ]);
  });

  it('tells a failure that comes before the session started, then its end', () => {
    const { emit, recognizer, heard } = listening();
    recognizer.start(READY);
    emit('error', { error: 'language-not-supported', message: 'Locale' });
    emit('end');
    expect(heard).toEqual([voiced({ type: 'unavailable', reason: 'no-on-device' }), ENDED]);
  });

  it("ignores the previous session's end when it lands after the next start", () => {
    const { emit, recognizer, heard } = held();
    recognizer.abort();
    recognizer.start(READY);
    emit('audioend', { uri: null });
    emit('end');
    emit('audiostart', { uri: null });
    emit('result', result('hello', true));
    emit('end');
    expect(heard.slice(2)).toEqual([MIC_CLOSED, MIC_OPEN, partial('hello'), final('hello'), ENDED]);
  });

  it('says nothing for words or an end with no session', () => {
    const { emit, heard } = listening();
    emit('result', result('stray', true));
    emit('error', { error: 'busy', message: 'busy' });
    emit('end');
    expect(heard).toEqual([]);
  });

  it('starts each hold fresh', () => {
    const { emit, recognizer, heard } = held();
    emit('result', result('first', true));
    emit('end');
    recognizer.start(READY);
    emit('start');
    emit('result', result('second', true));
    emit('end');
    expect(heard.slice(-2)).toEqual([final('second'), ENDED]);
  });
});

// iOS runs start, stop and abort in Tasks of their own (ExpoSpeechRecognitionModule.swift:174-260,
// 360-379): a stop or abort that lands before the capture begins is answered with an end, and the
// capture then starts anyway (P001V-RVW-1). Android posts them in order to one Handler.
describe('a stop or abort while the session is still starting', () => {
  it('abort answered early (iOS, the first hold): sent again once at the first event, says nothing', () => {
    const { emit, recognizer, heard, port } = listening();
    recognizer.start(READY);
    recognizer.abort();
    emit('error', { error: 'aborted', message: 'Speech recognition aborted.' });
    emit('end');
    emit('start');
    emit('audiostart', { uri: null });
    expect(port.abort).toHaveBeenCalledTimes(2);
    emit('result', result('delete everything', true));
    emit('error', { error: 'aborted', message: 'Speech recognition aborted.' });
    emit('audioend', { uri: null });
    emit('end');
    expect(port.abort).toHaveBeenCalledTimes(2);
    expect(heard).toEqual([STARTED, MIC_OPEN, MIC_CLOSED, ENDED]);
  });

  it('stop answered early: sent again once, and the final is said once, at the real end', () => {
    const { emit, recognizer, heard, port } = listening();
    recognizer.start(READY);
    recognizer.stop();
    emit('end');
    emit('start');
    emit('audiostart', { uri: null });
    expect(port.stop).toHaveBeenCalledTimes(2);
    emit('result', result('hello', true));
    // The module's second end() skips audioend: the end closes MIC LIVE itself.
    emit('end');
    expect(port.stop).toHaveBeenCalledTimes(2);
    expect(heard).toEqual([STARTED, MIC_OPEN, partial('hello'), MIC_CLOSED, final('hello'), ENDED]);
  });

  it('abort answered early with its audioend (a later hold): MIC LIVE still goes out at the end', () => {
    const { emit, recognizer, heard, port } = listening();
    recognizer.start(READY);
    recognizer.abort();
    emit('audioend', { uri: null });
    emit('end');
    emit('start');
    emit('audiostart', { uri: null });
    emit('end');
    expect(port.abort).toHaveBeenCalledTimes(2);
    expect(heard).toEqual([MIC_CLOSED, STARTED, MIC_OPEN, MIC_CLOSED, ENDED]);
  });

  it('abort wins over stop: STOP after the release sends the abort again, not the stop', () => {
    const { emit, recognizer, port } = listening();
    recognizer.start(READY);
    recognizer.stop();
    recognizer.abort();
    emit('end');
    emit('start');
    expect(port.abort).toHaveBeenCalledTimes(2);
    expect(port.stop).toHaveBeenCalledTimes(1);
  });

  it('a call that reached the capture (no early end) is not sent again', () => {
    const { emit, recognizer, heard, port } = listening();
    recognizer.start(READY);
    recognizer.stop();
    emit('start');
    emit('audiostart', { uri: null });
    emit('result', result('hello', true));
    emit('audioend', { uri: null });
    emit('end');
    expect(port.stop).toHaveBeenCalledTimes(1);
    expect(heard.slice(-2)).toEqual([final('hello'), ENDED]);
  });

  it("Android's order (audiostart, then the abort's audioend and end): no second abort", () => {
    const { emit, recognizer, heard, port } = listening();
    recognizer.start(READY);
    recognizer.abort();
    emit('audiostart', { uri: null });
    emit('audioend', { uri: null });
    emit('end');
    expect(port.abort).toHaveBeenCalledTimes(1);
    expect(heard).toEqual([MIC_OPEN, MIC_CLOSED, ENDED]);
  });

  it("a stale end before a fresh session's first event, with no stop asked, is still dropped", () => {
    const { emit, recognizer, heard, port } = held();
    recognizer.abort();
    recognizer.start(READY);
    emit('end');
    emit('start');
    emit('result', result('hello', true));
    emit('end');
    expect(port.abort).toHaveBeenCalledTimes(1);
    expect(port.stop).not.toHaveBeenCalled();
    expect(heard.slice(-2)).toEqual([final('hello'), ENDED]);
  });
});
