// What the app knows about this phone for "What Auto depends on" (PRD-268 §6.11.3: push, the
// microphone, speech recognition and the server voice are the client's rows; the server never
// claims them), read through ports so the reading is tested without a phone. Read only: the
// permissions are checked, never asked (only a press asks, src/voice/permissions); the push
// registrar's last answer is read, never run; the server's voices are read through voice's own
// cache. A read that fails or does not answer within CLIENT_READ_TIMEOUT_MS is null, and its row
// says not checked. client-ports.ts binds the ports to the app; nothing here imports a native module.

import { logger } from '../lib/logger';
import type { PushStatus } from '../push/registration/state';
import type { PermissionPurpose, PermissionVerdict } from '../voice/permissions/permission-flow';
import type { RecognitionPolicy } from '../voice/quick-ask/recognition-policy';
import type { VoiceSource } from '../voice/settings/voice-setting';

/** How long one of this phone's reads may take before its row says not checked. */
export const CLIENT_READ_TIMEOUT_MS = 5_000;

/** Speech recognition for the language hold to talk listens in ("I speak"). */
export type SpeechFacts = Readonly<{
  verdict: PermissionVerdict;
  policy: RecognitionPolicy;
  locale: string;
}>;

/**
 * The server voice: none (the server lists no tts), its list did not load, or it loaded and Auto
 * speaks with it ('speaks') or the person chose the phone's voice in Settings → Voice.
 */
export type ServerVoiceFact = 'off' | 'unanswered' | 'speaks' | 'phone_chosen';

export type ClientFacts = Readonly<{
  /** src/push/registration/state.ts's status; null before the registrar has answered. */
  push: PushStatus | null;
  /** The microphone alone (the 'live' purpose's read). */
  microphone: PermissionVerdict | null;
  speech: SpeechFacts | null;
  serverVoice: ServerVoiceFact | null;
}>;

export type ClientPorts = Readonly<{
  pushStatus: () => PushStatus | null;
  /** permissions.check: reads, never prompts. */
  checkPermission: (purpose: PermissionPurpose) => Promise<PermissionVerdict>;
  recognitionPolicy: (locale: string) => Promise<RecognitionPolicy>;
  listeningLocale: () => string;
  voiceSource: () => VoiceSource;
  /** null when the server lists no tts; else whether its voice list loaded (fresh: read again). */
  serverVoices: ((fresh: boolean) => Promise<boolean>) | null;
}>;

export type ReadOptions = Readonly<{ fresh?: boolean; timeoutMs?: number }>;

export const NO_CLIENT_FACTS: ClientFacts = Object.freeze({
  push: null,
  microphone: null,
  speech: null,
  serverVoice: null,
});

/** The read's answer, or null when it fails (logged) or takes longer than `ms`. */
async function settle<T>(what: string, read: () => Promise<T> | T, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([Promise.resolve().then(read), late]);
  } catch (error) {
    logger.warn(`[readiness] this phone's ${what} could not be read`, error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readSpeech(ports: ClientPorts): Promise<SpeechFacts> {
  const locale = ports.listeningLocale();
  const [verdict, policy] = await Promise.all([
    ports.checkPermission('quick-ask'),
    ports.recognitionPolicy(locale),
  ]);
  return Object.freeze({ verdict, policy, locale });
}

async function readServerVoice(ports: ClientPorts, fresh: boolean): Promise<ServerVoiceFact> {
  if (!ports.serverVoices) return 'off';
  if (!(await ports.serverVoices(fresh))) return 'unanswered';
  return ports.voiceSource() === 'phone' ? 'phone_chosen' : 'speaks';
}

/** Every one of this phone's facts at once; never rejects. */
export async function readClientFacts(
  ports: ClientPorts,
  { fresh = false, timeoutMs = CLIENT_READ_TIMEOUT_MS }: ReadOptions = {},
): Promise<ClientFacts> {
  const [push, microphone, speech, serverVoice] = await Promise.all([
    settle('push status', ports.pushStatus, timeoutMs),
    settle('microphone permission', () => ports.checkPermission('live'), timeoutMs),
    settle('speech recognition', () => readSpeech(ports), timeoutMs),
    settle('server voice', () => readServerVoice(ports, fresh), timeoutMs),
  ]);
  return Object.freeze({ push, microphone, speech, serverVoice });
}
