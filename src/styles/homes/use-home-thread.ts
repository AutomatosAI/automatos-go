// Play's and HUD's homes over A2's one thread (US-016k): it only wires, as A2's ChatScreen wires
// Studio's. useThread holds the conversation (checked before reuse); a conversation about a ticket
// carries it in every message and holds the send until it is in (useDiscussion); files go with the
// words (useAttachments); the composer is the role's (A2's composerState). Auto is fed by the same
// thread: each frame of the read through useThread's onFrame (US-017a's chat-events), and how the
// thread's state moved through mascot-feed.ts, told in a layout effect so a send reaches him
// before the first frame of its read can.

import { useCallback, useLayoutEffect, useRef } from 'react';

import type { WorkspaceRole } from '../../api/workspace';
import { useAppSession } from '../../app-state/session';
import { useAttachments, type AttachmentsView } from '../../chat/attachments/use-attachments';
import { canStop, type ThreadState } from '../../chat/controller/thread';
import { useThread, type ThreadSendInput, type ThreadView } from '../../chat/controller/use-thread';
import { discussionInput } from '../../chat/discussion/discussion';
import { useDiscussion, type DiscussionState } from '../../chat/discussion/use-discussion';
import type { ChatFile } from '../../chat/request';
import { useMascot, type MascotController } from '../mascot/use-mascot';
import { threadMascotEvents } from './mascot-feed';

export type HomeThread = {
  /** A2's thread, its send carrying the discussed ticket. */
  readonly thread: ThreadView;
  readonly mascot: MascotController;
  readonly discussion: DiscussionState;
  readonly files: AttachmentsView;
  readonly role: WorkspaceRole | null | undefined;
  /** A turn runs (A2's canStop): the composer's button is Stop. */
  readonly working: boolean;
  /** The send waits: the chat still opens, a turn settles, or the ticket is not in yet. */
  readonly holding: boolean;
  /** The composer's send: the trimmed words and the ready files. */
  readonly sendMessage: (text: string, files: readonly ChatFile[]) => void;
};

/** Auto hears how the thread moved, each change once, before the screen paints it. */
function useThreadMascot(state: ThreadState, mascot: MascotController): void {
  const seen = useRef(state);
  const { send } = mascot;
  useLayoutEffect(() => {
    const previous = seen.current;
    seen.current = state;
    threadMascotEvents(previous, state).forEach((event) => send(event));
  }, [state, send]);
}

export function useHomeThread(chatId: string | null, ticketId: string | null): HomeThread {
  const mascot = useMascot();
  const opened = useThread(chatId, mascot.sendFrame);
  useThreadMascot(opened.state, mascot);
  const discussion = useDiscussion(ticketId);
  const files = useAttachments();
  const { workspace } = useAppSession();
  const { state, send: sendTurn } = opened;
  const about = discussion.discussion;
  const send = useCallback(
    (input: ThreadSendInput) => sendTurn(discussionInput(input, about)),
    [sendTurn, about],
  );
  const sendMessage = useCallback(
    (text: string, ready: readonly ChatFile[]) => send({ text, files: ready }),
    [send],
  );
  return {
    thread: { ...opened, send },
    mascot,
    discussion,
    files,
    role: workspace.role,
    working: canStop(state),
    holding: state.status === 'loading' || state.settling || discussion.holds,
    sendMessage,
  };
}
