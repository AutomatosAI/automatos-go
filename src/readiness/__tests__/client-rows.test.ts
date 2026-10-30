// The rows this phone adds (PRD-268 §6.11.3, US-G07): push in the Notifications screen's words,
// the microphone and speech recognition in the voice screen's, the server voice from tts and its
// list. Not read is not checked; a fix is an in-app route only (Notifications, the voice screen)
// and only where the person can act on this phone. Pure: no phone, no renderer.

import { describe, expect, it, vi } from 'vitest';

import { pushScreens } from '../../push/nav';
import type { PushStatus } from '../../push/registration/state';
import { phoneStatusView, type PhoneContext } from '../../push/settings/view-model';
import { PUSH_PHONE_COPY } from '../../push/strings';
import { VOICE_SCREENS } from '../../voice/nav';
import { PERMISSION_COPY, RECOGNITION_COPY } from '../../voice/strings';
import {
  CLIENT_ROW_IDS,
  clientRows,
  microphoneRow,
  pushRow,
  serverVoiceRow,
  speechRow,
} from '../client-rows';
import { NO_CLIENT_FACTS } from '../client-facts';
import { CLIENT_ROW_COPY } from '../strings';
import { ALL_READY, ASK, GRANTED, MIC_OFF, RESTRICTED, SPEECH_OFF, speech } from './fixtures';

vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const HOSTED: PhoneContext = { source: 'hosted', serverName: 'Automatos' };
const status = (kind: Exclude<PushStatus['kind'], 'off'>): PushStatus => ({ kind }) as PushStatus;

describe('pushRow', () => {
  it('on is ready, in the Notifications screen’s words, with no fix', () => {
    expect(pushRow(status('on'), HOSTED)).toEqual({
      id: 'push',
      label: CLIENT_ROW_COPY.pushLabel,
      detail: PUSH_PHONE_COPY.on,
      state: 'ready',
      fix: null,
    });
  });

  it('no answer from the registrar yet is not checked', () => {
    expect(pushRow(null, HOSTED)).toMatchObject({
      state: 'not_checked',
      detail: CLIENT_ROW_COPY.notReadYet,
      fix: null,
    });
  });

  it.each(['ask', 'denied', 'device_limit'] as const)(
    '%s needs setup, fixed in Settings → Notifications',
    (kind) => {
      const row = pushRow(status(kind), HOSTED);
      expect(row.state).toBe('needs_setup');
      expect(row.detail).toBe(phoneStatusView(status(kind), HOSTED).sentence);
      expect(row.fix).toEqual({
        label: CLIENT_ROW_COPY.openNotifications,
        route: pushScreens.notifications,
      });
    },
  );

  it('an off push (Expo dropped the phone) is fixed in Notifications', () => {
    const off: PushStatus = { kind: 'off', reason: 'DeviceNotRegistered' };
    expect(pushRow(off, HOSTED)).toMatchObject({
      state: 'needs_setup',
      detail: PUSH_PHONE_COPY.offDeviceNotRegistered,
      fix: { route: pushScreens.notifications },
    });
  });

  it.each(['unsupported', 'operator_off', 'not_configured', 'revoked_by_admin'] as const)(
    '%s needs setup with no fix: nothing on this phone changes it',
    (kind) => {
      const row = pushRow(status(kind), HOSTED);
      expect(row.state).toBe('needs_setup');
      expect(row.fix).toBeNull();
    },
  );

  it("operator_off names the server, in push's own sentence", () => {
    expect(pushRow(status('operator_off'), HOSTED).detail).toBe(
      PUSH_PHONE_COPY.operatorOff('Automatos'),
    );
  });
});

describe('microphoneRow', () => {
  it('allowed is ready', () => {
    expect(microphoneRow(GRANTED)).toMatchObject({
      id: 'microphone',
      state: 'ready',
      detail: CLIENT_ROW_COPY.microphoneAllowed,
      fix: null,
    });
  });

  it('not asked yet needs setup: the voice screen asks on a press, never this row', () => {
    expect(microphoneRow(ASK)).toMatchObject({
      state: 'needs_setup',
      detail: CLIENT_ROW_COPY.notAskedYet,
      fix: { label: CLIENT_ROW_COPY.openVoice, route: VOICE_SCREENS.voice },
    });
  });

  it("off in the phone's Settings needs setup, in the voice screen's words", () => {
    expect(microphoneRow(MIC_OFF)).toMatchObject({
      state: 'needs_setup',
      detail: PERMISSION_COPY.micOff,
      fix: { route: VOICE_SCREENS.voice },
    });
  });

  it('not read is not checked', () => {
    expect(microphoneRow(null)).toMatchObject({ state: 'not_checked', fix: null });
  });
});

describe('speechRow', () => {
  it('a ready recognizer with the permission is ready, naming the language', () => {
    expect(speechRow(speech())).toMatchObject({
      id: 'speech',
      state: 'ready',
      detail: CLIENT_ROW_COPY.speechReady('English'),
      fix: null,
    });
  });

  it('names Portuguese (Brazil) when "I speak" chose it', () => {
    expect(speechRow(speech({ locale: 'pt-BR' })).detail).toBe(
      CLIENT_ROW_COPY.speechReady('Portuguese (Brazil)'),
    );
  });

  it("speech recognition off in the phone's Settings comes first", () => {
    const row = speechRow(
      speech({ verdict: SPEECH_OFF, policy: { kind: 'download', locale: 'en-GB' } }),
    );
    expect(row).toMatchObject({ state: 'needs_setup', detail: PERMISSION_COPY.speechOff });
  });

  it('Screen Time restrictions need setup with no fix', () => {
    expect(speechRow(speech({ verdict: RESTRICTED }))).toMatchObject({
      state: 'needs_setup',
      detail: PERMISSION_COPY.restricted,
      fix: null,
    });
  });

  it('a model to download is fixed on the voice screen, which offers it', () => {
    const row = speechRow(speech({ policy: { kind: 'download', locale: 'en-GB' } }));
    expect(row).toMatchObject({
      state: 'needs_setup',
      detail: RECOGNITION_COPY.download('English'),
      fix: { route: VOICE_SCREENS.voice },
    });
  });

  it('no recognizer on this phone needs setup with no fix', () => {
    const row = speechRow(speech({ policy: { kind: 'unavailable', reason: 'no-recognizer' } }));
    expect(row).toMatchObject({
      state: 'needs_setup',
      detail: RECOGNITION_COPY.notOnPhone('English'),
      fix: null,
    });
  });

  it('a permission not asked yet needs setup once the recognizer is ready', () => {
    expect(speechRow(speech({ verdict: ASK }))).toMatchObject({
      state: 'needs_setup',
      detail: CLIENT_ROW_COPY.notAskedYet,
      fix: { route: VOICE_SCREENS.voice },
    });
  });

  it('not read is not checked', () => {
    expect(speechRow(null)).toMatchObject({ state: 'not_checked' });
  });
});

describe('serverVoiceRow', () => {
  it.each([
    ['speaks', 'ready', CLIENT_ROW_COPY.serverVoiceOn],
    ['phone_chosen', 'ready', CLIENT_ROW_COPY.serverVoicePhoneChosen],
    ['off', 'needs_setup', CLIENT_ROW_COPY.serverVoiceOff],
    ['unanswered', 'not_checked', CLIENT_ROW_COPY.serverVoiceUnanswered],
  ] as const)('%s → %s', (fact, state, detail) => {
    expect(serverVoiceRow(fact)).toEqual({
      id: 'server_voice',
      label: CLIENT_ROW_COPY.serverVoiceLabel,
      detail,
      state,
      fix: null,
    });
  });

  it('not read is not checked', () => {
    expect(serverVoiceRow(null).state).toBe('not_checked');
  });
});

describe('clientRows', () => {
  it('every row, in order, frozen', () => {
    const rows = clientRows(ALL_READY, HOSTED);
    expect(rows.map((row) => row.id)).toEqual([...CLIENT_ROW_IDS]);
    expect(rows.every((row) => row.state === 'ready')).toBe(true);
    expect(Object.isFrozen(rows)).toBe(true);
    expect(rows.every((row) => Object.isFrozen(row))).toBe(true);
  });

  it('nothing read yet: every row not checked', () => {
    const rows = clientRows(NO_CLIENT_FACTS, HOSTED);
    expect(rows.every((row) => row.state === 'not_checked')).toBe(true);
  });

  it('every fix is an app route, never an outside URL', () => {
    const rows = clientRows(
      {
        push: status('ask'),
        microphone: ASK,
        speech: speech({ verdict: ASK }),
        serverVoice: 'off',
      },
      HOSTED,
    );
    for (const row of rows) {
      if (row.fix) expect(row.fix.route).toMatch(/^\/[a-z]/);
    }
  });
});
