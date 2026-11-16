// The phone's own voice in words, where the platforms differ (claims audit, 16 Nov). This is the
// iPhone's (and what node's tests read): every voice the app picks there is Apple's, on the phone
// (src/voice/speech/voice-pick.ts). Metro takes voice-copy.android.ts on Android, where the app
// picks only voices named as local and, when the engine names none, the engine speaks with its own
// default voice, which may not be on the phone. Both keep this one shape; strings.ts builds
// Settings → Voice from it.

export type PhoneVoiceCopy = Readonly<{
  /** Settings → Voice's line under its title when the server has no voice of its own. */
  lede: string;
}>;

export const PHONE_VOICE_COPY: PhoneVoiceCopy = Object.freeze({
  lede: 'How Auto sounds when it answers you out loud. It uses the voices on this phone.',
});
