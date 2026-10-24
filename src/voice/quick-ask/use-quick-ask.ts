// Quick-ask on a screen (US-019g): the engine (quick-ask-engine.ts, where the flow lives) bound to
// the phone's recognizer, speaker and permission gate and to A2's chat controller. It only wires.
//   The thread is the caller's useThread (src/chat/controller/use-thread.ts) for the voice screen's
//   conversation: quick-ask sends through it and A2's Stop cancels through it, so there is never a
//   second chat request or stream; a typed turn on the same thread is never spoken (KV6).
//   The recognizer and the speaker take one listener each: this hook's, while the screen is mounted.
//   Mounting starts an AI-notice session (KV7); unmounting stops the mic and the speech, and the turn
//   runs on with nothing more spoken (A2 lets go of the read without a cancel).
//   The speech is in the phone's language (the one recognition listens in) with the voice picked
//   for it once (US-019d); until that voice is known, the engine's default for the language.
//   Nothing asks a permission at mount: only press() does (KV5).

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { useAppSession } from '../../app-state/session';
import { roleCan } from '../../auth/role';
import type { ThreadView } from '../../chat/controller/use-thread';
import { logger } from '../../lib/logger';
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
  /** The app went to the background: the next spoken reply greets again (US-019h). */
  readonly newSession: () => void;
};

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

/** One engine per screen, listening to the recognizer and the speaker while it is mounted. */
function useEngine(context: { readonly current: QuickAskContext }): QuickAsk {
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
  useEffect(() => {
    const unlistenRecognizer = recognizer.listen(engine.onRecognizer);
    const unlistenSpeaker = speaker.listen(engine.onSpeaker);
    engine.mount();
    return () => {
      unlistenRecognizer();
      unlistenSpeaker();
      engine.unmount();
    };
  }, [engine]);
  return engine;
}

/** Quick-ask over `thread`, the conversation the voice screen shows (A2's useThread). */
export function useQuickAsk(thread: ThreadView): QuickAskView {
  const context = useEngineContext(thread);
  const engine = useEngine(context);
  useEffect(() => engine.onThread(thread.state), [engine, thread.state]);
  const snapshot = useSyncExternalStore(engine.subscribe, engine.snapshot);
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
