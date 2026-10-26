// One audio owner at a time (US-019g, KV13): the recognizer takes the audio from the speaker
// (barge-in), the speaker never talks over the open mic, Live takes it from both and refuses
// quick-ask, and claiming 'none' (STOP) stops whoever holds it.

import { describe, expect, it } from 'vitest';

import { claim, release, type AudioOwner } from '../audio/audio-owner';

const OWNERS: readonly AudioOwner[] = ['none', 'recognizer', 'speaker', 'live'];

describe('claim', () => {
  it('keeps the owner and stops nothing when it claims again', () => {
    for (const owner of OWNERS)
      expect(claim(owner, owner), owner).toEqual({ owner, stop: [], granted: true });
  });

  it('gives free audio to the recognizer or the speaker, stopping nothing', () => {
    for (const next of ['recognizer', 'speaker'] as const)
      expect(claim('none', next), next).toEqual({ owner: next, stop: [], granted: true });
  });

  it('stops the speaker when the recognizer claims (barge-in)', () => {
    expect(claim('speaker', 'recognizer')).toEqual({
      owner: 'recognizer',
      stop: ['speaker'],
      granted: true,
    });
  });

  it('refuses the speaker while the mic is open', () => {
    expect(claim('recognizer', 'speaker')).toEqual({
      owner: 'recognizer',
      stop: [],
      granted: false,
    });
  });

  it('gives Live the audio from anyone, stopping recognition and speech', () => {
    for (const owner of ['none', 'recognizer', 'speaker'] as const)
      expect(claim(owner, 'live'), owner).toEqual({
        owner: 'live',
        stop: ['recognizer', 'speaker'],
        granted: true,
      });
  });

  it("refuses quick-ask's claims while Live is up", () => {
    for (const next of ['recognizer', 'speaker'] as const)
      expect(claim('live', next), next).toEqual({ owner: 'live', stop: [], granted: false });
  });

  it('stops whoever holds the audio on a claim for none (STOP)', () => {
    expect(claim('recognizer', 'none')).toEqual({
      owner: 'none',
      stop: ['recognizer'],
      granted: true,
    });
    expect(claim('speaker', 'none').stop).toEqual(['speaker']);
    expect(claim('live', 'none').stop).toEqual(['live']);
  });

  it('returns frozen claims', () => {
    for (const owner of OWNERS)
      for (const next of OWNERS) {
        const result = claim(owner, next);
        expect(Object.isFrozen(result), `${owner} → ${next}`).toBe(true);
        expect(Object.isFrozen(result.stop), `${owner} → ${next}`).toBe(true);
      }
  });
});

describe('release', () => {
  it('frees the audio when its holder is done with it', () => {
    expect(release('speaker', 'speaker')).toBe('none');
    expect(release('recognizer', 'recognizer')).toBe('none');
    expect(release('live', 'live')).toBe('none');
  });

  it("leaves another holder's audio alone (a late end after barge-in)", () => {
    expect(release('recognizer', 'speaker')).toBe('recognizer');
    expect(release('speaker', 'recognizer')).toBe('speaker');
    expect(release('none', 'speaker')).toBe('none');
  });
});
