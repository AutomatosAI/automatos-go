// What keeps HOLD TO TALK from working, as the voice screen says it (US-019i, KV4, US-019c):
// on-device recognition missing (VOICE UNAVAILABLE and the reason, by the phone's language), the
// download offer, each permission step (MIC OFF and Open Settings), and the recognizer's own
// failures. A press re-checks, so HOLD TO TALK stays on, except on a phone too old for on-device
// recognition.

import { describe, expect, it } from 'vitest';

import type { VoiceEvent } from '../machine/voice-reducer';
import type { UnavailableReason } from '../machine/voice-state';
import type { PermissionVerdict } from '../permissions/permission-flow';
import type { RecognitionPolicy } from '../quick-ask/recognition-policy';
import {
  PERMISSION_COPY,
  RECOGNITION_COPY,
  VOICE_CHIP,
  VOICE_ERROR_COPY,
  VOICE_MESSAGE_COPY,
} from '../strings';
import { AT, LISTENING, run } from './voice-fixtures';
import { view } from './voice-view-fixtures';

const refused = (reason: UnavailableReason) => run([{ type: 'unavailable', reason }]);

const verdict = (
  step: PermissionVerdict['step'],
  blocked: PermissionVerdict['blocked'] = null,
  asked = false,
): PermissionVerdict => Object.freeze({ step, blocked, asked });

describe('on the phone or not at all (KV4)', () => {
  it('no on-device recognizer or language: VOICE UNAVAILABLE, the reason, typing stays', () => {
    const reasons: readonly UnavailableReason[] = [
      'no-on-device',
      'language-missing',
      'no-recognizer',
    ];
    reasons.forEach((reason) => {
      const at = view({ state: refused(reason), policy: { kind: 'unavailable', reason } });
      expect(at).toMatchObject({
        chipWords: VOICE_CHIP.unavailable.words,
        chipLabel: VOICE_CHIP.unavailable.label,
        centre: { enabled: true },
        type: { enabled: true },
        stop: { enabled: false },
        message: {
          kind: 'unavailable',
          text: RECOGNITION_COPY.notOnPhone('English'),
          action: null,
        },
      });
    });
  });

  it("names the phone's language", () => {
    const at = view({ state: refused('no-on-device'), locale: 'fr-FR' });
    expect(at.message?.text).toBe(RECOGNITION_COPY.notOnPhone('French'));
  });

  it('Android 12 or older: HOLD TO TALK off for good, the reason as its hint', () => {
    const tooOld = RECOGNITION_COPY.androidTooOld('English');
    const policy: RecognitionPolicy = { kind: 'unavailable', reason: 'android-too-old' };
    const at = view({ state: refused('android-too-old'), policy });
    expect(at).toMatchObject({
      chipWords: 'VOICE UNAVAILABLE',
      centre: { enabled: false, hint: tooOld },
      type: { enabled: true },
      message: { kind: 'unavailable', text: tooOld },
    });
    // The policy alone (the refused press came while Auto spoke, and he has finished since).
    expect(view({ policy }).centre.enabled).toBe(false);
  });

  it('a language to download: the offer with its button, and the press stays on', () => {
    const at = view({ policy: { kind: 'download', locale: 'de-DE' } });
    expect(at).toMatchObject({
      chipWords: 'VOICE UNAVAILABLE',
      centre: { enabled: true, label: 'HOLD TO TALK' },
      message: { kind: 'download', text: RECOGNITION_COPY.download('German'), action: 'download' },
    });
  });

  it('a refused press during a reply leaves the reply its words until it ends', () => {
    const policy: RecognitionPolicy = { kind: 'unavailable', reason: 'no-on-device' };
    const speaking = view({ state: AT.speaking, policy });
    expect(speaking).toMatchObject({ chipWords: 'SPEAKING', message: null });
    const done = run([{ type: 'turn_finished' }, { type: 'speak_done' }], AT.speaking);
    expect(view({ state: done, policy }).chipWords).toBe('VOICE UNAVAILABLE');
  });
});

describe('the permission steps (US-019c)', () => {
  it("'ask' is not a block: the press asks, nothing shows before it", () => {
    const at = view({ permission: verdict('ask') });
    expect(at).toMatchObject({ chipWords: 'READY', message: null });
  });

  it("asked and granted: 'Ready. Hold to talk.' (the prompt took that hold)", () => {
    const state = run([{ type: 'permission', step: 'granted' }]);
    const at = view({ state, permission: verdict('granted', null, true) });
    expect(at).toMatchObject({ chipWords: 'READY', mic: 'off', centre: { enabled: true } });
    expect(at.message).toEqual({ kind: 'hint', text: VOICE_MESSAGE_COPY.ready, action: null });
  });

  it('the microphone off in Settings: MIC OFF, its words and Open Settings', () => {
    const state = run([{ type: 'permission', step: 'settings' }]);
    const at = view({ state, permission: verdict('settings', 'microphone') });
    expect(at).toMatchObject({
      chipWords: VOICE_CHIP.micOff.words,
      chipLabel: VOICE_CHIP.micOff.label,
      centre: { enabled: true },
      message: { kind: 'permission', text: PERMISSION_COPY.micOff, action: 'openSettings' },
    });
  });

  it('speech recognition off (iOS) names speech recognition', () => {
    const state = run([{ type: 'permission', step: 'settings' }]);
    const at = view({ state, permission: verdict('settings', 'speech') });
    expect(at.message?.text).toBe(PERMISSION_COPY.speechOff);
  });

  it('restricted by Screen Time: MIC OFF and its words, no button the app can offer', () => {
    const state = run([{ type: 'permission', step: 'restricted' }]);
    const at = view({ state, permission: verdict('restricted') });
    expect(at).toMatchObject({
      chipWords: 'MIC OFF',
      message: { kind: 'permission', text: PERMISSION_COPY.restricted, action: null },
    });
  });

  it("the recognizer's own refusal after a granted press says the microphone", () => {
    const state = run([...LISTENING, { type: 'permission', step: 'settings' }]);
    expect(view({ state }).message).toMatchObject({
      text: PERMISSION_COPY.micOff,
      action: 'openSettings',
    });
  });

  it('a read-only check at mount that finds it off shows MIC OFF before any press', () => {
    const at = view({ permission: verdict('settings', 'microphone'), policy: null });
    expect(at).toMatchObject({ chipWords: 'MIC OFF', message: { action: 'openSettings' } });
  });

  it('a blocked permission is said before the language (the press stops at the permission)', () => {
    const permission = verdict('settings', 'microphone');
    const at = view({ permission, policy: { kind: 'download', locale: 'en-GB' } });
    expect(at.message?.kind).toBe('permission');
  });
});

describe("the recognizer's failures (US-019b)", () => {
  it('ERROR with its words; the next hold may try again', () => {
    const kinds = ['mic-busy', 'busy', 'recognizer'] as const;
    kinds.forEach((kind) => {
      const event: VoiceEvent = { type: 'error', kind };
      const at = view({ state: run([...LISTENING, event]) });
      expect(at).toMatchObject({
        chipWords: 'ERROR',
        centre: { enabled: true, label: 'HOLD TO TALK' },
        stop: { enabled: false },
        message: { kind: 'error', text: VOICE_ERROR_COPY[kind], action: null },
      });
    });
  });
});
