import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import type { UnavailableReason } from '../machine/voice-state';
import {
  recognitionPolicy,
  type RecognitionPolicy,
  type RecognitionProbe,
} from '../quick-ask/recognition-policy';
import { createRecognizer } from '../quick-ask/recognizer-core';
import { RECOGNIZER_EVENTS, type RecognizerEvent } from '../quick-ask/recognizer-events';
import { listening, result, spyPort, voiced } from './recognizer-port';

afterEach(() => {
  vi.restoreAllMocks();
});

const REASONS: readonly UnavailableReason[] = [
  'no-on-device',
  'android-too-old',
  'language-missing',
  'no-recognizer',
];

const IOS: RecognitionProbe = {
  platform: 'ios',
  supportsOnDevice: true,
  recognitionAvailable: true,
  locale: 'en-GB',
};
const ANDROID: RecognitionProbe = {
  platform: 'android',
  androidApiLevel: 34,
  supportsOnDevice: true,
  recognitionAvailable: true,
  locale: 'en-GB',
  supportedLocales: ['en-GB', 'fr-FR'],
  installedLocales: ['en-GB'],
};

/** Every refusal the policy gives on each platform, plus every reason built by hand. */
const REFUSALS: readonly RecognitionPolicy[] = [
  recognitionPolicy({ ...IOS, supportsOnDevice: false }),
  recognitionPolicy({ ...IOS, recognitionAvailable: false }),
  recognitionPolicy({ ...ANDROID, androidApiLevel: 32 }),
  recognitionPolicy({ ...ANDROID, supportsOnDevice: false }),
  recognitionPolicy({ ...ANDROID, supportsOnDevice: false, recognitionAvailable: false }),
  recognitionPolicy({ ...ANDROID, locale: 'ga-IE' }),
  recognitionPolicy({ ...ANDROID, locale: 'fr-FR' }),
  ...REASONS.map((reason): RecognitionPolicy => ({ kind: 'unavailable', reason })),
  { kind: 'download', locale: 'fr-FR' },
];

const FORBIDDEN_KEYS = ['androidRecognitionServicePackage', 'recordingOptions', 'audioSource'];

describe('createRecognizer — the privacy rule (KV4)', () => {
  it('covers every reason and the download on both platforms', () => {
    const kinds = new Set(REFUSALS.map((p) => (p.kind === 'unavailable' ? p.reason : p.kind)));
    expect([...kinds].sort()).toEqual([...REASONS, 'download'].sort());
  });

  it.each(REFUSALS.map((policy) => [JSON.stringify(policy), policy] as const))(
    'refuses %s with its copy key and never calls port.start',
    (_name, policy) => {
      const { port } = spyPort();
      const outcome = createRecognizer(port).start(policy);
      expect(outcome.kind).toBe('refused');
      if (outcome.kind !== 'refused' || policy.kind === 'ready') return;
      const expected =
        policy.kind === 'download'
          ? 'download'
          : policy.reason === 'android-too-old'
            ? 'androidTooOld'
            : 'notOnPhone';
      expect(outcome.copy).toBe(expected);
      expect(outcome.policy).toBe(policy);
      expect(port.start).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['iOS', recognitionPolicy(IOS)],
    ['Android', recognitionPolicy(ANDROID)],
  ])('starts a ready policy on %s once, on the phone', (_platform, policy) => {
    const { port } = spyPort();
    expect(createRecognizer(port).start(policy)).toEqual({ kind: 'started' });
    expect(port.start).toHaveBeenCalledTimes(1);
    const options = port.start.mock.calls[0]?.[0];
    expect(options?.requiresOnDeviceRecognition).toBe(true);
    expect(options?.lang).toBe('en-GB');
    for (const key of FORBIDDEN_KEYS) expect(options).not.toHaveProperty(key);
  });

  it('rebuilds the options: nothing smuggled into a ready policy reaches the module', () => {
    const { port } = spyPort();
    const tampered = {
      kind: 'ready',
      options: {
        lang: 'en-GB',
        requiresOnDeviceRecognition: false,
        androidRecognitionServicePackage: 'com.google.android.googlequicksearchbox',
        recordingOptions: { persist: true },
        audioSource: { uri: 'file:///tmp/a.wav' },
      },
    } as unknown as RecognitionPolicy;
    createRecognizer(port).start(tampered);
    const options = port.start.mock.calls[0]?.[0];
    expect(options?.requiresOnDeviceRecognition).toBe(true);
    expect(options?.lang).toBe('en-GB');
    for (const key of FORBIDDEN_KEYS) expect(options).not.toHaveProperty(key);
  });

  it('reports a start the module throws on as failed', () => {
    const { port } = spyPort({
      start: () => {
        throw new Error('no module');
      },
    });
    expect(createRecognizer(port).start(recognitionPolicy(IOS))).toEqual({ kind: 'failed' });
  });

  it('passes stop() and abort() through', () => {
    const { port } = spyPort();
    const recognizer = createRecognizer(port);
    recognizer.stop();
    recognizer.abort();
    expect(port.stop).toHaveBeenCalledTimes(1);
    expect(port.abort).toHaveBeenCalledTimes(1);
  });
});

describe('createRecognizer — probe', () => {
  it('on iOS reads the two checks and never the locale lists', async () => {
    const { port } = spyPort();
    const probe = await createRecognizer(port).probe({ platform: 'ios' }, 'en-GB');
    expect(probe).toEqual(IOS);
    expect(port.getSupportedLocales).not.toHaveBeenCalled();
  });

  it("on Android asks the on-device recognizer's languages, with no service package", async () => {
    const { port } = spyPort();
    const device = { platform: 'android', androidApiLevel: 34 } as const;
    const probe = await createRecognizer(port).probe(device, 'en-GB');
    expect(port.getSupportedLocales).toHaveBeenCalledTimes(1);
    expect(port.getSupportedLocales).toHaveBeenCalledWith();
    expect(probe).toEqual({ ...ANDROID, supportedLocales: ['en-GB', 'en-US', 'fr-FR'] });
    expect(recognitionPolicy(probe).kind).toBe('ready');
  });

  it('on Android without the on-device recognizer skips the lists', async () => {
    const { port } = spyPort({ supportsOnDeviceRecognition: () => false });
    const probe = await createRecognizer(port).probe(
      { platform: 'android', androidApiLevel: 34 },
      'en-GB',
    );
    expect(port.getSupportedLocales).not.toHaveBeenCalled();
    expect(recognitionPolicy(probe)).toEqual({ kind: 'unavailable', reason: 'no-on-device' });
  });

  it('reads a list that fails as empty: the language is missing, nothing starts', async () => {
    const { port } = spyPort({ getSupportedLocales: () => Promise.reject(new Error('error_5')) });
    const probe = await createRecognizer(port).probe(
      { platform: 'android', androidApiLevel: 34 },
      'en-GB',
    );
    expect(recognitionPolicy(probe)).toEqual({ kind: 'unavailable', reason: 'language-missing' });
  });

  it('reads a check that throws as no', async () => {
    const { port } = spyPort({
      supportsOnDeviceRecognition: () => {
        throw new Error('no context');
      },
    });
    const probe = await createRecognizer(port).probe({ platform: 'ios' }, 'en-GB');
    expect(probe.supportsOnDevice).toBe(false);
    expect(recognitionPolicy(probe).kind).toBe('unavailable');
  });
});

describe('createRecognizer — downloadModel', () => {
  it.each([
    ['download_success', 'downloaded'],
    ['opened_dialog', 'opened'],
    ['download_canceled', 'canceled'],
    ['something_else', 'failed'],
  ])('maps %s to %s', async (status, outcome) => {
    const { port } = spyPort({
      androidTriggerOfflineModelDownload: async () => ({ status }),
    });
    expect(await createRecognizer(port).downloadModel('fr-FR')).toBe(outcome);
  });

  it('asks for the locale it was given', async () => {
    const { port } = spyPort();
    await createRecognizer(port).downloadModel('fr-FR');
    expect(port.androidTriggerOfflineModelDownload).toHaveBeenCalledWith({ locale: 'fr-FR' });
  });

  it('reports a download that throws as failed', async () => {
    const { port } = spyPort({
      androidTriggerOfflineModelDownload: () => Promise.reject(new Error('not on iOS')),
    });
    expect(await createRecognizer(port).downloadModel('fr-FR')).toBe('failed');
  });
});

describe('createRecognizer — listen', () => {
  it('subscribes all eight events and removes them with one call', () => {
    const { port, listeners, unlisten } = listening();
    expect(port.addListener).toHaveBeenCalledTimes(RECOGNIZER_EVENTS.length);
    expect([...listeners.keys()].sort()).toEqual([...RECOGNIZER_EVENTS].sort());
    unlisten();
    expect(listeners.size).toBe(0);
  });

  it('keeps one listener: a second listen replaces the first', () => {
    const { recognizer, listeners, emit, heard } = listening();
    const second: unknown[] = [];
    recognizer.listen((event) => second.push(event));
    expect(listeners.size).toBe(RECOGNIZER_EVENTS.length);
    emit('volumechange', { value: 10 });
    expect(heard).toEqual([]);
    expect(second).toEqual([{ kind: 'level', level: 1 }]);
  });
});

describe('createRecognizer — a newer listener covers the older one (P001V-RVW-2)', () => {
  const LEVEL = { kind: 'level', level: 1 };

  /** A listens, then B: each with its own record and its own 'covered' spy. */
  function covering() {
    const spy = spyPort();
    const recognizer = createRecognizer(spy.port);
    const a: RecognizerEvent[] = [];
    const b: RecognizerEvent[] = [];
    const aCovered = vi.fn();
    const bCovered = vi.fn();
    const removeA = recognizer.listen((event) => a.push(event), aCovered);
    const removeB = recognizer.listen((event) => b.push(event), bCovered);
    const level = () => spy.emit('volumechange', { value: 10 });
    return { ...spy, recognizer, a, b, aCovered, bCovered, removeA, removeB, level };
  }

  it('tells A once that B covered it; B hears; once B is removed A hears again', () => {
    const { port, a, b, aCovered, bCovered, removeB, level } = covering();
    expect(aCovered).toHaveBeenCalledTimes(1);
    level();
    expect(b).toEqual([LEVEL]);
    expect(a).toEqual([]);
    removeB();
    level();
    expect(a).toEqual([LEVEL]);
    expect(b).toEqual([LEVEL]);
    expect(aCovered).toHaveBeenCalledTimes(1);
    expect(bCovered).not.toHaveBeenCalled();
    // One set of the module's listeners throughout: nothing is subscribed again.
    expect(port.addListener).toHaveBeenCalledTimes(RECOGNIZER_EVENTS.length);
  });

  it("gives A a hold's events once B is removed: MIC LIVE and the final at the end", () => {
    const { recognizer, emit, a, removeB } = covering();
    removeB();
    expect(recognizer.start(recognitionPolicy(IOS))).toEqual({ kind: 'started' });
    emit('start');
    emit('audiostart', { uri: null });
    emit('result', result('what is on', true));
    recognizer.stop();
    emit('audioend', { uri: null });
    emit('end');
    expect(a).toEqual([
      { kind: 'started' },
      voiced({ type: 'mic_open' }),
      voiced({ type: 'partial', text: 'what is on' }),
      voiced({ type: 'mic_closed' }),
      voiced({ type: 'final', text: 'what is on' }),
      { kind: 'ended' },
    ]);
  });

  it("leaves B hearing when A is removed under it; the module's listeners go with the last", () => {
    const { listeners, a, b, removeA, removeB, level } = covering();
    removeA();
    level();
    expect(b).toEqual([LEVEL]);
    expect(listeners.size).toBe(RECOGNIZER_EVENTS.length);
    removeB();
    expect(listeners.size).toBe(0);
    level();
    expect(a).toEqual([]);
    expect(b).toEqual([LEVEL]);
  });

  it('is harmless to remove twice: A keeps hearing, and is not told again', () => {
    const { listeners, a, aCovered, removeA, removeB, level } = covering();
    removeB();
    removeB();
    level();
    expect(a).toEqual([LEVEL]);
    expect(aCovered).toHaveBeenCalledTimes(1);
    removeA();
    removeA();
    expect(listeners.size).toBe(0);
  });

  it('logs a covered listener that throws, and the newer listener still hears', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const { port, emit } = spyPort();
    const recognizer = createRecognizer(port);
    const thrown = () => {
      throw new Error('gone');
    };
    recognizer.listen(() => undefined, thrown);
    const second: RecognizerEvent[] = [];
    recognizer.listen((event) => second.push(event));
    expect(warn).toHaveBeenCalledTimes(1);
    emit('volumechange', { value: 10 });
    expect(second).toEqual([LEVEL]);
  });
});
