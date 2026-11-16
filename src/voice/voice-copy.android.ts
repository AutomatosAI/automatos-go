// The phone's own voice in words on Android (voice-copy.ts has the iPhone's and the one shape): the
// app picks a voice on the phone where the speech engine names one, and otherwise passes none, so
// the engine speaks with its own default voice (src/voice/speech/voice-pick.ts usable, pickVoice).

import type { PhoneVoiceCopy } from './voice-copy';

export const PHONE_VOICE_COPY: PhoneVoiceCopy = Object.freeze({
  lede: "How Auto sounds when it answers you out loud. It uses a voice on this phone when it finds one, otherwise your speech engine's default voice.",
});
