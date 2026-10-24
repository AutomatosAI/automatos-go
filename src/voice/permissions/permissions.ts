// The phone's microphone and speech recognition permissions (US-019c): createPermissionGate
// (permission-flow.ts, where the rules live) bound to ExpoSpeechRecognitionModule, and Settings. One
// of the two files that import expo-speech-recognition (KV15; recognizer.ts is the other). Thin on
// purpose: the module's functions and Platform, nothing decided here.
//   read: the microphone (getMicrophonePermissionsAsync) and, for quick-ask on iOS, speech
//   recognition (getSpeechRecognizerPermissionsAsync, with Screen Time's restricted) apart: the
//   combined getPermissionsAsync folds both into one status (EXSpeechRecognitionPermissionRequester
//   .swift:30-38) and the notice names the one that is off. On Android the combined read is the
//   microphone's RECORD_AUDIO, the same answer.
//   ask: quick-ask → requestPermissionsAsync (iOS: the speech recognition prompt, then the
//   microphone's, which shows only when speech was allowed: EXSpeechRecognitionPermissionRequester
//   .swift:13-21; Android: RECORD_AUDIO); Live → requestMicrophonePermissionsAsync.
// Only press() asks, and only a press handler calls it (HOLD TO TALK, LIVE); check() never prompts.
// The usage strings are the foundation's (app.json): never edited here.

import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Linking, Platform } from 'react-native';

import { logger } from '../../lib/logger';
import type { RecognitionPlatform } from '../quick-ask/recognition-policy';
import {
  createPermissionGate,
  needsSpeech,
  type PermissionPort,
  type PermissionPurpose,
  type PermissionReading,
} from './permission-flow';

/** This phone: Android, else iOS (the app ships for nothing else). */
function platform(): RecognitionPlatform {
  return Platform.OS === 'android' ? 'android' : 'ios';
}

async function read(purpose: PermissionPurpose): Promise<PermissionReading> {
  if (!needsSpeech(purpose, platform()))
    return { mic: await ExpoSpeechRecognitionModule.getMicrophonePermissionsAsync() };
  const [mic, speech] = await Promise.all([
    ExpoSpeechRecognitionModule.getMicrophonePermissionsAsync(),
    ExpoSpeechRecognitionModule.getSpeechRecognizerPermissionsAsync(),
  ]);
  return { mic, speech };
}

function ask(purpose: PermissionPurpose): Promise<unknown> {
  return purpose === 'quick-ask'
    ? ExpoSpeechRecognitionModule.requestPermissionsAsync()
    : ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
}

const port: PermissionPort = { platform, read, ask };

const gate = createPermissionGate(port);

/** The app's page in the phone's Settings, where a denied permission is turned back on. */
function openSettings(): void {
  Linking.openSettings().catch((error: unknown) => {
    logger.warn('[voice] Settings did not open', error);
  });
}

export const permissions = Object.freeze({
  check: gate.check,
  press: gate.press,
  openSettings,
});
