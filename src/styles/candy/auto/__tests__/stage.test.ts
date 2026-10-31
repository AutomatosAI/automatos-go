// What Auto's stage shows in Candy (D-CAN-5, D-A11Y; the kit's chat/stage-state.ts): the home's
// turn state with its glyph, word and caption, unless A6's quick-ask is under way — opening the
// mic: loading; the mic open: listening; waiting: thinking; speaking: idle, said 'Speaking'; a
// failure: oops — and Auto's one name for VoiceOver.

import { describe, expect, it } from 'vitest';

import { captionFor } from '../../../../core/frozen/lib/mascot/media';
import { MASCOT_STATES } from '../../../../core/frozen/lib/mascot/types';
import type { VoicePhase } from '../../../../voice/machine/voice-state';
import { stageLabel, stageOf, stageVoicePhase, type StageVoice } from '../stage';

const voice = (phase: VoicePhase, micOpen = false): StageVoice => ({ phase, micOpen });

describe("the home's turn", () => {
  it.each(MASCOT_STATES)(
    'shows %s with its glyph, word and caption when no voice is on',
    (state) => {
      const stage = stageOf(state, null);
      expect(stage.state).toBe(state);
      expect(stage.caption).toBe(captionFor(state));
      expect(stage.glyph.length).toBe(1);
      expect(stage.word.length).toBeGreaterThan(0);
      expect(stageOf(state, voice('idle'))).toEqual(stage);
    },
  );

  it("says '● Working' while Auto works and '○ Ready' at rest", () => {
    expect(stageOf('working', null)).toEqual({
      state: 'working',
      glyph: '●',
      word: 'Working',
      caption: captionFor('working'),
    });
    expect(stageOf('idle', null)).toMatchObject({ glyph: '○', word: 'Ready' });
  });
});

describe('quick-ask under way', () => {
  it('is loading while the mic opens (a press, before the capture opens)', () => {
    expect(stageVoicePhase(voice('listening'))).toBe('connecting');
    expect(stageOf('working', voice('listening'))).toMatchObject({
      state: 'loading',
      glyph: '●',
      word: 'Loading',
      caption: captionFor('loading'),
    });
  });

  it("listens while the mic is open: '● Listening'", () => {
    expect(stageOf('idle', voice('listening', true))).toMatchObject({
      state: 'listening',
      glyph: '●',
      word: 'Listening',
      caption: captionFor('listening'),
    });
  });

  it('listens whenever the capture is open, whatever the phase says (KV5)', () => {
    expect(stageOf('working', voice('idle', true)).state).toBe('listening');
    expect(stageOf('working', voice('thinking', true)).state).toBe('listening');
  });

  it('thinks while waiting for the reply', () => {
    expect(stageOf('idle', voice('thinking'))).toMatchObject({
      state: 'thinking',
      word: 'Thinking',
      caption: captionFor('thinking'),
    });
  });

  it("is drawn idle while he speaks, and the stage says 'Speaking'", () => {
    expect(stageOf('working', voice('speaking'))).toEqual({
      state: 'idle',
      glyph: '●',
      word: 'Speaking',
      caption: 'Speaking',
    });
  });

  it("shows oops on a failure: '✕ Oops'", () => {
    expect(stageOf('working', voice('error'))).toMatchObject({
      state: 'oops',
      glyph: '✕',
      word: 'Oops',
      caption: captionFor('oops'),
    });
    expect(stageOf('working', voice('error', true)).state).toBe('oops');
  });

  it("leaves the turn's state when the voice is at rest", () => {
    expect(stageVoicePhase(null)).toBe('idle');
    expect(stageVoicePhase(voice('idle'))).toBe('idle');
    expect(stageOf('celebrate', voice('idle')).state).toBe('celebrate');
  });
});

describe("Auto's name on the stage", () => {
  it("is 'Auto, {caption}'", () => {
    expect(stageLabel(stageOf('working', null))).toBe(`Auto, ${captionFor('working')}`);
    expect(stageLabel(stageOf('idle', voice('speaking')))).toBe('Auto, Speaking');
  });
});
