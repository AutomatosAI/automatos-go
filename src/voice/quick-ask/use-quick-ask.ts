// Quick-ask on a screen (US-019g): the engine (quick-ask-engine.ts, where the flow lives) bound to
// the phone's recognizer, speaker and permission gate and to A2's chat controller. It only wires.
//   The thread is the caller's useThread (src/chat/controller/use-thread.ts) for the voice screen's
//   conversation: quick-ask sends through it and A2's Stop cancels through it, so there is never a
//   second chat request or stream; a typed turn on the same thread is never spoken (KV6).
//   The recognizer and the speaker take one listener each (a stack: the newest hears): this hook's,
//   while the screen is mounted (scope 'mounted', the voice screen) or, for HUD's home (scope
//   'focused', US-019k), only while it is the screen on top. Covered, it leaves as the app going to
//   the background does (the interruption policy's 'covered'); on top again, it is a new session.
//   The voice screen is covered only when another screen's engine takes a listener (a
//   conversation's HUD home pushed over it, P001V-RVW-2), and hears again when that one detaches; a
//   /cc or look page over it takes nothing, and its speech goes on (US-019j). Attaching starts an
//   AI-notice session (KV7); detaching stops the mic and the speech, and the turn runs on with
//   nothing more spoken (A2 lets go of the read without a cancel).
//   The speech is in the language recognition listens in ("I speak", language/speak-language.ts:
//   the phone's when Automatic) with the voice picked for it (US-019d): the one Settings → Voice saved while the phone offers it, else the phone's
//   best; until that voice is known, the engine's default for the language. The saved rate and
//   pitch go with it. The setting is a store every reader hears (use-voice-setting.ts), so a change
//   re-renders this hook and the next reply speaks with it. A change of language tells the engine
//   (languageChanged): a refusal about the old language goes, and the next press checks the new.
//   Each language has its own voice choice (language/language-voice.ts): the phone voice is the
//   language's saved one, and the device fallback speaks in that language with it.
//   Auto's server voice (27 Oct 2026): when the server lists tts and the person keeps Auto's voice,
//   the speech also carries the server voice (serverSpeechFor: the saved server voice while the
//   server's list offers it, else its default; the saved speed; the session's client), and the one
//   voice out (voice-out.ts) speaks each sentence through the server, the phone's voice taking over
//   the rest of a turn the server fails. Without tts the speech carries none: as before.
//   Nothing asks a permission at mount: only press() does (KV5).
//   Leaving the screen goes through the interruption policy (use-interruptions.ts, US-019h), and the
//   screen stays on while the mic is open or a reply is under way (keep-awake.ts, KV12).

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { useAppSession } from '../../app-state/session';
import { roleCan } from '../../auth/role';
import type { ThreadView } from '../../chat/controller/use-thread';
import { logger } from '../../lib/logger';
import { COVERED } from '../interruptions/interruption-policy';
import { useVoiceKeepAwake } from '../interruptions/keep-awake';
import { useInterruptions } from '../interruptions/use-interruptions';
import { permissions } from '../permissions/permissions';
import { useVoiceSetting } from '../settings/use-voice-setting';
import { speakOptionsFor } from '../settings/voice-setting';
import { serverSpeechFor } from '../server/server-voices';
import { useServerVoices } from '../server/use-server-voices';
import { spokenLanguage, type SpokenLanguage } from '../language/language-voice';
import { usePhoneLocale } from '../language/use-speak-language';
import { voiceOut } from '../speech/voice-out';
import {
  createQuickAsk,
  type QuickAsk,
  type QuickAskContext,
  type QuickAskSnapshot,
} from './quick-ask-engine';
import { recognizer } from './recognizer';

export type QuickAskView = QuickAskSnapshot & {
  /** HOLD TO TALK pressed in (or tapped, under a screen reader, to talk). */
  readonly press: () => void;
  /** HOLD TO TALK let go of (or tapped again, under a screen reader, to send). */
  readonly release: () => void;
  readonly stop: () => void;
  readonly download: () => void;
  /** A new AI-notice session: the next spoken reply greets again (KV7). */
  readonly newSession: () => void;
};

/**
 * When the engine holds the recognizer's and the speaker's one listener: from mount to unmount (the
 * voice screen), or only while the screen is the one on top (HUD's home).
 */
export type QuickAskScope = 'mounted' | 'focused';

function later(run: () => void, ms: number): () => void {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
}

/**
 * The phone's voice for its language: the saved one while the phone offers it, else its best, picked
 * again when the saved one changes; undefined until then (the engine's default).
 */
function usePhoneVoice(language: string, saved: string | null): string | undefined {
  const [voice, setVoice] = useState<string | undefined>(undefined);
  useEffect(() => {
    let current = true;
    voiceOut.voiceFor(language, saved).then(
      (picked) => {
        if (current) setVoice(picked);
      },
      (error: unknown) => logger.warn('[voice] no voice was picked', error),
    );
    return () => {
      current = false;
    };
  }, [language, saved]);
  return voice;
}

/**
 * "I speak"'s locale, the server's voices for it and its voice choice as spoken (spokenLanguage):
 * English as before, Portuguese (Brazil) in a pt-BR server voice (the phone's pt-BR voice when the
 * server has none).
 */
function useSpokenLanguage(): SpokenLanguage {
  const phone = usePhoneLocale();
  const setting = useVoiceSetting();
  const voices = useServerVoices();
  return spokenLanguage(setting, phone, voices);
}

type EngineContext = {
  readonly latest: { readonly current: QuickAskContext };
  /** The language it listens and speaks in. */
  readonly language: string;
};

/** What the engine reads at each event: this render's thread, role, discovery and speech. */
function useEngineContext(thread: ThreadView): EngineContext {
  const { discovery, workspace, client } = useAppSession();
  const { language, voices, setting } = useSpokenLanguage();
  const voice = usePhoneVoice(language, setting.voice);
  const server = serverSpeechFor({ discovery, setting, voices, client });
  const context: QuickAskContext = {
    thread,
    roleCanChat: roleCan(workspace.role, 'chat'),
    discovery,
    speech: speakOptionsFor(language, voice, setting, server),
  };
  const latest = useRef(context);
  useEffect(() => {
    latest.current = context;
  });
  return { latest, language };
}

/** One engine per screen, listening to the recognizer and the speaker while its scope holds. */
function useEngine(context: { readonly current: QuickAskContext }, scope: QuickAskScope): QuickAsk {
  const engine = useMemo(
    () =>
      createQuickAsk({
        recognizer,
        speaker: voiceOut,
        permissions,
        context: () => context.current,
        now: Date.now,
        later,
      }),
    [context],
  );
  const attach = useCallback(() => engine.attach({ recognizer, speaker: voiceOut }), [engine]);
  useEffect(() => (scope === 'mounted' ? attach() : undefined), [attach, scope]);
  useFocusEffect(
    useCallback(() => {
      if (scope !== 'focused') return undefined;
      const detach = attach();
      return () => {
        engine.interrupt(COVERED);
        detach();
      };
    }, [attach, engine, scope]),
  );
  return engine;
}

/** Quick-ask over `thread`, the conversation the screen shows (A2's useThread). */
export function useQuickAsk(thread: ThreadView, scope: QuickAskScope = 'mounted'): QuickAskView {
  const { latest, language } = useEngineContext(thread);
  const engine = useEngine(latest, scope);
  useEffect(() => engine.onThread(thread.state), [engine, thread.state]);
  useEffect(() => engine.languageChanged(), [engine, language]);
  useInterruptions(engine.interrupt);
  const snapshot = useSyncExternalStore(engine.subscribe, engine.snapshot);
  useVoiceKeepAwake(snapshot.voice);
  return useMemo(
    () => ({
      ...snapshot,
      press: () => void engine.press(),
      release: engine.release,
      stop: engine.stop,
      download: () => void engine.download(),
      newSession: engine.newSession,
    }),
    [snapshot, engine],
  );
}
