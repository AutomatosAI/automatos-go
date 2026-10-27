// A quick-ask engine over spy ports for the engine's tests (US-019g): the recognizer, the speaker and
// the permission gate are spies, the thread is A2's own threadReducer behind a ThreadPort (send and
// Stop dispatch what use-thread.ts's runner dispatches), and every call is logged in order so a test
// can check barge-in's sequence. The clock and the HOLD_MAX_MS timer are the test's. overModule()
// drives recognizer-core over a spy module port instead, so a test plays the module's own events;
// twoScreens() puts two screens' engines over one recognizer-core and one speaker-core, each attached
// as use-quick-ask.ts attaches it (P001V-RVW-2).

import { vi } from 'vitest';

import type { GateInput } from '../../api/capabilities';
import type { ThreadAction, ThreadState } from '../../chat/controller/thread';
import type { PermissionVerdict } from '../permissions/permission-flow';
import { createQuickAsk, type ThreadPort } from '../quick-ask/quick-ask-engine';
import { onDeviceOptions, type RecognitionPolicy } from '../quick-ask/recognition-policy';
import { createRecognizer, type Recognizer, type StartOutcome } from '../quick-ask/recognizer-core';
import type { RecognizerVoiceEvent } from '../quick-ask/recognizer-events';
import type { QuickAskMessage } from '../quick-ask/spoken-mode';
import type { ReplyVoice } from '../speech/reply-voice';
import { createSpeaker, type SpeakOptions, type Speaker } from '../speech/speaker-core';
import { spyPort } from './recognizer-port';
import { spySpeechPort } from './speech-port';
import { NOW } from './voice-fixtures';
import { AT, draft, opened, run, saved, sent } from './thread-states';

export const READY: RecognitionPolicy = Object.freeze({
  kind: 'ready',
  options: onDeviceOptions('en-GB'),
});
export const GRANTED: PermissionVerdict = Object.freeze({
  step: 'granted',
  blocked: null,
  asked: false,
});
export const SPOKEN: GateInput = { capabilities: ['spoken_mode'], push: { expo: true } };
export const EARLIER = [saved('m-0', 'user', 'Hi'), saved('m-1', 'assistant', 'Morning.')];

export type HarnessOptions = {
  readonly roleCanChat?: boolean;
  readonly policy?: RecognitionPolicy;
  readonly permission?: PermissionVerdict;
  /** The permission gate's answer, when the test settles it itself (a release during the checks). */
  readonly permissionAnswer?: () => Promise<PermissionVerdict>;
  readonly thread?: ThreadState;
  /** recognizer-core behind the spies (overModule): start, stop and abort reach it too. */
  readonly core?: Pick<Recognizer, 'start' | 'stop' | 'abort'>;
  /** speaker-core (twoScreens) or the reply voice behind the spies: speak, stop and newTurn reach it. */
  readonly voiceOut?: Pick<Speaker, 'speak' | 'stop'> &
    Partial<Pick<ReplyVoice, 'newTurn' | 'handOver'>>;
  /** What the hook hands the engine to speak with; the phone's language alone when omitted. */
  readonly speech?: SpeakOptions;
};

const STARTED: StartOutcome = Object.freeze({ kind: 'started' });

type Timer = { readonly run: () => void; readonly ms: number; cancelled: boolean };

function spies(log: string[], options: HarnessOptions) {
  const policy = vi.fn(async () => options.policy ?? READY);
  const { core } = options;
  const recognizer = {
    start: vi.fn((chosen: RecognitionPolicy): StartOutcome => {
      log.push('recognizer.start');
      return core?.start(chosen) ?? STARTED;
    }),
    stop: vi.fn(() => {
      log.push('recognizer.stop');
      core?.stop();
    }),
    abort: vi.fn(() => {
      log.push('recognizer.abort');
      core?.abort();
    }),
    downloadModel: vi.fn(async (_locale: string) => 'downloaded' as const),
    policy,
  };
  const { voiceOut } = options;
  const speaker = {
    speak: vi.fn((sentence: string, speech: SpeakOptions) => {
      log.push(`speak: ${sentence}`);
      voiceOut?.speak(sentence, speech);
    }),
    stop: vi.fn(() => {
      log.push('speaker.stop');
      voiceOut?.stop();
    }),
    // Not logged: the order tests read speak and stop only.
    newTurn: vi.fn(() => voiceOut?.newTurn?.()),
    // A barge-in's stop: the speech stops, the audio session goes to the recognizer.
    handOver: vi.fn(() => {
      log.push('speaker.handOver');
      if (voiceOut?.handOver) voiceOut.handOver();
      else voiceOut?.stop();
    }),
  };
  const permissions = {
    press: vi.fn((_purpose: string) => {
      log.push('permissions.press');
      return options.permissionAnswer?.() ?? Promise.resolve(options.permission ?? GRANTED);
    }),
  };
  return { recognizer, speaker, permissions };
}

export function harness(options: HarnessOptions = {}) {
  const log: string[] = [];
  const sends: QuickAskMessage[] = [];
  const timers: Timer[] = [];
  const clock = { now: NOW };
  let thread = options.thread ?? opened(EARLIER);
  const ports = spies(log, options);
  const threadPort = (): ThreadPort => ({
    state: thread,
    send: (message) => {
      log.push('thread.send');
      sends.push(message);
      thread = sent(thread, draft(message.text));
    },
    stop: () => {
      log.push('thread.stop');
      thread = run(thread, { type: 'stopped', at: AT });
    },
  });
  const quickAsk = createQuickAsk({
    ...ports,
    context: () => ({
      thread: threadPort(),
      roleCanChat: options.roleCanChat ?? true,
      discovery: SPOKEN,
      speech: options.speech ?? { language: 'en-GB' },
    }),
    now: () => clock.now,
    later: (go, ms) => {
      const timer: Timer = { run: go, ms, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  });
  quickAsk.mount();

  /** The thread moves on (frames, a refetch, …) and the hook's effect hands the state over. */
  const feed = (...actions: readonly ThreadAction[]): ThreadState => {
    thread = run(thread, ...actions);
    quickAsk.onThread(thread);
    return thread;
  };
  /** A typed turn on the same thread (the TYPE sheet), through A2's send. */
  const typed = (text: string): void => {
    thread = sent(thread, draft(text));
    quickAsk.onThread(thread);
  };
  const hear = (event: RecognizerVoiceEvent): void =>
    quickAsk.onRecognizer({ kind: 'voice', event });
  const voice = () => quickAsk.snapshot().voice;
  const thread$ = () => thread;
  const later = () => timers.filter((timer) => !timer.cancelled);
  return {
    ...ports,
    quickAsk,
    log,
    sends,
    clock,
    feed,
    typed,
    hear,
    voice,
    thread: thread$,
    later,
  };
}

export type Harness = ReturnType<typeof harness>;

/** The engine over recognizer-core and a spy module port, listening as use-quick-ask.ts does. */
export function overModule(options: HarnessOptions = {}) {
  const module = spyPort();
  const core = createRecognizer(module.port);
  const h = harness({ ...options, core });
  core.listen(h.quickAsk.onRecognizer);
  return { ...h, module };
}

/**
 * Two screens' engines over one recognizer-core (a spy module port) and one speaker-core (a spy
 * speech port), the first attached: `attach` gives an engine the listeners as use-quick-ask.ts does.
 */
export function twoScreens() {
  const module = spyPort();
  const speech = spySpeechPort();
  const sources = {
    recognizer: createRecognizer(module.port),
    speaker: createSpeaker(speech.port, 'ios'),
  };
  const options = { core: sources.recognizer, voiceOut: sources.speaker };
  const first = harness(options);
  const second = harness(options);
  const attach = (h: Harness): (() => void) => h.quickAsk.attach(sources);
  return { module, speech, first, second, attach, detachFirst: attach(first) };
}

/** A whole hold: press, the mic opens, the words, the release after `heldMs`, the final. */
export async function ask(h: Harness, words: string, heldMs = 1_200): Promise<void> {
  await h.quickAsk.press();
  h.hear({ type: 'mic_open' });
  h.hear({ type: 'partial', text: words });
  h.clock.now += heldMs;
  h.quickAsk.release();
  h.hear({ type: 'mic_closed' });
  h.hear({ type: 'final', text: words });
  h.quickAsk.onRecognizer({ kind: 'ended' });
}
