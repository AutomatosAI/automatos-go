// Quick-ask on a screen (US-019g): the engine (quick-ask-engine.ts, where the flow lives) bound to
// the phone's recognizer, speaker and permission gate and to A2's chat controller. It only wires.
//   The thread is the caller's useThread (src/chat/controller/use-thread.ts) for the voice screen's
//   conversation: quick-ask sends through it and A2's Stop cancels through it, so there is never a
//   second chat request or stream; a typed turn on the same thread is never spoken (KV6).
//   The recognizer and the speaker take one listener each: this hook's, while the screen is mounted
//   (scope 'mounted', the voice screen) or, for HUD's home (scope 'focused', US-019k), only while it
//   is the screen on top: a conversation's HUD home or the voice screen can stack over it, and a
//   home under them would otherwise lose the listener for good when they go. Covered, it leaves as
//   the app going to the background does (the interruption policy's 'covered'); on top again, it is
//   a new session. Attaching starts an AI-notice session (KV7); detaching stops the mic and the
//   speech, and the turn runs on with nothing more spoken (A2 lets go of the read without a cancel).
//   The speech is in the phone's language (the one recognition listens in) with the voice picked
//   for it once (US-019d); until that voice is known, the engine's default for the language.
//   Nothing asks a permission at mount: only press() does (KV5).
//   Leaving the screen goes through the interruption policy (use-interruptions.ts, US-019h), and the
//   screen stays on while the mic is open or a reply is under way (keep-awake.ts, KV12).

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { useAppSession } from '../../app-state/session';
import { roleCan } from '../../auth/role';
import type { ThreadView } from '../../chat/controller/use-thread';
import { logger } from '../../lib/logger';
import type { InterruptionEvent } from '../interruptions/interruption-policy';
import { useVoiceKeepAwake } from '../interruptions/keep-awake';
import { useInterruptions } from '../interruptions/use-interruptions';
import { permissions } from '../permissions/permissions';
import { speaker } from '../speech/speaker';
import { phoneLocale } from './locale';
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

const COVERED: InterruptionEvent = Object.freeze({ type: 'covered' });

function later(run: () => void, ms: number): () => void {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
}

/** The phone's voice for its language, picked once; undefined until then (the engine's default). */
function usePhoneVoice(language: string): string | undefined {
  const [voice, setVoice] = useState<string | undefined>(undefined);
  useEffect(() => {
    let current = true;
    speaker.voiceFor(language).then(
      (picked) => {
        if (current) setVoice(picked);
      },
      (error: unknown) => logger.warn('[voice] no voice was picked', error),
    );
    return () => {
      current = false;
    };
  }, [language]);
  return voice;
}

/** What the engine reads at each event: this render's thread, role, discovery and speech. */
function useEngineContext(thread: ThreadView): { readonly current: QuickAskContext } {
  const { discovery, workspace } = useAppSession();
  const language = useMemo(() => phoneLocale(), []);
  const voice = usePhoneVoice(language);
  const context: QuickAskContext = {
    thread,
    roleCanChat: roleCan(workspace.role, 'chat'),
    discovery,
    speech: voice === undefined ? { language } : { language, voice },
  };
  const latest = useRef(context);
  useEffect(() => {
    latest.current = context;
  });
  return latest;
}

/** One engine per screen, listening to the recognizer and the speaker while its scope holds. */
function useEngine(context: { readonly current: QuickAskContext }, scope: QuickAskScope): QuickAsk {
  const engine = useMemo(
    () =>
      createQuickAsk({
        recognizer,
        speaker,
        permissions,
        context: () => context.current,
        now: Date.now,
        later,
      }),
    [context],
  );
  const attach = useCallback(() => {
    const unlistenRecognizer = recognizer.listen(engine.onRecognizer);
    const unlistenSpeaker = speaker.listen(engine.onSpeaker);
    engine.mount();
    return () => {
      unlistenRecognizer();
      unlistenSpeaker();
      engine.unmount();
    };
  }, [engine]);
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
  const context = useEngineContext(thread);
  const engine = useEngine(context, scope);
  useEffect(() => engine.onThread(thread.state), [engine, thread.state]);
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
