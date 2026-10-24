// HUD's home (D54, 'Automatos Command HUD.dc.html', US-016k): the voice-first core over A2's one
// thread, talking to the same Auto as Studio's home. The transcript is the newest turn (hud-turn.ts:
// YOU the user's last message, AUTO the reply as plain text while it streams), opening with the AI
// label's caption (D73, Transcript); the chip and Auto are the mascot fed by the thread
// (use-home-thread.ts); STOP is A2's Stop, which cancels the turn on the server; TYPE opens A2's
// composer in a Sheet (the viewer's read-only copy and a disabled box come with it, D17), with the
// discussion bar for a ticket above it, and a send closes the sheet; 'COMMAND · N' opens the Board
// and LOOK the Looks drawer (HudCore); the menu square opens Settings. HOLD TO TALK stays inert
// until A6 (src/voice/quick-ask is not in this branch). First open is the core with an empty
// transcript and 'Say or type what you need.' (a blank draft's turn is EMPTY_TURN).

import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useNeedsYou } from '../../api/needs-you';
import { Composer } from '../../chat/composer/Composer';
import { DiscussionBar } from '../../chat/discussion/DiscussionBar';
import type { ChatFile } from '../../chat/request';
import { routes } from '../../navigation/routes';
import { Sheet } from '../../ui';
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
  const router = useRouter();
  const home = useHomeThread(chatId, ticketId);
  const { total } = useNeedsYou();
  const [typing, setTyping] = useState(false);
  const { state, stop } = home.thread;
  const turn = useMemo(() => hudTurn(state), [state]);
  const { sendMessage } = home;
  const close = useCallback(() => setTyping(false), []);
  const onSend = useCallback(
    (text: string, ready: readonly ChatFile[]) => {
      sendMessage(text, ready);
      setTyping(false);
    },
    [sendMessage],
  );
  return (
    <>
      <HudCore
        turn={turn}
        mascotState={home.mascot}
        micOpen={false}
        onType={() => setTyping(true)}
        onStop={stop}
        needsYou={total}
        onMenu={() => router.push(routes.settings)}
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
    </>
  );
}
