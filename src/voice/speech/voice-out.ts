// The one voice out (27 Oct 2026): createReplyVoice (reply-voice.ts) over the phone's speaker
// (speaker.ts, expo-speech) and Auto's server voice (server/server-voice.ts, expo-audio). Quick-ask
// and Settings → Voice speak, stop and listen only through it, so one listener stack covers both
// voices (a screen that takes it covers the voice screen beneath, P001V-RVW-2). Only wiring.

import { createServerVoice } from '../server/server-voice';
import { createReplyVoice } from './reply-voice';
import { speaker } from './speaker';

export const voiceOut = createReplyVoice({ phone: speaker, server: createServerVoice });
