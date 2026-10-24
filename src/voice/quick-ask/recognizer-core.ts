// The recognizer over a port (US-019b): recognizer.ts binds it to expo-speech-recognition, the tests
// to a spy. Pure: no React, React Native or Expo. The privacy rule lives here (KV4): start() calls
// port.start ONLY for a 'ready' policy and always with requiresOnDeviceRecognition true, on iOS and
// Android alike, from a fresh object holding only the on-device options; 'download' and
// 'unavailable' refuse with their copy key and never reach the port. There is no other way in.
// One hold is one session: continuous recognition hands its words over in pieces (Android's
// segments, iOS 18's early finals), so the session joins them and says final ONCE, at the module's
// end event (after stop(): the release). abort() (STOP, the background) sends nothing: its session
// says no final. An end that comes before the new session's first event is the previous session's
// and is ignored.

import { logger } from '../../lib/logger';
import { hasWords } from '../machine/voice-state';
import type { RecognitionCopyKey } from '../strings';
import {
  onDeviceOptions,
  refusalCopyKey,
  type OnDeviceOptions,
  type RecognitionPlatform,
  type RecognitionPolicy,
  type RecognitionProbe,
} from './recognition-policy';
import {
  RECOGNIZER_EVENTS,
  toRecognizerEvent,
  type NativeEventName,
  type RecognizerEvent,
  type RecognizerVoiceEvent,
} from './recognizer-events';

export type Subscription = { readonly remove: () => void };

/** The slice of ExpoSpeechRecognitionModule quick-ask uses. */
export type ModulePort = {
  readonly start: (options: OnDeviceOptions) => void;
  readonly stop: () => void;
  readonly abort: () => void;
  readonly addListener: (
    name: NativeEventName,
    listener: (payload: unknown) => void,
  ) => Subscription;
  readonly supportsOnDeviceRecognition: () => boolean;
  readonly isRecognitionAvailable: () => boolean;
  /** The on-device recognizer's languages: no service package (ExpoSpeechRecognitionModule.kt:373-450). */
  readonly getSupportedLocales: () => Promise<{
    readonly locales: readonly string[];
    readonly installedLocales: readonly string[];
  }>;
  readonly androidTriggerOfflineModelDownload: (options: {
    readonly locale: string;
  }) => Promise<{ readonly status: string }>;
};

export type DeviceInfo = {
  readonly platform: RecognitionPlatform;
  readonly androidApiLevel?: number;
};

export type StartOutcome =
  | { readonly kind: 'started' }
  | {
      readonly kind: 'refused';
      readonly policy: Exclude<RecognitionPolicy, { kind: 'ready' }>;
      readonly copy: RecognitionCopyKey;
    }
  | { readonly kind: 'failed' };

export type DownloadOutcome = 'downloaded' | 'opened' | 'canceled' | 'failed';

export type Recognizer = {
  readonly probe: (device: DeviceInfo, locale: string) => Promise<RecognitionProbe>;
  readonly start: (policy: RecognitionPolicy) => StartOutcome;
  /** The release: the module finishes and the session says its final. */
  readonly stop: () => void;
  /** STOP or the background: nothing is sent. */
  readonly abort: () => void;
  readonly downloadModel: (locale: string) => Promise<DownloadOutcome>;
  /** One listener at a time (the voice screen's hook); a second listen replaces the first. */
  readonly listen: (handler: (event: RecognizerEvent) => void) => () => void;
};

/** One hold's recognition, from start() to the module's end event. */
type Session = {
  readonly status: 'closed' | 'starting' | 'running';
  readonly aborted: boolean;
  /** A failure was already told: the end says nothing more. */
  readonly settled: boolean;
  /** The finished pieces, joined. */
  readonly words: string;
  /** The piece being heard now. */
  readonly pending: string;
};

const CLOSED: Session = Object.freeze({
  status: 'closed',
  aborted: false,
  settled: false,
  words: '',
  pending: '',
});
const STARTING: Session = Object.freeze({ ...CLOSED, status: 'starting' });

const DOWNLOAD_STATUS: ReadonlyMap<string, DownloadOutcome> = new Map([
  ['download_success', 'downloaded'],
  ['opened_dialog', 'opened'],
  ['download_canceled', 'canceled'],
]);

function join(...pieces: readonly string[]): string {
  return pieces
    .map((piece) => piece.trim())
    .filter(Boolean)
    .join(' ');
}

const say = (event: RecognizerVoiceEvent): RecognizerEvent =>
  Object.freeze({ kind: 'voice', event });

type Step = { readonly session: Session; readonly out: readonly RecognizerEvent[] };

/** The words still count: a session under way that STOP did not abort and no failure ended. */
function listening(session: Session): boolean {
  return session.status !== 'closed' && !session.aborted && !session.settled;
}

function running(session: Session): Session {
  return session.status === 'starting' ? { ...session, status: 'running' } : session;
}

function onEnd(session: Session): Step {
  // Nothing of this session has come yet: the previous session's end.
  if (session.status === 'starting' && !session.settled) return { session, out: [] };
  if (session.status === 'closed') return { session, out: [] };
  const ended: RecognizerEvent = { kind: 'ended' };
  if (session.aborted || session.settled) return { session: CLOSED, out: [ended] };
  const utterance = join(session.words, session.pending);
  const outcome = hasWords(utterance)
    ? say({ type: 'final', text: utterance })
    : say({ type: 'nothing_heard' });
  return { session: CLOSED, out: [outcome, ended] };
}

function onWords(session: Session, type: 'partial' | 'final', text: string): Step {
  if (!listening(session)) return { session: running(session), out: [] };
  const next =
    type === 'final'
      ? { ...running(session), words: join(session.words, text), pending: '' }
      : { ...running(session), pending: text };
  const heard = join(next.words, next.pending);
  return { session: next, out: hasWords(heard) ? [say({ type: 'partial', text: heard })] : [] };
}

function onVoice(session: Session, event: RecognizerEvent & { kind: 'voice' }): Step {
  const voiced = event.event;
  switch (voiced.type) {
    case 'mic_open':
      return { session: running(session), out: [event] };
    case 'mic_closed':
      return { session, out: [event] };
    case 'partial':
    case 'final':
      return onWords(session, voiced.type, voiced.text);
    case 'nothing_heard':
      // The end decides: a silent piece mid-hold is not the end of the hold.
      return { session: running(session), out: [] };
    default:
      // A failure ends the hold once; after STOP or an earlier failure it has nothing to add.
      if (!listening(session)) return { session: running(session), out: [] };
      return { session: { ...running(session), settled: true }, out: [event] };
  }
}

/** One mapped event through the session: what it becomes and what quick-ask hears. */
function stepSession(session: Session, event: RecognizerEvent): Step {
  if (event.kind === 'ended') return onEnd(session);
  if (event.kind === 'level') return { session, out: [event] };
  if (event.kind === 'started') return { session: running(session), out: [event] };
  return onVoice(session, event);
}

/** A native check that throws counts as 'no'. */
function check(name: string, read: () => boolean): boolean {
  try {
    return read() === true;
  } catch (error) {
    logger.warn(`[voice] ${name} failed`, error);
    return false;
  }
}

async function installedLocales(
  port: ModulePort,
): Promise<Pick<RecognitionProbe, 'supportedLocales' | 'installedLocales'>> {
  try {
    const lists = await port.getSupportedLocales();
    return { supportedLocales: lists.locales, installedLocales: lists.installedLocales };
  } catch (error) {
    logger.warn('[voice] getSupportedLocales failed', error);
    return { supportedLocales: [], installedLocales: [] };
  }
}

async function probeWith(
  port: ModulePort,
  device: DeviceInfo,
  locale: string,
): Promise<RecognitionProbe> {
  const base: RecognitionProbe = {
    ...device,
    locale,
    supportsOnDevice: check('supportsOnDeviceRecognition', port.supportsOnDeviceRecognition),
    recognitionAvailable: check('isRecognitionAvailable', port.isRecognitionAvailable),
  };
  // Only the on-device recognizer's languages matter, and only Android lists them apart.
  return device.platform === 'android' && base.supportsOnDevice
    ? { ...base, ...(await installedLocales(port)) }
    : base;
}

async function downloadWith(port: ModulePort, locale: string): Promise<DownloadOutcome> {
  try {
    const result = await port.androidTriggerOfflineModelDownload({ locale });
    return DOWNLOAD_STATUS.get(result.status) ?? 'failed';
  } catch (error) {
    logger.warn('[voice] the speech model download failed', error);
    return 'failed';
  }
}

export function createRecognizer(port: ModulePort): Recognizer {
  let session: Session = CLOSED;
  let unlisten: (() => void) | null = null;

  function start(policy: RecognitionPolicy): StartOutcome {
    if (policy.kind !== 'ready') return { kind: 'refused', policy, copy: refusalCopyKey(policy) };
    try {
      session = STARTING;
      // Rebuilt from the locale alone: nothing else in the policy object reaches the module.
      port.start(onDeviceOptions(policy.options.lang));
      return { kind: 'started' };
    } catch (error) {
      session = CLOSED;
      logger.warn('[voice] recognition did not start', error);
      return { kind: 'failed' };
    }
  }

  function abort(): void {
    if (session.status !== 'closed') session = { ...session, aborted: true };
    port.abort();
  }

  function listen(handler: (event: RecognizerEvent) => void): () => void {
    unlisten?.();
    const onNative = (name: NativeEventName, payload: unknown): void => {
      const mapped = toRecognizerEvent(name, payload);
      if (mapped === null) return;
      const step = stepSession(session, mapped);
      session = step.session;
      step.out.forEach(handler);
    };
    const subscriptions = RECOGNIZER_EVENTS.map((name) =>
      port.addListener(name, (payload) => onNative(name, payload)),
    );
    const remove = (): void => {
      subscriptions.forEach((subscription) => subscription.remove());
      if (unlisten === remove) unlisten = null;
    };
    unlisten = remove;
    return remove;
  }

  return {
    probe: (device, locale) => probeWith(port, device, locale),
    start,
    stop: () => port.stop(),
    abort,
    downloadModel: (locale) => downloadWith(port, locale),
    listen,
  };
}
