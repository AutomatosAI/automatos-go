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
// Directly above the composer, inside the keyboard lift, sits the newest of Auto's open suggestions
// (PRD-268 US-G01, src/suggestions/PinnedSuggestion.tsx), where discovery lists `suggestions`.
// Beside the send sits A6's voice button (US-019k): the voice screen on this conversation, by its id
// once it has one; not there for a viewer.
// `empty` takes the thread's place while it is a draft with nothing in it (A5's First open on home).
// Where discovery lists `brief`, a message carrying the day's brief draws the brief card (US-G06).
// The thread opens at its focus message, the route's or the brief on open's (US-G03). Where it lists
// `suggestions`, a suggestion Auto posted draws its card while it is open (§6.5.1).

import { useCallback, useMemo, type ReactNode } from 'react';

import { canBrief, canSuggestions } from '../../api/capabilities';
import { useAppSession } from '../../app-state/session';
import { roleCan } from '../../auth/role';
import { isBlankDraft } from '../../styles/homes/layout';
import { PinnedSuggestion } from '../../suggestions/PinnedSuggestion';
import { ErrorState, LoadingState, ReportSheet } from '../../ui';
import { VoiceButton } from '../../voice/entry/VoiceButton';
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
import { useThreadFocus } from '../use-thread-focus';
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
  /** In the thread's place while it is a draft with nothing in it (home's First open); none by default. */
  readonly empty?: ReactNode;
  /** The message the thread opens at (the chat route's focus param, PRD-268 US-G03); none by default. */
  readonly focusMessageId?: string | null;
};

type ThreadProps = {
  readonly thread: ThreadView;
  readonly empty?: ReactNode;
  readonly focusMessageId: string | null;
};

function Thread({ thread, empty, focusMessageId }: ThreadProps) {
  const { state, send, settleCard, loadError, retry } = thread;
  const { focus, settle } = useThreadFocus(state.chatId, focusMessageId);
  const follow = useFollowLink();
  const { report, sheet } = useMessageReport();
  const { discovery } = useAppSession();
  const briefs = canBrief(discovery);
  const suggestions = canSuggestions(discovery);
  const rows = useMemo(
    () => threadRows(state, { briefs, suggestions }),
    [state, briefs, suggestions],
  );
  const askAgain = useCallback(() => {
    const again = retryInput(state);
    if (again) send(again);
  }, [state, send]);
  if (loadError) return <ErrorState error={loadError} onRetry={retry} />;
  if (state.status === 'loading') return <LoadingState />;
  if (empty && isBlankDraft(state)) return <>{empty}</>;
  return (
    <>
      <MessageList
        rows={rows}
        onLink={follow}
        onRetry={askAgain}
        onCard={settleCard}
        report={report}
        focusMessageId={focus}
        onFocused={settle}
      />
      <ReportSheet {...sheet} />
    </>
  );
}

export function ChatScreen(props: ChatScreenProps) {
  const { chatId, above, onBack, ticketId = null, empty, focusMessageId = null } = props;
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
        <>
          <PinnedSuggestion inset="space7" />
          <Composer
            role={workspace.role}
            streaming={working}
            loading={state.status === 'loading' || state.settling || discussion.holds}
            files={files}
            onSend={onSend}
            onStop={stop}
            accessory={
              <VoiceButton roleCanChat={roleCan(workspace.role, 'chat')} chatId={state.chatId} />
            }
          />
        </>
      }
    >
      <Thread
        thread={thread}
        empty={ticketId === null ? empty : undefined}
        focusMessageId={focusMessageId}
      />
    </ChatFrame>
  );
}
