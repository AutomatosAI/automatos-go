// A spy SpeechPort for the speaker tests (US-019d): every utterance held with its request, so a test
// plays the engine's callbacks (onStart, onDone, onStopped, onError) in the order the phone sends them.

import { vi } from 'vitest';

import type { SpeakRequest, SpeechPort } from '../speech/speaker-core';

export function spySpeechPort(overrides: Partial<SpeechPort> = {}) {
  const utterances: { text: string; request: SpeakRequest }[] = [];
  const port = {
    speak: vi.fn((text: string, request: SpeakRequest) => {
      utterances.push({ text, request });
    }),
    stop: vi.fn(async () => undefined),
    getVoices: vi.fn(async (): Promise<unknown> => []),
    maxInputLength: Number.MAX_VALUE,
    ...overrides,
  };
  /** The request of the utterance at `index` (its callbacks are the engine's). */
  const at = (index: number): SpeakRequest => {
    const utterance = utterances[index];
    if (!utterance) throw new Error(`no utterance ${index}`);
    return utterance.request;
  };
  return { port, utterances, at };
}
