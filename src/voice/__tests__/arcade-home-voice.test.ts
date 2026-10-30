// Quick-ask on Arcade's home (US-022g), pure: HUD's home's press, caption and STOP in Arcade's voice
// surround — the talk button's words, state and hold, the voice's state words and line while it
// works or after a press has one to say (never a viewer's or 'See it in the chat'), MIC LIVE, and
// STOP while the voice works or a typed turn streams. Views come from the real reducer and
// voiceView (voice-view-fixtures.ts).

import { describe, expect, it, vi } from 'vitest';

import { ROLE_COPY } from '../../auth/strings';
import { arcadeHomeVoice, type ArcadeHomeVoiceInput } from '../home/arcade-home-voice';
import type { VoiceState } from '../machine/voice-state';
import { talkProps, voiceChip, type HoldHandlers } from '../screen/core-props';
import type { VoiceViewInput } from '../screen/voice-view-model';
import { PERMISSION_COPY, VOICE_MESSAGE_COPY } from '../strings';
import { AT, LISTENING, NOW, SPEAKING, run } from './voice-fixtures';
import { reply as replyOf, view as viewOf } from './voice-view-fixtures';

const FINISHED = run([...SPEAKING, { type: 'turn_finished' }, { type: 'speak_done' }]);
const TAPPED = run([{ type: 'hold_start', now: NOW }, { type: 'hold_too_short' }]);
const DENIED = run([
  { type: 'hold_start', now: NOW },
  { type: 'permission', step: 'settings' },
]);
const SETTINGS = { step: 'settings', blocked: 'microphone', asked: false } as const;

function hold(): HoldHandlers {
  return { onPressIn: vi.fn(), onPressOut: vi.fn(), onToggle: vi.fn() };
}

type Case = Partial<Omit<ArcadeHomeVoiceInput, 'view' | 'state'>> & {
  readonly state?: VoiceState;
  readonly viewInput?: Partial<VoiceViewInput>;
};

function input({ state = AT.idle, viewInput = {}, ...rest }: Case = {}): ArcadeHomeVoiceInput {
  return {
    view: viewOf({ state, ...viewInput }),
    state,
    shows: 'voice',
    threadStreams: false,
    hold: hold(),
    ...rest,
  };
}

describe('the caption and the line under the surround', () => {
  it("are none while the voice is quiet: Auto's portrait word stands", () => {
    const shown = arcadeHomeVoice(input());
    expect(shown.caption).toBeNull();
    expect(shown.line).toBeNull();
  });

  it("are the voice's state words while it works, after a typed send too", () => {
    for (const state of [AT.listening, AT.thinking, AT.speaking]) {
      const shown = arcadeHomeVoice(input({ state }));
      expect(shown.caption).toEqual(voiceChip(viewOf({ state })));
      expect(arcadeHomeVoice(input({ state, shows: 'thread' })).caption).toEqual(shown.caption);
    }
  });

  it('say why a press could not start, with Open Settings, and the hint for a tap', () => {
    const denied = arcadeHomeVoice(input({ state: DENIED, viewInput: { permission: SETTINGS } }));
    expect(denied.line?.button).toEqual({
      label: PERMISSION_COPY.openSettings,
      action: 'openSettings',
    });
    const tapped = arcadeHomeVoice(input({ state: TAPPED }));
    expect(tapped.line).toEqual({ kind: 'hint', text: VOICE_MESSAGE_COPY.holdHint, button: null });
  });

  it('give way once a typed send is the newest', () => {
    const shown = arcadeHomeVoice(
      input({ state: DENIED, viewInput: { permission: SETTINGS }, shows: 'thread' }),
    );
    expect(shown.caption).toBeNull();
    expect(shown.line).toBeNull();
  });

  it("never say a viewer's words or 'See it in the chat' here", () => {
    expect(arcadeHomeVoice(input({ viewInput: { roleCanChat: false } })).line).toBeNull();
    const cards = replyOf({ hasCards: true });
    const chat = viewOf({ state: FINISHED, reply: cards });
    expect(chat.message?.kind).toBe('chat');
    expect(
      arcadeHomeVoice(input({ state: FINISHED, viewInput: { reply: cards } })).line,
    ).toBeNull();
  });
});

describe('MIC LIVE, hold to talk and STOP', () => {
  it('MIC LIVE is the capture, never the phase (KV5)', () => {
    expect(arcadeHomeVoice(input({ state: AT.listening })).micOpen).toBe(true);
    expect(arcadeHomeVoice(input({ state: run(LISTENING.slice(0, 1)) })).micOpen).toBe(false);
    expect(arcadeHomeVoice(input({ state: AT.speaking })).micOpen).toBe(false);
  });

  it("hold to talk is HUD's: its words, its hold, its toggle", () => {
    const handlers = hold();
    const viewInput = { screenReader: true };
    const shown = arcadeHomeVoice(input({ state: AT.listening, viewInput, hold: handlers }));
    expect(shown.talk).toEqual(
      talkProps(viewOf({ state: AT.listening, ...viewInput }), 'listening', handlers),
    );
    expect(shown.talk.toggle).toBe(true);
    expect(shown.talk.active).toBe(true);
  });

  it('is off for a viewer, saying why (D-ROLES)', () => {
    const talk = arcadeHomeVoice(input({ viewInput: { roleCanChat: false } })).talk;
    expect(talk.enabled).toBe(false);
    expect(talk.hint).toBe(ROLE_COPY.viewerReadOnly);
  });

  it('STOP is on while the voice works or a typed turn streams', () => {
    expect(arcadeHomeVoice(input()).stopEnabled).toBe(false);
    expect(arcadeHomeVoice(input({ threadStreams: true })).stopEnabled).toBe(true);
    for (const state of [AT.listening, AT.thinking, AT.speaking])
      expect(arcadeHomeVoice(input({ state })).stopEnabled).toBe(true);
  });
});
