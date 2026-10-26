// 'Auto, stop' (US-019g, KV5): a stop phrase acts as STOP only as the WHOLE utterance, after
// lower-casing, dropping punctuation and a leading wake word; a request that mentions stopping is
// sent to Auto as said.

import { describe, expect, it } from 'vitest';

import { STOP_PHRASES } from '../config';
import { isStopPhrase, utteranceWords } from '../quick-ask/stop-phrase';

describe('isStopPhrase', () => {
  it('matches every configured phrase as said', () => {
    for (const phrase of STOP_PHRASES) expect(isStopPhrase(phrase), phrase).toBe(true);
  });

  it('matches whatever the case and the punctuation', () => {
    for (const said of ['Auto, stop.', 'STOP!', 'Stop it…', 'Cancel?', 'auto — stop', '"Stop."'])
      expect(isStopPhrase(said), said).toBe(true);
  });

  it('drops a leading wake word', () => {
    for (const said of ['Hey Auto, stop', 'hey auto cancel!', 'Auto, cancel.', 'Auto stop it'])
      expect(isStopPhrase(said), said).toBe(true);
  });

  it("keeps the wake word when it is the phrase's own ('auto stop', 'stop auto')", () => {
    expect(isStopPhrase('Hey Auto, auto stop')).toBe(true);
    expect(isStopPhrase('Stop, Auto!')).toBe(true);
  });

  it('never matches a request that mentions stopping', () => {
    for (const said of [
      'stop the deploy',
      'Auto, stop the deploy.',
      'can you stop',
      'please stop',
      'cancel my meeting',
      "don't stop",
      'stop stop',
      'stopwatch',
    ])
      expect(isStopPhrase(said), said).toBe(false);
  });

  it('never matches the wake word alone, nothing, or punctuation alone', () => {
    for (const said of ['Auto', 'Hey Auto!', '', '   ', '?!', '…'])
      expect(isStopPhrase(said), JSON.stringify(said)).toBe(false);
  });
});

describe('utteranceWords', () => {
  it('lower-cases, turns punctuation and symbols into spaces and collapses the spaces', () => {
    expect(utteranceWords('  Hey   Auto,\nSTOP!! ')).toBe('hey auto stop');
    expect(utteranceWords('Auto—stop')).toBe('auto stop');
  });
});
