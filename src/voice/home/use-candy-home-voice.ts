// Quick-ask on Candy's home (US-023g, D-CAN-6): hold to talk in the tab bar's raised centre, over
// the home's own thread, wired as Arcade's home wires it (use-arcade-home-voice.ts, HUD's
// use-hud-home-voice.ts before it); what shows is candy-home-voice.ts's, every word voiceView's (KV8).
//   The engine is useQuickAsk's over A2's thread the home holds (useHomeThread: its send carries the
//   discussed ticket), so the voice sends and stops through A2 and never a second request. Its scope
//   is 'focused': it hears the recognizer and the speaker only while the home is the screen on top.
//   Permissions are asked only by a press (KV5), never read at mount.
//   Auto listens while the mic is open: the driver hears 'input-focus' when the capture opens and
//   'input-blur' when it closes, as it does for a focused box; the stage reads the voice's phase too
//   (candy/auto/stage.ts stageOf), so `stage` hands it on.
//   A typed send (the Chat view's composer, US-023h) makes the thread's turn the newest again
//   (typed()). 'See it in the chat' opens the Chat view (`openChat`).
//   A viewer gets no voice (`available` false, voiceEntry's rule) and no EN/PT switch.
//   HUD's and Arcade's hooks are not this wave's to edit, so their private helpers are mirrored here.

import { useCallback, useEffect, useRef, useState } from 'react';

import { roleCan } from '../../auth/role';
import { canStop } from '../../chat/controller/thread';
import type { StageVoice } from '../../styles/candy/auto/stage';
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
import { candyHomeVoice } from './candy-home-voice';
import { stopsThread, type HomeShows } from './hud-home-voice';

export type CandyHomeVoice = {
  /** Someone who may talk (roleCan 'chat'): only then is there a voice to draw. */
  readonly available: boolean;
  readonly talk: HudTalk;
  /** The recognizer's capture is open. */
  readonly micOpen: boolean;
  /** The voice's phase and capture, for Auto's stage. */
  readonly stage: StageVoice;
  /** The voice's state words while it works or has a line; null while it is quiet. */
  readonly caption: ChipView | null;
  readonly line: VoiceLine | null;
  readonly lineAction: (action: MessageAction) => void;
  /** The EN/PT switch for someone who may talk; absent otherwise. */
  readonly language?: HudLanguage;
  /** Stop is on: the voice works or a typed turn streams. */
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

/** Stop (quick-ask's, and A2's unless quick-ask's own turn streams) and the line's button. */
function useHomeActions(quick: QuickAskView, home: HomeThread, openChat: () => void) {
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
      else if (action === 'openChat') openChat();
    },
    [download, openChat],
  );
  return { stop, lineAction };
}

/** Quick-ask on Candy's home over `home`'s thread; `openChat` shows the Chat view. */
export function useCandyHomeVoice(home: HomeThread, openChat: () => void): CandyHomeVoice {
  const { thread, mascot } = home;
  const quick = useQuickAsk(thread, 'focused');
  const [shows, setShows] = useState<HomeShows>('thread');
  const screenReader = useScreenReader();
  const { listening } = useListening();
  const mayTalk = roleCan(home.role, 'chat');
  const language = useLanguageSwitch(mayTalk);
  const hold = useHomeHold(quick, setShows);
  const { stop, lineAction } = useHomeActions(quick, home, openChat);
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
  const shown = candyHomeVoice({
    view,
    state: quick.voice,
    shows,
    threadStreams: canStop(thread.state),
    hold,
  });
  useListeningMascot(shown.micOpen, mascot);
  const stage = { phase: quick.voice.phase, micOpen: quick.voice.micOpen };
  return {
    ...shown,
    available: mayTalk,
    stage,
    lineAction,
    ...(language ? { language } : {}),
    stop,
    typed,
  };
}
