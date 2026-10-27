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

/** expo-speech's pitch: 1 is the voice's own. */
export const SPEECH_PITCH = 1;

/** Settings → Voice's Speed slider: around the voice's normal speed, in steps of 0.05. */
export const SPEECH_RATE_LIMITS = Object.freeze({ min: 0.8, max: 1.2, step: 0.05 });

/** Settings → Voice's Pitch slider: around the voice's own pitch, in steps of 0.05. */
export const SPEECH_PITCH_LIMITS = Object.freeze({ min: 0.8, max: 1.2, step: 0.05 });

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

/** "I speak" English on a phone that is not in English: British English (Settings → Voice). */
export const ENGLISH_FALLBACK_LOCALE = 'en-GB';

/**
 * Auto's server voice (POST /api/voice/speech): how long a sentence that is due (nothing playing
 * before it) may keep the person waiting for its MP3 before this phone's voice speaks it and the
 * rest of the turn. A sentence fetched ahead while the one before it plays starts its wait only
 * when it falls due, so a long sentence's playback covers the next one's synthesis.
 */
export const SERVER_VOICE_WAIT_MS = 4_000;

/** One speech request, status and body, gives up after this long, wherever it is in the queue. */
export const SERVER_SPEECH_TIMEOUT_MS = 20_000;

/** The server takes 1 to 500 characters per request: a longer sentence goes in pieces. */
export const SERVER_SPEECH_MAX_CHARS = 500;

/** An MP3 larger than this is refused (500 characters of speech is well under 1 MB). */
export const SERVER_VOICE_MAX_BYTES = 4 * 1024 * 1024;

/** A file handed to the player that has not started playing by then is a play error. */
export const SERVER_PLAY_START_MS = 3_000;

/** A playing file that has not ended this long after its duration has stalled. */
export const SERVER_PLAY_END_SLACK_MS = 3_000;

/** The end watchdog when the player reports no duration. */
export const SERVER_PLAY_MAX_MS = 60_000;
