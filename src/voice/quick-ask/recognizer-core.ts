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
//   iOS starts the capture in a Swift Task of its own and runs stop() and abort() in others
// (ExpoSpeechRecognitionModule.swift:174-260, 360-379): a stop or abort that lands before the
// capture begins is answered with an end, and the capture then starts anyway. So a stop() or abort()
// asked before the session's first event is remembered (abort wins over stop), and when the module
// answered it with an end before the capture began, it goes to the module again, once, at the
// session's first 'start' or 'audiostart' (P001V-RVW-1). Never without that early end: a second
// stop() after the task began finishing resets it and drops the final (ExpoSpeechRecognizer.swift:
// 154-166), and Android posts start, stop and abort to one Handler in order (ExpoSpeechService.kt:
// 116-205), so its calls always reach the capture. The module's second end() skips audioend (the
// first cleared its handler, ExpoSpeechRecognizer.swift:487-496), so the end of a session whose
// call went again closes MIC LIVE itself.
//   One listener hears at a time, kept as a stack (P001V-RVW-2, listener-stack.ts): a newer listen
// (a conversation's HUD home pushed over the voice screen) tells the one it covers, and removing it
// gives the events back. The module's events are subscribed while anyone listens; the session is the
// module's, whoever hears it.

import { logger } from '../../lib/logger';
import { createListenerStack, type ListenerStack } from '../audio/listener-stack';
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
  /**
   * One listener at a time: a second listen covers the first (told through `evicted`) until it is
   * removed, and the first hears again.
   */
  readonly listen: (handler: (event: RecognizerEvent) => void, evicted?: () => void) => () => void;
};

/** A call that ends a session: the release's stop, or STOP's abort. */
type EndCall = 'stop' | 'abort';

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
  /** stop() or abort() asked before the session's first event (abort wins over stop). */
  readonly asked: EndCall | null;
  /** The module answered `asked` with an end before the capture began (iOS). */
  readonly answered: boolean;
  /** `asked` went to the module again at the session's first event. */
  readonly resent: boolean;
  /** audiostart came and its audioend has not. */
  readonly micOpen: boolean;
};

const CLOSED: Session = Object.freeze({
  status: 'closed',
  aborted: false,
  settled: false,
  words: '',
  pending: '',
  asked: null,
  answered: false,
  resent: false,
  micOpen: false,
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

type Step = {
  readonly session: Session;
  readonly out: readonly RecognizerEvent[];
  /** The call to send the module again (the session's first event after an early answer). */
  readonly resend?: EndCall;
};

const MIC_CLOSED = say({ type: 'mic_closed' });

/** The words still count: a session under way that STOP did not abort and no failure ended. */
function listening(session: Session): boolean {
  return session.status !== 'closed' && !session.aborted && !session.settled;
}

function running(session: Session): Session {
  return session.status === 'starting' ? { ...session, status: 'running' } : session;
}

/** A stop or abort before the session's first event is remembered (abort wins over stop). */
function asking(session: Session, call: EndCall): Session {
  if (session.status !== 'starting') return session;
  return { ...session, asked: session.asked === 'abort' ? 'abort' : call };
}

/** STOP or the background: the session under way says nothing more. */
function aborting(session: Session): Session {
  const asked = asking(session, 'abort');
  return asked.status === 'closed' ? asked : { ...asked, aborted: true };
}

/** The session's first 'start' or 'audiostart': a call the module answered too early goes again. */
function begin(session: Session): Step {
  if (session.status !== 'starting') return { session, out: [] };
  const resend = session.answered && session.asked !== null ? session.asked : undefined;
  const begun: Session = { ...session, status: 'running', asked: null, answered: false };
  return resend === undefined
    ? { session: begun, out: [] }
    : { session: { ...begun, resent: true }, out: [], resend };
}

function onEnd(session: Session): Step {
  // Nothing of this session has come yet: the previous session's end, or (iOS) the module's answer
  // to this session's stop or abort, sent before its capture began.
  if (session.status === 'starting' && !session.settled) {
    return { session: session.asked === null ? session : { ...session, answered: true }, out: [] };
  }
  if (session.status === 'closed') return { session, out: [] };
  const ended: RecognizerEvent = { kind: 'ended' };
  // The module's second end skips audioend: MIC LIVE goes out here.
  const closing = session.resent && session.micOpen ? [MIC_CLOSED] : [];
  if (session.aborted || session.settled) return { session: CLOSED, out: [...closing, ended] };
  const utterance = join(session.words, session.pending);
  const outcome = hasWords(utterance)
    ? say({ type: 'final', text: utterance })
    : say({ type: 'nothing_heard' });
  return { session: CLOSED, out: [...closing, outcome, ended] };
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
    case 'mic_open': {
      const begun = begin(session);
      return { ...begun, session: { ...begun.session, micOpen: true }, out: [event] };
    }
    case 'mic_closed':
      return { session: { ...session, micOpen: false }, out: [event] };
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
  if (event.kind === 'started') return { ...begin(session), out: [event] };
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

/** The call the module answered before the capture began, sent again (once per session). */
function sendAgain(port: ModulePort, call: EndCall): void {
  try {
    if (call === 'abort') port.abort();
    else port.stop();
  } catch (error) {
    logger.warn(`[voice] the recognizer's ${call} could not be sent again`, error);
  }
}

/** Every module event quick-ask listens to, through `onNative`; the remover takes them all off. */
function subscribeAll(
  port: ModulePort,
  onNative: (name: NativeEventName, payload: unknown) => void,
): () => void {
  const subscriptions = RECOGNIZER_EVENTS.map((name) =>
    port.addListener(name, (payload) => onNative(name, payload)),
  );
  return () => subscriptions.forEach((subscription) => subscription.remove());
}

/** listen over the stack: the module's events subscribed from the first listener to the last. */
function listenWhileHeard(
  listeners: ListenerStack<RecognizerEvent>,
  subscribe: () => () => void,
): Recognizer['listen'] {
  let unsubscribe: (() => void) | null = null;
  return (handler, evicted) => {
    unsubscribe ??= subscribe();
    const remove = listeners.push(handler, evicted);
    return () => {
      remove();
      if (listeners.size() > 0) return;
      unsubscribe?.();
      unsubscribe = null;
    };
  };
}

export function createRecognizer(port: ModulePort): Recognizer {
  let session: Session = CLOSED;
  const listeners = createListenerStack<RecognizerEvent>('recognizer');

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

  function stop(): void {
    session = asking(session, 'stop');
    port.stop();
  }

  function abort(): void {
    session = aborting(session);
    port.abort();
  }

  function onNative(name: NativeEventName, payload: unknown): void {
    const mapped = toRecognizerEvent(name, payload);
    if (mapped === null) return;
    const step = stepSession(session, mapped);
    session = step.session;
    if (step.resend !== undefined) sendAgain(port, step.resend);
    step.out.forEach(listeners.emit);
  }

  return {
    probe: (device, locale) => probeWith(port, device, locale),
    start,
    stop,
    abort,
    downloadModel: (locale) => downloadWith(port, locale),
    listen: listenWhileHeard(listeners, () => subscribeAll(port, onNative)),
  };
}
