// The voice wave's numbers (A6, US-019a): one place for every threshold quick-ask, the voice screen
// and (phase 2) Auto Live read. Pure: no React, React Native or Expo.

/** A hold shorter than this is a tap: 'Hold the button while you talk' (KV5). */
export const HOLD_MIN_MS = 300;

/** Listening stops itself after this long, as if the button were released (KV5). */
export const HOLD_MAX_MS = 60_000;

/**
 * After a release, the recognizer has this long to say its final; then it is aborted and the hold
 * ends with nothing sent, so HOLD TO TALK is never left dead (P001V-RVW-1). On-device recognition
 * finishes well inside it once the audio ends.
 */
export const RELEASE_SETTLE_MS = 5_000;

/**
 * The server's in-call reminder interval (orchestrator config VOICE_AI_REMINDER_MINUTES, 10 min;
 * modules/voice/ai_notice.py), named for reference only: quick-ask speaks the AI notice once per
 * voice session and never repeats it (KV7, D73).
 */
export const AI_NOTICE_INTERVAL_MS = 600_000;

/** Dead air after the user stops before Live admits Auto is thinking (web orb-state.ts; phase 2). */
export const THINKING_AFTER_MS = 700;

/** expo-speech-recognition's volumechange value runs from -2 (silence) to 10 (loud). */
export const VOLUME_MIN = -2;
export const VOLUME_MAX = 10;

/** expo-speech's rate: 1 is the voice's normal speed. */
export const SPEECH_RATE = 1;

/** Said as the whole utterance during a hold, these act as STOP and send nothing (KV5). */
export const STOP_PHRASES: readonly string[] = Object.freeze([
  'stop',
  'auto stop',
  'stop auto',
  'stop it',
  'cancel',
]);

/** A5's phone waveform (src/styles/hud/core/waveform.ts WAVE.phone.bars). */
export const WAVEFORM_BARS = 44;

/** expo-speech-recognition's volumechange interval (its iOS default), for the waveform's level. */
export const VOLUME_INTERVAL_MS = 100;

/**
 * Android 13 (API 33): the first release where the module creates the on-device recognizer
 * (SpeechRecognizer.createOnDeviceSpeechRecognizer, ExpoSpeechService.kt:93-109). Below it, hold to
 * talk is unavailable: the phone's default recognition service may send the audio to Google (KV4).
 */
export const ANDROID_ON_DEVICE_API = 33;

/** The recognition and speech language when the phone reports no locale (KV4). */
export const FALLBACK_LOCALE = 'en-US';
