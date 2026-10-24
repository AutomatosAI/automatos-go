// A quick-ask engine over spy ports for the engine's tests (US-019g): the recognizer, the speaker and
// the permission gate are spies, the thread is A2's own threadReducer behind a ThreadPort (send and
// Stop dispatch what use-thread.ts's runner dispatches), and every call is logged in order so a test
// can check barge-in's sequence. The clock and the HOLD_MAX_MS timer are the test's.

import { vi } from 'vitest';

import type { GateInput } from '../../api/capabilities';
import type { ThreadAction, ThreadState } from '../../chat/controller/thread';
import type { PermissionVerdict } from '../permissions/permission-flow';
import { createQuickAsk, type ThreadPort } from '../quick-ask/quick-ask-engine';
import { onDeviceOptions, type RecognitionPolicy } from '../quick-ask/recognition-policy';
import type { RecognizerVoiceEvent } from '../quick-ask/recognizer-events';
import type { QuickAskMessage } from '../quick-ask/spoken-mode';
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
};

type Timer = { readonly run: () => void; readonly ms: number; cancelled: boolean };

function spies(log: string[], options: HarnessOptions) {
  const policy = vi.fn(async () => options.policy ?? READY);
  const recognizer = {
    start: vi.fn((_policy: RecognitionPolicy) => {
      log.push('recognizer.start');
      return { kind: 'started' } as const;
    }),
    stop: vi.fn(() => void log.push('recognizer.stop')),
    abort: vi.fn(() => void log.push('recognizer.abort')),
    downloadModel: vi.fn(async (_locale: string) => 'downloaded' as const),
    policy,
  };
  const speaker = {
    speak: vi.fn((sentence: string) => void log.push(`speak: ${sentence}`)),
    stop: vi.fn(() => void log.push('speaker.stop')),
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
      speech: { language: 'en-GB' },
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
  const hear = (event: RecognizerVoiceEvent): void => quickAsk.onRecognizer({ kind: 'voice', event });
  const voice = () => quickAsk.snapshot().voice;
  const thread$ = () => thread;
  const later = () => timers.filter((timer) => !timer.cancelled);
  return { ...ports, quickAsk, log, sends, clock, feed, typed, hear, voice, thread: thread$, later };
}

export type Harness = ReturnType<typeof harness>;

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
