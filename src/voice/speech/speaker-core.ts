// The phone's text to speech over a port (US-019d): speaker.ts binds it to expo-speech, the tests to
// a spy. Pure: no React, React Native or Expo.
//   speak() queues: expo-speech adds each utterance to the engine's queue on both platforms
//   (AVSpeechSynthesizer.speak; TextToSpeech.QUEUE_ADD, SpeechModule.kt:126-131). A sentence longer
//   than the engine takes (Android's getMaxSpeechInputLength) goes in pieces split at a space: the
//   module would refuse it and never call back.
//   The engine's per-utterance callbacks fold into three events: speak_start at the first utterance
//   of a run that starts, speak_done when the LAST queued utterance has ended (done, stopped by the
//   system or failed: the queue ran out either way), stopped when stop() cut a run short.
//   stop() starts a new generation and says stopped itself: the old run's late callbacks (Android's
//   onStop for each flushed utterance, iOS's didCancel for the current one) are ignored, and nothing
//   waits on a callback for a queued utterance the engine dropped.
//   voices() reads the phone's voices once per launch (a failed read is tried again next time);
//   voiceFor() picks from them: the voice Settings → Voice saved while the phone still offers it,
//   else voice-pick.ts's. choicesFor() reads them afresh (a voice downloaded since launch shows, and
//   voiceFor() sees it from then on) and lists what Settings → Voice offers (voice-choices.ts).
//   Each utterance is spoken at the rate and pitch it is given, else the voice's own (1).
//   One listener hears at a time, kept as a stack (P001V-RVW-2, listener-stack.ts): a newer listen
//   tells the one it covers, and removing it gives the events back.

import { z } from 'zod';

import { logger } from '../../lib/logger';
import { createListenerStack } from '../audio/listener-stack';
import { SPEECH_PITCH, SPEECH_RATE } from '../config';
import type { RecognitionPlatform } from '../quick-ask/recognition-policy';
import type { ServerSpeech } from '../server/server-speaker-ports';
import { resolveVoice, voiceChoices, type VoiceChoice } from './voice-choices';
import type { SpeechVoice } from './voice-pick';

/** What the speaker tells quick-ask. */
export type SpeakerEvent =
  { readonly type: 'speak_start' } | { readonly type: 'speak_done' } | { readonly type: 'stopped' };

/** The expo-speech options each utterance is spoken with. */
export type SpeakRequest = {
  readonly language: string;
  readonly voice?: string;
  readonly rate: number;
  readonly pitch: number;
  readonly useApplicationAudioSession: boolean;
  readonly onStart: () => void;
  readonly onDone: () => void;
  readonly onStopped: () => void;
  readonly onError: (error: Error) => void;
};

/** The slice of expo-speech quick-ask uses. */
export type SpeechPort = {
  readonly speak: (text: string, request: SpeakRequest) => void;
  readonly stop: () => Promise<void>;
  readonly getVoices: () => Promise<unknown>;
  /** The longest text the engine takes in one utterance (iOS: Number.MAX_VALUE). */
  readonly maxInputLength: number;
};

/**
 * The phone's language (the one recognition listens in), the voice when one was picked, and the
 * rate and pitch Settings → Voice saved (the voice's own, 1, when not given). server: Auto's server
 * voice, which reply-voice.ts speaks with instead when it is given; the phone's speaker ignores it.
 */
export type SpeakOptions = {
  readonly language: string;
  readonly voice?: string;
  readonly rate?: number;
  readonly pitch?: number;
  readonly server?: ServerSpeech;
};

export type Speaker = {
  readonly voices: () => Promise<readonly SpeechVoice[]>;
  /** The saved voice while the phone offers it for the locale, else the phone's best for it. */
  readonly voiceFor: (locale: string, saved?: string | null) => Promise<string | undefined>;
  /** Settings → Voice's list for the locale, from the phone's voices read afresh. */
  readonly choicesFor: (locale: string) => Promise<readonly VoiceChoice[]>;
  readonly speak: (sentence: string, options: SpeakOptions) => void;
  readonly stop: () => void;
  /**
   * One listener at a time: a second listen covers the first (told through `evicted`) until it is
   * removed, and the first hears again.
   */
  readonly listen: (handler: (event: SpeakerEvent) => void, evicted?: () => void) => () => void;
};

type Run = {
  /** Bumped by stop(): callbacks of an older generation are ignored. */
  readonly generation: number;
  /** Utterances queued and not yet ended. */
  readonly pending: number;
  readonly started: boolean;
};

const voiceSchema = z.object({
  identifier: z.string(),
  name: z.string(),
  quality: z.string(),
  language: z.string(),
});

/** The module's list, each voice parsed on its own: one that does not parse is dropped. */
function parseVoices(payload: unknown): readonly SpeechVoice[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((entry: unknown) => {
    const parsed = voiceSchema.safeParse(entry);
    return parsed.success ? [Object.freeze(parsed.data)] : [];
  });
}

/** The text in pieces of at most `max` characters, split at a space where there is one. */
export function fitToEngine(text: string, max: number): readonly string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (!(max > 0) || trimmed.length <= max) return [trimmed];
  const space = trimmed.lastIndexOf(' ', max);
  const cut = space > 0 ? space : max;
  return [trimmed.slice(0, cut).trim(), ...fitToEngine(trimmed.slice(cut), max)];
}

async function readVoices(port: SpeechPort): Promise<readonly SpeechVoice[] | null> {
  try {
    return parseVoices(await port.getVoices());
  } catch (error) {
    logger.warn('[voice] the voices did not load', error);
    return null;
  }
}

type VoiceCache = {
  readonly get: () => Promise<readonly SpeechVoice[]>;
  /** Reads the phone's list again; later get()s answer from the new read. */
  readonly refresh: () => Promise<readonly SpeechVoice[]>;
};

/** The phone's voices, read once per launch; a failed read is tried again next time. */
function voiceCache(port: SpeechPort): VoiceCache {
  let voiceList: Promise<readonly SpeechVoice[]> | null = null;
  const get = (): Promise<readonly SpeechVoice[]> => {
    voiceList ??= readVoices(port).then((list) => {
      if (list === null) voiceList = null;
      return list ?? [];
    });
    return voiceList;
  };
  return {
    get,
    refresh: () => {
      voiceList = null;
      return get();
    },
  };
}

type Step = { readonly run: Run; readonly event: SpeakerEvent | null };

/** An utterance began: the run's first start says speak_start. */
function startStep(run: Run, generation: number): Step {
  if (generation !== run.generation || run.pending === 0 || run.started)
    return { run, event: null };
  return { run: { ...run, started: true }, event: { type: 'speak_start' } };
}

/** An utterance ended (done, stopped by the system, failed): the last one says speak_done. */
function endStep(run: Run, generation: number): Step {
  if (generation !== run.generation || run.pending === 0) return { run, event: null };
  if (run.pending > 1) return { run: { ...run, pending: run.pending - 1 }, event: null };
  return { run: { ...run, pending: 0, started: false }, event: { type: 'speak_done' } };
}

function speakRequest(options: SpeakOptions, started: () => void, ended: () => void): SpeakRequest {
  return {
    language: options.language,
    ...(options.voice === undefined ? {} : { voice: options.voice }),
    rate: options.rate ?? SPEECH_RATE,
    pitch: options.pitch ?? SPEECH_PITCH,
    // iOS: the system's own audio session for speech (KV6); Android ignores it.
    useApplicationAudioSession: false,
    onStart: started,
    onDone: ended,
    onStopped: ended,
    onError: (error) => {
      logger.warn('[voice] an utterance failed', error);
      ended();
    },
  };
}

export function createSpeaker(port: SpeechPort, platform: RecognitionPlatform): Speaker {
  let run: Run = { generation: 0, pending: 0, started: false };
  const listeners = createListenerStack<SpeakerEvent>('speaker');
  const voices = voiceCache(port);

  function apply(step: Step): void {
    run = step.run;
    if (step.event !== null) listeners.emit(Object.freeze(step.event));
  }

  function speak(sentence: string, options: SpeakOptions): void {
    const pieces = fitToEngine(sentence, port.maxInputLength);
    const { generation } = run;
    const started = (): void => apply(startStep(run, generation));
    const ended = (): void => apply(endStep(run, generation));
    run = { ...run, pending: run.pending + pieces.length };
    pieces.forEach((piece) => {
      try {
        port.speak(piece, speakRequest(options, started, ended));
      } catch (error) {
        logger.warn('[voice] an utterance was not queued', error);
        ended();
      }
    });
  }

  function stop(): void {
    const cutShort = run.pending > 0;
    port.stop().catch((error: unknown) => logger.warn('[voice] speech did not stop', error));
    apply({
      run: { generation: run.generation + 1, pending: 0, started: false },
      event: cutShort ? { type: 'stopped' } : null,
    });
  }

  return Object.freeze({
    voices: voices.get,
    voiceFor: async (locale: string, saved?: string | null) =>
      resolveVoice(await voices.get(), locale, platform, saved),
    choicesFor: async (locale: string) => voiceChoices(await voices.refresh(), locale, platform),
    speak,
    stop,
    listen: listeners.push,
  });
}
