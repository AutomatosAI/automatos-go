// The phone's text to speech (US-019d): createSpeaker (speaker-core.ts, where the queue and the
// callbacks' folding live) bound to expo-speech. The only file that imports expo-speech (KV15). Thin
// on purpose: the module's functions and Platform, nothing decided here.
//   Every utterance is spoken by the phone's own engine (AVSpeechSynthesizer; Android's
//   TextToSpeech) in a voice voiceFor() picked from the phone's list. iOS speaks with
//   useApplicationAudioSession: false (KV6): the system manages speech's own audio session after
//   recognition left the app's session in playAndRecord (owner check OT-V3).

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import { createSpeaker, type SpeechPort } from './speaker-core';

const port: SpeechPort = {
  speak: (text, request) => Speech.speak(text, request),
  stop: () => Speech.stop(),
  getVoices: () => Speech.getAvailableVoicesAsync(),
  maxInputLength: Speech.maxSpeechInputLength,
};

export const speaker = createSpeaker(port, Platform.OS === 'android' ? 'android' : 'ios');
