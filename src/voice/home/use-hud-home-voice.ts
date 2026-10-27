// Quick-ask on HUD's home (US-019k): HOLD TO TALK in place, over the home's own thread. It only
// wires; what the core shows is hud-home-voice.ts's, every word voiceView's (KV8).
//   The engine is useQuickAsk's over A2's thread the home holds (useHomeThread: its send carries the
//   discussed ticket), so the voice sends and stops through A2 and never a second request. Its scope
//   is 'focused': it hears the recognizer and the speaker only while the home is the screen on top.
//   Permissions are asked only by a press (KV5) and, unlike the voice screen, not read at mount: the
//   home says nothing of the microphone until someone holds to talk.
//   Auto in the core listens while the mic is open: A5's driver hears 'input-focus' when the capture
//   opens and 'input-blur' when it closes, as it does for a focused box.
//   A typed send (HudHome's TYPE sheet) makes the thread's turn the newest again (typed()).
//   Report this on the voice's reply: its saved message (voiceReportId), read per thread change.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { roleCan } from '../../auth/role';
import { canStop } from '../../chat/controller/thread';
import type { HudTurn } from '../../styles/hud/core/model';
import type { HomeThread } from '../../styles/homes/use-home-thread';
import type { MascotController } from '../../styles/mascot/use-mascot';
import { permissions } from '../permissions/permissions';
import { useListening } from '../language/use-speak-language';
import { useQuickAsk, type QuickAskView } from '../quick-ask/use-quick-ask';
import { voiceReportId, type HoldHandlers, type VoiceLine } from '../screen/core-props';
import { useHold, useLevels, useScreenReader } from '../screen/use-voice-parts';
import { voiceView, type MessageAction } from '../screen/voice-view-model';
import { hudHomeVoice, stopsThread, type HomeShows, type HudHomeVoice } from './hud-home-voice';

export type HudHomeVoiceModel = {
  readonly turn: HudTurn;
  readonly micOpen: boolean;
  readonly levels: readonly number[] | null;
  /** HudCore's quickAsk but the line, which the home draws (VoiceLine). */
  readonly core: Pick<HudHomeVoice, 'talk' | 'stopEnabled' | 'chip'>;
  readonly line: VoiceLine | null;
  readonly lineAction: (action: MessageAction) => void;
  /** STOP: quick-ask's, and A2's for a typed turn. */
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

/** HOLD TO TALK's hold; each press makes the voice's turn the newest. */
function useHomeHold(quick: QuickAskView, show: (shows: HomeShows) => void): HoldHandlers {
  const { press: pressQuick, release, voice } = quick;
  const press = useCallback(() => {
    show('voice');
    pressQuick();
  }, [show, pressQuick]);
  return useHold({ press, release, voice });
}

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

/** Quick-ask on HUD's home over `home`'s thread; `threadTurn` is the home's own (hudTurn). */
export function useHudHomeVoice(home: HomeThread, threadTurn: HudTurn): HudHomeVoiceModel {
  const { thread, mascot } = home;
  const quick = useQuickAsk(thread, 'focused');
  const [shows, setShows] = useState<HomeShows>('thread');
  const screenReader = useScreenReader();
  const { listening, phone } = useListening();
  const levels = useLevels(quick.level);
  const hold = useHomeHold(quick, setShows);
  const { stop, lineAction } = useHomeActions(quick, home);
  const typed = useCallback(() => setShows('thread'), []);
  const replyId = useMemo(
    () => voiceReportId(thread.state, quick.reply),
    [thread.state, quick.reply],
  );
  const view = voiceView({
    state: quick.voice,
    policy: quick.policy,
    permission: quick.permission,
    roleCanChat: roleCan(home.role, 'chat'),
    screenReader,
    mascotState: mascot.driver.mascot.mascot,
    locale: listening,
    phoneLocale: phone,
    reply: quick.reply,
    failure: thread.state.failure,
  });
  const shown = hudHomeVoice({
    view,
    state: quick.voice,
    reply: quick.reply,
    threadTurn,
    shows,
    threadStreams: canStop(thread.state),
    hold,
    replyId,
  });
  useListeningMascot(shown.micOpen, mascot);
  const { turn, micOpen, talk, stopEnabled, chip, line } = shown;
  return {
    turn,
    micOpen,
    levels,
    core: { talk, stopEnabled, chip },
    line,
    lineAction,
    stop,
    typed,
  };
}
