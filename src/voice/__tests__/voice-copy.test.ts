// The phone's own voice in words (voice-copy.ts, voice-copy.android.ts; claims audit, 16 Nov): the
// iPhone keeps "It uses the voices on this phone." (every voice picked there is Apple's, on the
// phone), and on Android, where the engine's default voice speaks when no voice on the phone is
// named (voice-pick.ts), Settings → Voice never says it uses only this phone's voices. Metro picks
// the Android file by platform; here strings.ts is loaded again with it in voice-copy's place.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { pickVoice, type SpeechVoice } from '../speech/voice-pick';
import { VOICE_SETTINGS_COPY } from '../strings';
import { PHONE_VOICE_COPY as IOS } from '../voice-copy';
import { PHONE_VOICE_COPY as ANDROID } from '../voice-copy.android';

const NETWORK_ONLY: readonly SpeechVoice[] = [
  {
    identifier: 'en-gb-x-gba-network',
    name: 'en-gb-x-gba-network',
    quality: 'Enhanced',
    language: 'en-GB',
  },
];

afterEach(() => {
  vi.doUnmock('../voice-copy');
  vi.resetModules();
});

describe("Settings → Voice's line on the phone's voice", () => {
  it('on the iPhone says it uses the voices on this phone, as before', () => {
    expect(IOS.lede).toBe(
      'How Auto sounds when it answers you out loud. It uses the voices on this phone.',
    );
    expect(VOICE_SETTINGS_COPY.lede).toBe(IOS.lede);
  });

  it("on Android names the engine's default voice, because none on the phone may be found", async () => {
    expect(pickVoice(NETWORK_ONLY, 'en-GB', 'android')).toBeUndefined();
    expect(ANDROID.lede).not.toContain('the voices on this phone');
    expect(ANDROID.lede).toContain("your speech engine's default voice");
    vi.resetModules();
    vi.doMock('../voice-copy', () => import('../voice-copy.android'));
    const { VOICE_SETTINGS_COPY: android } = await import('../strings');
    expect(android.lede).toBe(ANDROID.lede);
  });
});
