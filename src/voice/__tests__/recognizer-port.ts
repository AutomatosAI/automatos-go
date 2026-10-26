// A spy ModulePort for the recognizer tests (US-019b): every call recorded, every listener held so a
// test can play the module's events in the order the phone sends them.

import { vi } from 'vitest';

import type { RecognizerEvent, NativeEventName } from '../quick-ask/recognizer-events';
import { createRecognizer, type ModulePort } from '../quick-ask/recognizer-core';

type Listener = (payload: unknown) => void;

export function spyPort(overrides: Partial<ModulePort> = {}) {
  const listeners = new Map<NativeEventName, Listener>();
  const impl: ModulePort = {
    start: () => undefined,
    stop: () => undefined,
    abort: () => undefined,
    addListener: (name, listener) => {
      listeners.set(name, listener);
      return { remove: () => listeners.delete(name) };
    },
    supportsOnDeviceRecognition: () => true,
    isRecognitionAvailable: () => true,
    getSupportedLocales: async () => ({
      locales: ['en-GB', 'en-US', 'fr-FR'],
      installedLocales: ['en-GB'],
    }),
    androidTriggerOfflineModelDownload: async () => ({ status: 'download_success' }),
    ...overrides,
  };
  // Every entry a spy, overridden or not.
  const port = {
    start: vi.fn(impl.start),
    stop: vi.fn(impl.stop),
    abort: vi.fn(impl.abort),
    addListener: vi.fn(impl.addListener),
    supportsOnDeviceRecognition: vi.fn(impl.supportsOnDeviceRecognition),
    isRecognitionAvailable: vi.fn(impl.isRecognitionAvailable),
    getSupportedLocales: vi.fn(impl.getSupportedLocales),
    androidTriggerOfflineModelDownload: vi.fn(impl.androidTriggerOfflineModelDownload),
  };
  const emit = (name: NativeEventName, payload: unknown = null): void => {
    listeners.get(name)?.(payload);
  };
  return { port, listeners, emit };
}

/** A recognizer over a spy port, listened to: `heard` collects what quick-ask would hear. */
export function listening(overrides: Partial<ModulePort> = {}) {
  const spy = spyPort(overrides);
  const recognizer = createRecognizer(spy.port);
  const heard: RecognizerEvent[] = [];
  const unlisten = recognizer.listen((event) => heard.push(event));
  return { ...spy, recognizer, heard, unlisten };
}

export const result = (text: string, isFinal = false) => ({
  isFinal,
  results: text ? [{ transcript: text, confidence: 0.9, segments: [] }] : [],
});

export const voiced = (event: object) => ({ kind: 'voice', event });
