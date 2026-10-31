// Quick-ask on Candy's home (US-023g), pure: Arcade's press, caption and Stop in the tab bar's raised
// centre — the talk button's words, state and hold, the voice's state words (voiceView's chipLabel,
// Candy's sentence case) and line while it works or after a press has one to say, never a viewer's,
// but 'See it in the chat' kept (the Chat view is a tap away), MIC LIVE, and Stop while the voice
// works or a typed turn streams. Views come from the real reducer and voiceView
// (voice-view-fixtures.ts).

import { describe, expect, it, vi } from 'vitest';

import { ROLE_COPY } from '../../auth/strings';
import {
  candyCaption,
  candyHomeLine,
  candyHomeVoice,
  type CandyHomeVoiceInput,
} from '../home/candy-home-voice';
import type { VoiceState } from '../machine/voice-state';
import { talkProps, type HoldHandlers } from '../screen/core-props';
import type { VoiceViewInput } from '../screen/voice-view-model';
import { PERMISSION_COPY, SEE_IN_CHAT, VOICE_MESSAGE_COPY } from '../strings';
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

type Case = Partial<Omit<CandyHomeVoiceInput, 'view' | 'state'>> & {
  readonly state?: VoiceState;
  readonly viewInput?: Partial<VoiceViewInput>;
};

function input({ state = AT.idle, viewInput = {}, ...rest }: Case = {}): CandyHomeVoiceInput {
  return {
    view: viewOf({ state, ...viewInput }),
    state,
    shows: 'voice',
    threadStreams: false,
    hold: hold(),
    ...rest,
  };
}

describe('the caption and the line in the voice window', () => {
  it('are none while the voice is quiet', () => {
    const shown = candyHomeVoice(input());
    expect(shown.caption).toBeNull();
    expect(shown.line).toBeNull();
  });

  it("are the voice's state words in Candy's case while it works, after a typed send too", () => {
    for (const state of [AT.listening, AT.thinking, AT.speaking]) {
      const view = viewOf({ state });
      const shown = candyHomeVoice(input({ state }));
      expect(shown.caption).toEqual({ text: view.chipLabel, label: view.chipLabel });
      expect(candyHomeVoice(input({ state, shows: 'thread' })).caption).toEqual(shown.caption);
    }
    expect(candyCaption(viewOf({ state: AT.listening })).text).toBe('Listening');
  });

  it('say why a press could not start, with Open Settings, and the hint for a tap', () => {
    const denied = candyHomeVoice(input({ state: DENIED, viewInput: { permission: SETTINGS } }));
    expect(denied.line?.button).toEqual({
      label: PERMISSION_COPY.openSettings,
      action: 'openSettings',
    });
    const tapped = candyHomeVoice(input({ state: TAPPED }));
    expect(tapped.line).toEqual({ kind: 'hint', text: VOICE_MESSAGE_COPY.holdHint, button: null });
  });

  it('give way once a typed send is the newest', () => {
    const shown = candyHomeVoice(
      input({ state: DENIED, viewInput: { permission: SETTINGS }, shows: 'thread' }),
    );
    expect(shown.caption).toBeNull();
    expect(shown.line).toBeNull();
  });

  it("keep 'See it in the chat': the Chat view is a tap away", () => {
    const cards = replyOf({ hasCards: true });
    const shown = candyHomeVoice(input({ state: FINISHED, viewInput: { reply: cards } }));
    expect(shown.line).toEqual({
      kind: 'chat',
      text: null,
      button: { label: SEE_IN_CHAT, action: 'openChat' },
    });
  });

  it("never say a viewer's words (a viewer has no voice here)", () => {
    const viewer = viewOf({ roleCanChat: false });
    expect(viewer.message?.kind).toBe('viewer');
    expect(candyHomeLine(viewer)).toBeNull();
    expect(candyHomeVoice(input({ viewInput: { roleCanChat: false } })).line).toBeNull();
  });
});

describe('MIC LIVE, hold to talk and Stop', () => {
  it('MIC LIVE is the capture, never the phase (KV5)', () => {
    expect(candyHomeVoice(input({ state: AT.listening })).micOpen).toBe(true);
    expect(candyHomeVoice(input({ state: run(LISTENING.slice(0, 1)) })).micOpen).toBe(false);
    expect(candyHomeVoice(input({ state: AT.speaking })).micOpen).toBe(false);
  });

  it("hold to talk is HUD's and Arcade's: its words, its hold, its toggle", () => {
    const handlers = hold();
    const viewInput = { screenReader: true };
    const shown = candyHomeVoice(input({ state: AT.listening, viewInput, hold: handlers }));
    expect(shown.talk).toEqual(
      talkProps(viewOf({ state: AT.listening, ...viewInput }), 'listening', handlers),
    );
    expect(shown.talk.toggle).toBe(true);
    expect(shown.talk.active).toBe(true);
  });

  it('is off for a viewer, saying why (D-ROLES)', () => {
    const talk = candyHomeVoice(input({ viewInput: { roleCanChat: false } })).talk;
    expect(talk.enabled).toBe(false);
    expect(talk.hint).toBe(ROLE_COPY.viewerReadOnly);
  });

  it('Stop is on while the voice works or a typed turn streams', () => {
    expect(candyHomeVoice(input()).stopEnabled).toBe(false);
    expect(candyHomeVoice(input({ threadStreams: true })).stopEnabled).toBe(true);
    for (const state of [AT.listening, AT.thinking, AT.speaking])
      expect(candyHomeVoice(input({ state })).stopEnabled).toBe(true);
  });
});
