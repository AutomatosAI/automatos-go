// One conversation on screen, shared by home and app/(app)/chat/[id].tsx: the header, the thread
// (US-008c's rows over useThread, US-008b) and the composer (US-009a). It only wires. The chat id
// is checked before reuse (D-STALE-CHAT); null is a draft. Try again asks the user's last message
// anew (retryInput); Auto's cards settle on the thread (settleCard); links open through the
// foundation's mapping (useFollowLink). The composer is the role's (D-ROLES): it sends while the
// thread can send and stops while it can stop, and holds the send while a turn that ended waits
// for its saved reply (settling), the typed words kept. The thread opens with the AI label (D73);
// a blank draft tells the header's menu it already is New chat (menuHere). A
// conversation about a ticket (D-ASK-AUTO) carries the ticket in every message it sends, Try again
// included, shows the discussion bar under `above`, and holds the send until the ticket is in.
// Files go with the words they were attached to (useAttachments, US-009b); Try again resends both.
// Report this on Auto's messages opens the foundation's one ReportSheet (useMessageReport, US-009c).

import { useCallback, useMemo, type ReactNode } from 'react';

import { useAppSession } from '../../app-state/session';
import { ErrorState, LoadingState, ReportSheet } from '../../ui';
import { useAttachments } from '../attachments/use-attachments';
import { MessageList } from '../components/MessageList';
import { useFollowLink } from '../components/follow-link';
import { Composer } from '../composer/Composer';
import { canStop } from '../controller/thread';
import { useThread, type ThreadSendInput, type ThreadView } from '../controller/use-thread';
import { DiscussionBar } from '../discussion/DiscussionBar';
import { discussionInput } from '../discussion/discussion';
import { useDiscussion } from '../discussion/use-discussion';
import { HomeHeader } from '../home/HomeHeader';
import { menuHere } from '../home/menu';
import { useMessageReport } from '../report/use-message-report';
import type { ChatFile } from '../request';
import { retryInput, threadRows } from '../view-model';
import { ChatFrame } from './ChatFrame';

export type ChatScreenProps = {
  /** The conversation to open (checked first), or null for a draft. */
  readonly chatId: string | null;
  /** What sits between the header and the thread (home's needs strip). */
  readonly above?: ReactNode;
  /** The chat route's way back; home has none. */
  readonly onBack?: () => void;
  /** The ticket a new conversation discusses (routes.chatWithTicket's row id); none by default. */
  readonly ticketId?: string | null;
};

function Thread({ thread }: { readonly thread: ThreadView }) {
  const { state, send, settleCard, loadError, retry } = thread;
  const follow = useFollowLink();
  const { report, sheet } = useMessageReport();
  const rows = useMemo(() => threadRows(state), [state]);
  const askAgain = useCallback(() => {
    const again = retryInput(state);
    if (again) send(again);
  }, [state, send]);
  if (loadError) return <ErrorState error={loadError} onRetry={retry} />;
  if (state.status === 'loading') return <LoadingState />;
  return (
    <>
      <MessageList
        rows={rows}
        onLink={follow}
        onRetry={askAgain}
        onCard={settleCard}
        report={report}
      />
      <ReportSheet {...sheet} />
    </>
  );
}

export function ChatScreen({ chatId, above, onBack, ticketId = null }: ChatScreenProps) {
  const opened = useThread(chatId);
  const discussion = useDiscussion(ticketId);
  const files = useAttachments();
  const { workspace } = useAppSession();
  const { state, stop, send: sendTurn } = opened;
  const about = discussion.discussion;
  const send = useCallback(
    (input: ThreadSendInput) => sendTurn(discussionInput(input, about)),
    [sendTurn, about],
  );
  const thread: ThreadView = { ...opened, send };
  const working = canStop(state);
  const onSend = useCallback(
    (text: string, ready: readonly ChatFile[]) => send({ text, files: ready }),
    [send],
  );
  return (
    <ChatFrame
      header={<HomeHeader onBack={onBack} here={menuHere(state, ticketId)} />}
      above={
        <>
          {above}
          <DiscussionBar state={discussion} messages={state.messages} />
        </>
      }
      composer={
        <Composer
          role={workspace.role}
          streaming={working}
          loading={state.status === 'loading' || state.settling || discussion.holds}
          files={files}
          onSend={onSend}
          onStop={stop}
        />
      }
    >
      <Thread thread={thread} />
    </ChatFrame>
  );
}
