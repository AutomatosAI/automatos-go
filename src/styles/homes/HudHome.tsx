// HUD's home (D54, 'Automatos Command HUD.dc.html', US-016k): the voice-first core over A2's one
// thread, talking to the same Auto as Studio's home. The transcript is the newest turn (hud-turn.ts:
// YOU the user's last message, AUTO the reply as plain text while it streams), opening with the AI
// label's caption (D73, Transcript); the chip and Auto are the mascot fed by the thread
// (use-home-thread.ts); STOP is A2's Stop, which cancels the turn on the server; TYPE opens A2's
// composer in a Sheet (the viewer's read-only copy and a disabled box come with it, D17), with the
// discussion bar for a ticket above it, and a send closes the sheet; 'COMMAND · N' opens the Board
// and LOOK the Looks drawer (HudCore). The menu square opens Studio's header menu itself (D73:
// HomeMenu over menu.ts MENU_ITEMS, New chat, Chats, the Command Centre with the needs-you number,
// Settings; useHomeMenu slides it away before a row's screen opens), the foundation's Sheet in HUD's
// dress; a blank draft is already New chat (menuHere), so that row only closes the menu. First open
// is the core with an empty transcript and 'Say or type what you need.' (a blank draft's turn is
// EMPTY_TURN).
//   HOLD TO TALK is A6's quick-ask in place (US-019k, useHudHomeVoice over this thread): MIC LIVE,
// the waveform, the voice's turn in the transcript from a press until a typed send, the voice's chip
// and line while it works, and STOP stopping the speech too (and A2's turn, typed or spoken).
//   An approval (PRD-268 US-G08, src/approvals/use-hud-approval.tsx): HUD draws no thread cards, so
// a card waiting with an ApprovalView opens its answer sheet by itself, once; closed unanswered,
// '◆ WAITING FOR YOU · OPEN' under the state chip opens it again.
//   Report this (D15, P001R-AF-1): a long-press or the accessible action on Auto's saved reply in the
// transcript opens the foundation's one ReportSheet (A2's useMessageReport), mounted once beside
// TYPE's Sheet, never inside it.

import { useCallback, useMemo, useState } from 'react';

import { useNeedsYou } from '../../api/needs-you';
import { Composer } from '../../chat/composer/Composer';
import { DiscussionBar } from '../../chat/discussion/DiscussionBar';
import { HomeMenu } from '../../chat/home/HomeMenu';
import { useHudApproval } from '../../approvals/use-hud-approval';
import { menuHere } from '../../chat/home/menu';
import { useHomeMenu } from '../../chat/home/use-home-menu';
import { useMessageReport } from '../../chat/report/use-message-report';
import type { ChatFile } from '../../chat/request';
import { ReportSheet, Sheet } from '../../ui';
import { useHudHomeVoice } from '../../voice/home/use-hud-home-voice';
import { VoiceLine } from '../../voice/screen/VoiceLine';
import { HudCore } from '../hud/core/HudCore';
import { hudTurn } from './hud-turn';
import { useHomeThread } from './use-home-thread';

export type HudHomeProps = {
  /** The conversation to open (checked first), or null for a draft. */
  readonly chatId: string | null;
  /** The ticket a new conversation discusses; none by default. */
  readonly ticketId?: string | null;
};

export function HudHome({ chatId, ticketId = null }: HudHomeProps) {
  const home = useHomeThread(chatId, ticketId);
  const { total } = useNeedsYou();
  const [typing, setTyping] = useState(false);
  const { state, stop } = home.thread;
  const menu = useHomeMenu(menuHere(state, ticketId));
  const approval = useHudApproval(state, home.thread.settleCard);
  const turn = useMemo(() => hudTurn(state), [state]);
  const voice = useHudHomeVoice(home, turn);
  const { report, sheet } = useMessageReport();
  const { sendMessage } = home;
  const { typed } = voice;
  const close = useCallback(() => setTyping(false), []);
  const onSend = useCallback(
    (text: string, ready: readonly ChatFile[]) => {
      sendMessage(text, ready);
      typed();
      setTyping(false);
    },
    [sendMessage, typed],
  );
  return (
    <>
      <HudCore
        turn={voice.turn}
        mascotState={home.mascot}
        micOpen={voice.micOpen}
        onType={() => setTyping(true)}
        onStop={voice.stop}
        needsYou={total}
        onMenu={menu.open}
        levels={voice.levels}
        underChip={approval.line}
        quickAsk={{
          ...voice.core,
          line: <VoiceLine line={voice.line} onAction={voice.lineAction} />,
        }}
        report={report}
      />
      <Sheet visible={typing} onClose={close}>
        <DiscussionBar state={home.discussion} messages={state.messages} />
        <Composer
          role={home.role}
          streaming={home.working}
          loading={home.holding}
          files={home.files}
          onSend={onSend}
          onStop={stop}
        />
      </Sheet>
      <HomeMenu menu={menu} needsYou={total} />
      <ReportSheet {...sheet} />
    </>
  );
}
