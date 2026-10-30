// Quick-ask on Arcade's home (US-022g, D-ARC-6): hold to talk in the voice surround, over the home's
// own thread, wired as HUD's home wires it (use-hud-home-voice.ts, US-019k); what shows is
// arcade-home-voice.ts's, every word voiceView's (KV8).
//   The engine is useQuickAsk's over A2's thread the home holds (useHomeThread: its send carries the
//   discussed ticket), so the voice sends and stops through A2 and never a second request. Its scope
//   is 'focused': it hears the recognizer and the speaker only while the home is the screen on top.
//   Permissions are asked only by a press (KV5), never read at mount.
//   Auto's portrait listens while the mic is open: the driver hears 'input-focus' when the capture
//   opens and 'input-blur' when it closes, as it does for a focused box.
//   A typed send (TYPE's sheet) makes the thread's turn the newest again (typed()).
//   The EN/PT switch for someone who may talk (useLanguageSwitch).
//   Arcade draws no waveform and no transcript turn, so neither is read here.

import { useCallback, useEffect, useRef, useState } from 'react';

import { roleCan } from '../../auth/role';
import { canStop } from '../../chat/controller/thread';
import type { ChipView, HudLanguage, HudTalk } from '../../styles/hud/core/model';
import type { HomeThread } from '../../styles/homes/use-home-thread';
import type { MascotController } from '../../styles/mascot/use-mascot';
import { useListening } from '../language/use-speak-language';
import { useLanguageSwitch } from '../language/use-language-switch';
import { permissions } from '../permissions/permissions';
import { useQuickAsk, type QuickAskView } from '../quick-ask/use-quick-ask';
import type { HoldHandlers, VoiceLine } from '../screen/core-props';
import { useHold, useScreenReader } from '../screen/use-voice-parts';
import { voiceView, type MessageAction } from '../screen/voice-view-model';
import { arcadeHomeVoice } from './arcade-home-voice';
import { stopsThread, type HomeShows } from './hud-home-voice';

export type ArcadeHomeVoice = {
  readonly talk: HudTalk;
  /** The recognizer's capture is open. */
  readonly micOpen: boolean;
  /** The voice's state words while it works or has a line; null while Auto's portrait says it. */
  readonly caption: ChipView | null;
  readonly line: VoiceLine | null;
  readonly lineAction: (action: MessageAction) => void;
  /** The EN/PT switch for someone who may talk; absent otherwise. */
  readonly language?: HudLanguage;
  /** STOP is on: the voice works or a typed turn streams. */
  readonly stopEnabled: boolean;
  /** Quick-ask's stop, and A2's for a typed turn. */
  readonly stop: () => void;
  /** A typed send: the thread's turn is the newest again. */
  readonly typed: () => void;
};

/** Auto listens while the capture is open, as he does for a focused box; told on each change. */
function useListeningMascot(micOpen: boolean, mascot: MascotController): void {
  const seen = useRef(micOpen);
  const { send } = mascot;
  useEffect(() => {
    if (seen.current === micOpen) return;
    seen.current = micOpen;
    send({ type: micOpen ? 'input-focus' : 'input-blur' });
  }, [micOpen, send]);
}

/** Hold to talk's hold; each press makes the voice's turn the newest. */
function useHomeHold(quick: QuickAskView, show: (shows: HomeShows) => void): HoldHandlers {
  const { press: pressQuick, release, voice } = quick;
  const press = useCallback(() => {
    show('voice');
    pressQuick();
  }, [show, pressQuick]);
  return useHold({ press, release, voice });
}

/** STOP (quick-ask's, and A2's unless quick-ask's own turn streams) and the line's button. */
function useHomeActions(quick: QuickAskView, home: HomeThread) {
  const { stop: stopQuick, download, voice } = quick;
  const { stop: stopThread } = home.thread;
  const typedToo = stopsThread(voice);
  const stop = useCallback(() => {
    stopQuick();
    if (typedToo) stopThread();
  }, [stopQuick, stopThread, typedToo]);
  const lineAction = useCallback(
    (action: MessageAction) => {
      if (action === 'openSettings') permissions.openSettings();
      else if (action === 'download') download();
    },
    [download],
  );
  return { stop, lineAction };
}

/** Quick-ask on Arcade's home over `home`'s thread. */
export function useArcadeHomeVoice(home: HomeThread): ArcadeHomeVoice {
  const { thread, mascot } = home;
  const quick = useQuickAsk(thread, 'focused');
  const [shows, setShows] = useState<HomeShows>('thread');
  const screenReader = useScreenReader();
  const { listening } = useListening();
  const mayTalk = roleCan(home.role, 'chat');
  const language = useLanguageSwitch(mayTalk);
  const hold = useHomeHold(quick, setShows);
  const { stop, lineAction } = useHomeActions(quick, home);
  const typed = useCallback(() => setShows('thread'), []);
  const view = voiceView({
    state: quick.voice,
    policy: quick.policy,
    permission: quick.permission,
    roleCanChat: mayTalk,
    screenReader,
    mascotState: mascot.driver.mascot.mascot,
    locale: listening,
    reply: quick.reply,
    failure: thread.state.failure,
  });
  const shown = arcadeHomeVoice({
    view,
    state: quick.voice,
    shows,
    threadStreams: canStop(thread.state),
    hold,
  });
  useListeningMascot(shown.micOpen, mascot);
  return { ...shown, lineAction, ...(language ? { language } : {}), stop, typed };
}
