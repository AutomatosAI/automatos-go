// The SEAM EDITs in A5's core model (US-019j, KV2): additive. Without A6's arguments voiceButtons is
// hudButtons and statusRow says Auto's state's word, exactly as A5 built them (A5's own tests run
// unchanged); with them, HOLD TO TALK takes the voice's words and state, TYPE may be off, and the
// status row says the voice screen's word.

import { describe, expect, it, vi } from 'vitest';

import {
  EMPTY_TURN,
  hudButtons,
  statusRow,
  voiceButtons,
  type HudTalk,
} from '../../styles/hud/core/model';
import { HUD_STATE_WORDS } from '../../styles/strings';

const NOW = 1_700_000_000_000;

function talk(changes: Partial<HudTalk> = {}): HudTalk {
  return {
    text: 'HOLD\nTO TALK',
    label: 'Hold to talk',
    hint: 'Hold while you talk, then let go to send.',
    enabled: true,
    active: false,
    toggle: false,
    onPressIn: vi.fn(),
    onPressOut: vi.fn(),
    onToggle: vi.fn(),
    ...changes,
  };
}

describe('voiceButtons', () => {
  it('is hudButtons without the voice: HOLD TO TALK inert, TYPE on', () => {
    [true, false].forEach((streaming) =>
      expect(voiceButtons(streaming)).toEqual(hudButtons(streaming)),
    );
    expect(voiceButtons(false).talk.disabled).toBe(true);
  });

  it('gives HOLD TO TALK the voice’s words and state', () => {
    const view = voiceButtons(false, talk());
    expect(view.talk).toEqual({
      text: 'HOLD\nTO TALK',
      label: 'Hold to talk',
      hint: 'Hold while you talk, then let go to send.',
      disabled: false,
    });
    expect(voiceButtons(false, talk({ enabled: false })).talk.disabled).toBe(true);
  });

  it('turns TYPE off only when told, and leaves STOP to the streaming flag', () => {
    expect(voiceButtons(false, talk(), false).type.disabled).toBe(true);
    expect(voiceButtons(false, talk(), true).type.disabled).toBe(false);
    expect(voiceButtons(true, talk()).stop.disabled).toBe(false);
    expect(voiceButtons(false, talk()).stop).toEqual(hudButtons(false).stop);
  });
});

describe('statusRow', () => {
  it('says Auto’s state’s word without one of its own', () => {
    expect(statusRow(EMPTY_TURN, 'listening', NOW).text).toBe(
      `AUTO · ${HUD_STATE_WORDS.listening.toUpperCase()}`,
    );
  });

  it('says the voice screen’s word when given one', () => {
    const view = statusRow(EMPTY_TURN, 'idle', NOW, 'Speaking');
    expect(view.text).toBe('AUTO · SPEAKING');
    expect(view.label).toBe('Auto, speaking, 00:00');
  });
});
