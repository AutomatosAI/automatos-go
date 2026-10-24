// The voice screen on A5's core (US-019j), pure: the view-model's words as HudCore's props — Auto's
// state per phase, the transcript with the AI notice as its own line, HOLD TO TALK's words, hold
// and toggle, the waveform's run of levels, the dress's paint, and the line under the chip. Views
// come from the real reducer and voiceView (voice-view-fixtures.ts), styles from A5's resolveStyle.

import { describe, expect, it, vi } from 'vitest';

import { EMBER } from '../../core/web/lib/looks/presets';
import { HUD_DEFAULT_LOOK } from '../../styles/hud/look-schema';
import { resolveStyle, type StyleInput } from '../../styles/provider/resolve';
import { builtinChoice, type StyleChoice } from '../../styles/registry/style-id';
import { WAVEFORM_BARS } from '../config';
import { noticeText } from '../notice/ai-notice';
import {
  centreText,
  nextLevels,
  phaseMascot,
  talkProps,
  toggleStep,
  voiceChip,
  voiceCoreProps,
  voiceLine,
  voiceTurn,
  type HoldHandlers,
} from '../screen/core-props';
import { voiceDress } from '../screen/dress';
import {
  DOWNLOAD_ACTION,
  PERMISSION_COPY,
  SEE_IN_CHAT,
  VOICE_CENTRE_COPY,
  VOICE_SCREEN_COPY,
} from '../strings';
import { AT, PHASES, run, THINKING } from './voice-fixtures';
import { reply, view } from './voice-view-fixtures';

function resolve(choice: StyleChoice, overrides: Partial<StyleInput> = {}) {
  return resolveStyle({
    choice,
    studioScheme: 'light',
    systemScheme: 'light',
    playLook: EMBER,
    hudLook: HUD_DEFAULT_LOOK,
    themePaint: null,
    reduceMotion: false,
    ...overrides,
  });
}

function handlers(): HoldHandlers {
  return { onPressIn: vi.fn(), onPressOut: vi.fn(), onToggle: vi.fn() };
}

describe('phaseMascot', () => {
  it('shows Auto what the voice is doing', () => {
    expect(PHASES.map((phase) => phaseMascot(AT[phase]))).toEqual([
      'idle',
      'listening',
      'thinking',
      'idle',
      'oops',
    ]);
  });

  it('works while a tool runs', () => {
    const tool = run([
      ...THINKING.slice(0, 6),
      { type: 'turn_tool', caption: 'Searching the web' },
    ]);
    expect(tool.phase).toBe('thinking');
    expect(phaseMascot(tool)).toBe('working');
  });
});

describe('voiceTurn', () => {
  it('is empty before any words: the transcript shows its hint and the AI label', () => {
    expect(voiceTurn(view(), null)).toEqual({
      you: null,
      auto: null,
      streaming: false,
      agent: null,
    });
  });

  it('puts the AI notice on its own line above Auto’s words, once per session (KV7)', () => {
    const at = view({ state: AT.thinking });
    const turn = voiceTurn(at, null);
    expect(turn.you).toBe('what is on today?');
    expect(turn.auto).toBe(`${noticeText(null)}\nYou have two meetings.`);
    expect(turn.streaming).toBe(true);
  });

  it('shows the notice alone before Auto’s words arrive', () => {
    const sent = run([...THINKING.slice(0, 6)]);
    expect(voiceTurn(view({ state: sent }), null).auto).toBe(noticeText(null));
  });

  it('names the answering agent for the AI label and the notice', () => {
    const named = reply({ agentName: 'Researcher' });
    const turn = voiceTurn(view({ state: AT.speaking, reply: named }), named);
    expect(turn.agent).toEqual({ name: 'Researcher' });
    expect(turn.auto?.startsWith(noticeText({ name: 'Researcher' }))).toBe(true);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(voiceTurn(view({ state: AT.thinking }), null))).toBe(true);
  });
});

describe('HOLD TO TALK', () => {
  it('breaks its words after the first, as A5 draws them in the circle', () => {
    expect(centreText(VOICE_CENTRE_COPY.hold.talk.label)).toBe('HOLD\nTO TALK');
    expect(centreText(VOICE_CENTRE_COPY.hold.send.label)).toBe('RELEASE\nTO SEND');
    expect(centreText(VOICE_CENTRE_COPY.toggle.talk.label)).toBe('TAP\nTO TALK');
    expect(centreText('ONE')).toBe('ONE');
  });

  it('holds: the press in talks, the press out sends; lit while the mic is held', () => {
    const hold = handlers();
    const idle = talkProps(view(), 'idle', hold);
    expect(idle).toMatchObject({
      text: 'HOLD\nTO TALK',
      label: VOICE_CENTRE_COPY.hold.talk.spoken,
      hint: VOICE_CENTRE_COPY.hold.talk.hint,
      enabled: true,
      active: false,
      toggle: false,
    });
    idle.onPressIn();
    idle.onPressOut();
    expect(hold.onPressIn).toHaveBeenCalledOnce();
    expect(hold.onPressOut).toHaveBeenCalledOnce();
    const held = talkProps(view({ state: AT.listening }), 'listening', hold);
    expect(held).toMatchObject({ text: 'RELEASE\nTO SEND', active: true });
  });

  it('toggles under a screen reader: talk, then send (KV5)', () => {
    const idle = talkProps(view({ screenReader: true }), 'idle', handlers());
    expect(idle).toMatchObject({ toggle: true, label: VOICE_CENTRE_COPY.toggle.talk.spoken });
    expect(toggleStep('idle')).toBe('press');
    expect(toggleStep('speaking')).toBe('press');
    expect(toggleStep('listening')).toBe('release');
  });

  it('is off for a viewer, with the reason as its hint (D17)', () => {
    const viewer = talkProps(view({ roleCanChat: false }), 'idle', handlers());
    expect(viewer.enabled).toBe(false);
    expect(viewer.hint).toBe(view({ roleCanChat: false }).centre.hint);
  });

  it('never waits on the AI label (D73): no input names it', () => {
    expect(Object.keys(talkProps(view(), 'idle', handlers()))).not.toContain('aiLabel');
  });
});

describe('nextLevels (the waveform while the mic is open)', () => {
  it('is null while the mic is closed: the idle shimmer', () => {
    expect(nextLevels(null, null)).toBeNull();
    expect(nextLevels([0.4, 0.5], null)).toBeNull();
  });

  it('appends the newest level last, held to 0-1', () => {
    expect(nextLevels(null, 0.3)).toEqual([0.3]);
    expect(nextLevels([0.3], 2)).toEqual([0.3, 1]);
    expect(nextLevels([0.3], -1)).toEqual([0.3, 0]);
    expect(nextLevels([0.3], Number.NaN)).toEqual([0.3, 0]);
  });

  it('keeps as many as A5’s phone waveform has bars, dropping the oldest', () => {
    let levels: readonly number[] | null = null;
    for (let index = 0; index < WAVEFORM_BARS + 5; index += 1)
      levels = nextLevels(levels, index / 100);
    expect(levels).toHaveLength(WAVEFORM_BARS);
    expect(levels?.[0]).toBe(5 / 100);
    expect(levels?.[WAVEFORM_BARS - 1]).toBe((WAVEFORM_BARS + 4) / 100);
  });

  it('never mutates the run it is given', () => {
    const before = Object.freeze([0.1, 0.2]);
    const after = nextLevels(before, 0.3);
    expect(before).toEqual([0.1, 0.2]);
    expect(Object.isFrozen(after)).toBe(true);
  });
});

describe('voiceCoreProps', () => {
  const hold = handlers();

  it('paints Studio in ink and orange, with no HUD overlay and no Auto', () => {
    const style = resolve(builtinChoice('studio'));
    const props = voiceCoreProps({ view: view(), phase: 'idle', dress: voiceDress(style), hold });
    expect(props.ringLine).toBe(style.tokens.colours.foreground);
    expect(props.overlay).toBe(false);
    expect(props.mascotInCore).toBe(false);
  });

  it('puts Auto in Play’s core and HUD’s overlay on HUD', () => {
    const play = voiceDress(resolve(builtinChoice('play')));
    const hud = voiceDress(resolve(builtinChoice('hud')));
    expect(voiceCoreProps({ view: view(), phase: 'idle', dress: play, hold }).mascotInCore).toBe(
      true,
    );
    expect(voiceCoreProps({ view: view(), phase: 'idle', dress: hud, hold }).overlay).toBe(true);
  });

  it('carries the view’s words and switches, and names the close and LOOK', () => {
    const dress = voiceDress(resolve(builtinChoice('hud')));
    const speaking = view({ state: AT.speaking });
    const props = voiceCoreProps({ view: speaking, phase: 'speaking', dress, hold });
    expect(props.chip).toEqual(voiceChip(speaking));
    expect(props.chip).toEqual({ text: speaking.chipWords, label: speaking.chipLabel });
    expect(props.stopEnabled).toBe(true);
    expect(props.typeEnabled).toBe(true);
    expect(props.menuLabel).toBe(VOICE_SCREEN_COPY.close);
    expect(props.lookHint).toBe(VOICE_SCREEN_COPY.lookHint);
    const idle = voiceCoreProps({ view: view(), phase: 'idle', dress, hold });
    expect(idle.stopEnabled).toBe(false);
  });

  it('turns TYPE off for a viewer', () => {
    const dress = voiceDress(resolve(builtinChoice('studio')));
    const viewer = voiceCoreProps({
      view: view({ roleCanChat: false }),
      phase: 'idle',
      dress,
      hold,
    });
    expect(viewer.typeEnabled).toBe(false);
    expect(viewer.talk.enabled).toBe(false);
  });
});

describe('voiceLine (under the chip)', () => {
  it('is nothing without a message', () => {
    expect(voiceLine(null)).toBeNull();
  });

  it('is the words alone for a hint', () => {
    expect(
      voiceLine({ kind: 'hint', text: 'Hold the button while you talk.', action: null }),
    ).toEqual({
      kind: 'hint',
      text: 'Hold the button while you talk.',
      button: null,
    });
  });

  it('offers Open Settings and Download under their words', () => {
    const settings = voiceLine({ kind: 'permission', text: 'Mic off.', action: 'openSettings' });
    expect(settings?.button).toEqual({
      label: PERMISSION_COPY.openSettings,
      action: 'openSettings',
    });
    expect(settings?.text).toBe('Mic off.');
    const download = voiceLine({ kind: 'download', text: 'Get it.', action: 'download' });
    expect(download?.button).toEqual({ label: DOWNLOAD_ACTION, action: 'download' });
  });

  it("is the button alone for 'See it in the chat'", () => {
    expect(voiceLine({ kind: 'chat', text: SEE_IN_CHAT, action: 'openChat' })).toEqual({
      kind: 'chat',
      text: null,
      button: { label: SEE_IN_CHAT, action: 'openChat' },
    });
  });
});
