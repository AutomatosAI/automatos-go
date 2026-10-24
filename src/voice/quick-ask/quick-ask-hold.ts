// HOLD TO TALK (KV5, US-019g): the press, the release and what the recognizer heard. Pure: no React,
// React Native or Expo (the ports are quick-ask-store.ts's).
//   press → the permission gate (US-019c; a prompt takes the hold) → the recognition policy (US-019b;
//   on the phone or not at all) → onPress → the recognizer claims the audio (KV13) → the plan's steps
//   in order: stop the speech (barge-in), cancel a streaming turn through A2's Stop (D-STOP), clear
//   an error, open the mic. A viewer's press does nothing at all (D17: the mic never opens). A
//   release during the checks never opens the mic: it is a tap, or nothing heard.
//   release → a tap aborts ('Hold the button while you talk'); otherwise recognizer.stop(), and the
//   recognizer's final (said once, at its end) decides through onRelease: a stop phrase is STOP with
//   nothing sent, nothing sayable is nothing heard, words go to A2's thread (quick-ask-reply.ts).
//   HOLD_MAX_MS releases by itself. MIC LIVE is the recognizer's audiostart/audioend, never this.
//   A call, Siri or a lost microphone mid-hold goes to the interruption policy (US-019h,
//   quick-ask-interrupt.ts): abort, the words kept on screen un-sent, the reason's message.

import { logger } from '../../lib/logger';
import { claim, release } from '../audio/audio-owner';
import { HOLD_MAX_MS } from '../config';
import { interruptionOf } from '../interruptions/interruption-policy';
import {
  isStartPlan,
  isTap,
  onPress,
  onRelease,
  type PressStart,
  type PressStep,
} from './quick-ask-plan';
import { interrupt } from './quick-ask-interrupt';
import { send } from './quick-ask-reply';
import {
  cancelTurn,
  dispatch,
  endHold,
  get,
  set,
  show,
  silence,
  type Engine,
  type Hold,
} from './quick-ask-store';
import type { RecognizerEvent, RecognizerVoiceEvent } from './recognizer-events';

/** Recognizer events after which the hold is over: no final will come (interruptions aside). */
const ENDS_HOLD: ReadonlySet<RecognizerVoiceEvent['type']> = new Set([
  'nothing_heard',
  'permission',
  'unavailable',
  'error',
]);

/** The recognizer is done with the audio, and the hold is over. */
function releaseRecognizer(engine: Engine): void {
  set(engine, { owner: release(get(engine).owner, 'recognizer') });
  endHold(engine);
}

/** The finger was lifted before the mic opened: a tap, or a hold the checks took. */
function endedEarly(engine: Engine, hold: Hold): void {
  const heldMs = (hold.releasedAt ?? hold.pressedAt) - hold.pressedAt;
  releaseRecognizer(engine);
  dispatch(engine, { type: isTap(heldMs) ? 'hold_too_short' : 'nothing_heard' });
}

function listen(engine: Engine, plan: PressStart, hold: Hold): void {
  dispatch(engine, { type: 'hold_start', now: hold.pressedAt });
  const current = get(engine).hold ?? hold;
  if (current.releasedAt !== null) return endedEarly(engine, current);
  const outcome = engine.deps.recognizer.start(plan.start);
  if (outcome.kind !== 'started') {
    releaseRecognizer(engine);
    return dispatch(engine, { type: 'error', kind: 'recognizer' });
  }
  const cancelTimer = engine.deps.later(() => releaseHold(engine), HOLD_MAX_MS);
  set(engine, { hold: { ...current, listening: true, cancelTimer } });
}

const STEPS: Readonly<Record<PressStep, (engine: Engine, plan: PressStart, hold: Hold) => void>> =
  Object.freeze({
    'stop-speech': (engine) => silence(engine),
    'cancel-turn': (engine) => cancelTurn(engine),
    reset: (engine) => dispatch(engine, { type: 'reset' }),
    listen,
  });

/** The plan's steps in order, once the recognizer has the audio (barge-in stops the speaker). */
function begin(engine: Engine, plan: PressStart, hold: Hold): void {
  const claimed = claim(get(engine).owner, 'recognizer');
  if (!claimed.granted) return endHold(engine);
  set(engine, { owner: claimed.owner });
  const ownerStopsSpeech = claimed.stop.includes('speaker') && !plan.stopSpeech;
  const steps: readonly PressStep[] = ownerStopsSpeech
    ? ['stop-speech', ...plan.steps]
    : plan.steps;
  steps.forEach((step) => STEPS[step](engine, plan, hold));
}

/** The permission and the policy, read from the press (never at mount: KV5). */
async function checks(engine: Engine) {
  const permission = await engine.deps.permissions.press('quick-ask');
  const policy = await engine.deps.recognizer.policy();
  show(engine, { permission, policy });
  return { permission, policy };
}

/** The checks are in: the hold goes on, or the press ends with what blocked it. */
async function plan(engine: Engine, hold: Hold): Promise<void> {
  const { permission, policy } = await checks(engine);
  const current = get(engine).hold;
  // STOP or leaving the screen during the checks ended this press.
  if (current?.id !== hold.id || !get(engine).mounted) return;
  const { voice } = get(engine).snapshot;
  const { roleCanChat } = engine.deps.context();
  const input = { phase: voice.phase, replyStreaming: voice.replyStreaming, roleCanChat };
  const planned = onPress({ ...input, policy, permission });
  if (isStartPlan(planned)) return begin(engine, planned, current);
  endHold(engine);
  if (planned.event !== null) dispatch(engine, planned.event);
}

export async function press(engine: Engine): Promise<void> {
  const inner = get(engine);
  // One hold at a time; a viewer's press opens nothing (D17).
  if (!inner.mounted || inner.hold !== null || !engine.deps.context().roleCanChat) return;
  const id = inner.holds + 1;
  const pressedAt = engine.deps.now();
  const hold: Hold = { id, pressedAt, listening: false, releasedAt: null, cancelTimer: null };
  set(engine, { hold, holds: id });
  try {
    await plan(engine, hold);
  } catch (error) {
    logger.warn('[voice] the press could not start', error);
    if (get(engine).hold?.id === id) endHold(engine);
  }
}

export function releaseHold(engine: Engine): void {
  const hold = get(engine).hold;
  if (hold === null || hold.releasedAt !== null) return;
  const now = engine.deps.now();
  hold.cancelTimer?.();
  set(engine, { hold: { ...hold, releasedAt: now, cancelTimer: null } });
  // The checks still run: listen() sees the release.
  if (!hold.listening) return;
  if (!isTap(now - hold.pressedAt)) return engine.deps.recognizer.stop();
  engine.deps.recognizer.abort();
  releaseRecognizer(engine);
  dispatch(engine, { type: 'hold_too_short' });
}

/** The hold's words, said once at the recognizer's end: a stop phrase, nothing, or a turn. */
function heard(engine: Engine, text: string): void {
  const hold = get(engine).hold;
  // A final after STOP belongs to a hold that is over.
  if (hold === null) return;
  const heldMs = (hold.releasedAt ?? engine.deps.now()) - hold.pressedAt;
  releaseRecognizer(engine);
  const outcome = onRelease({ heard: text, heldMs });
  if (outcome === 'too-short') return dispatch(engine, { type: 'hold_too_short' });
  if (outcome === 'stop') {
    // 'Auto, stop': the speech stopped and a streaming turn was cancelled at the press.
    engine.deps.speaker.stop();
    return dispatch(engine, { type: 'stop_phrase' });
  }
  if (outcome === 'nothing') return dispatch(engine, { type: 'nothing_heard' });
  dispatch(engine, { type: 'final', text: outcome.send });
  send(engine, outcome.send);
}

function onVoice(engine: Engine, event: RecognizerVoiceEvent): void {
  const interruption = interruptionOf(event, get(engine).snapshot.voice);
  if (interruption !== null) return interrupt(engine, interruption);
  if (event.type === 'final') return heard(engine, event.text);
  dispatch(engine, event);
  if (ENDS_HOLD.has(event.type)) endHold(engine);
}

export function onRecognizer(engine: Engine, event: RecognizerEvent): void {
  switch (event.kind) {
    case 'voice':
      return onVoice(engine, event.event);
    case 'level':
      if (get(engine).snapshot.voice.micOpen) show(engine, { level: event.level });
      return;
    case 'ended':
      set(engine, { owner: release(get(engine).owner, 'recognizer') });
      // The module ended without a final (an abort, a failure already told): the hold is over.
      if (get(engine).hold?.listening === true) endHold(engine);
      return;
    default:
      return;
  }
}
