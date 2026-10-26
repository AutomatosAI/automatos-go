// The recognizer on the phone (US-019b): createRecognizer (recognizer-core.ts, where the privacy
// rule lives) bound to ExpoSpeechRecognitionModule. One of the two files that import
// expo-speech-recognition (KV15; permissions.ts is the other). Thin on purpose: the module's
// functions, Platform and the phone's locale, nothing decided here.
//   probe() reads supportsOnDeviceRecognition(), isRecognitionAvailable(), Platform.Version and, on
//   Android, getSupportedLocales({}): no service package, so the on-device recognizer answers
//   (ExpoSpeechRecognitionModule.kt:373-450). policy() is recognitionPolicy over that probe.

import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionOptions,
} from 'expo-speech-recognition';
import { Platform } from 'react-native';

import { phoneLocale } from './locale';
import {
  recognitionPolicy,
  type OnDeviceOptions,
  type RecognitionPolicy,
  type RecognitionProbe,
} from './recognition-policy';
import { createRecognizer, type DeviceInfo, type ModulePort } from './recognizer-core';

/** The module's typed options: the literals in OnDeviceOptions must be its constants' values. */
function moduleOptions(options: OnDeviceOptions): ExpoSpeechRecognitionOptions {
  return {
    ...options,
    volumeChangeEventOptions: { ...options.volumeChangeEventOptions },
    iosCategory: {
      category: options.iosCategory.category,
      categoryOptions: [...options.iosCategory.categoryOptions],
    },
  };
}

const port: ModulePort = {
  start: (options) => ExpoSpeechRecognitionModule.start(moduleOptions(options)),
  stop: () => ExpoSpeechRecognitionModule.stop(),
  abort: () => ExpoSpeechRecognitionModule.abort(),
  addListener: (name, listener) => ExpoSpeechRecognitionModule.addListener(name, listener),
  supportsOnDeviceRecognition: () => ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
  isRecognitionAvailable: () => ExpoSpeechRecognitionModule.isRecognitionAvailable(),
  getSupportedLocales: () => ExpoSpeechRecognitionModule.getSupportedLocales({}),
  androidTriggerOfflineModelDownload: (options) =>
    ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: options.locale }),
};

const core = createRecognizer(port);

/** This phone: Android with its API level, else iOS (the app ships for nothing else). */
function device(): DeviceInfo {
  if (Platform.OS !== 'android') return { platform: 'ios' };
  const level = Number(Platform.Version);
  return Number.isFinite(level)
    ? { platform: 'android', androidApiLevel: level }
    : { platform: 'android' };
}

export const recognizer = Object.freeze({
  probe: (): Promise<RecognitionProbe> => core.probe(device(), phoneLocale()),
  policy: async (): Promise<RecognitionPolicy> =>
    recognitionPolicy(await core.probe(device(), phoneLocale())),
  start: core.start,
  stop: core.stop,
  abort: core.abort,
  downloadModel: core.downloadModel,
  listen: core.listen,
});
