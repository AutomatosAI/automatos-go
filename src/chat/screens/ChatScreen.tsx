// One conversation on screen, shared by home and app/(app)/chat/[id].tsx: the header, the thread
// (US-008c's rows over useThread, US-008b) and the composer (US-009a). It only wires. The chat id
// is checked before reuse (D-STALE-CHAT); null is a draft. Try again asks the user's last words
// anew (retryWords); Auto's cards settle on the thread (settleCard); links open through the
// foundation's mapping (useFollowLink). The composer is the role's and the AI label's (D-ROLES,
// D-AI-LABEL): it sends while the thread can send and stops while it can stop.

import { useCallback, useMemo, type ReactNode } from 'react';

import { useAppSession } from '../../app-state/session';
import { ErrorState, LoadingState } from '../../ui';
import { MessageList } from '../components/MessageList';
import { useFollowLink } from '../components/follow-link';
import { Composer } from '../composer/Composer';
import { canStop } from '../controller/thread';
import { useThread, type ThreadView } from '../controller/use-thread';
import { HomeHeader } from '../home/HomeHeader';
import { retryWords, threadRows } from '../view-model';
import { ChatFrame } from './ChatFrame';

export type ChatScreenProps = {
  /** The conversation to open (checked first), or null for a draft. */
  readonly chatId: string | null;
  /** What sits between the header and the thread (home's needs strip). */
  readonly above?: ReactNode;
  /** The chat route's way back; home has none. */
  readonly onBack?: () => void;
};

function Thread({ thread }: { readonly thread: ThreadView }) {
  const { state, send, settleCard, loadError, retry } = thread;
  const follow = useFollowLink();
  const rows = useMemo(() => threadRows(state), [state]);
  const askAgain = useCallback(() => {
    const words = retryWords(state);
    if (words) send({ text: words });
  }, [state, send]);
  if (loadError) return <ErrorState error={loadError} onRetry={retry} />;
  if (state.status === 'loading') return <LoadingState />;
  return <MessageList rows={rows} onLink={follow} onRetry={askAgain} onCard={settleCard} />;
}

export function ChatScreen({ chatId, above, onBack }: ChatScreenProps) {
  const thread = useThread(chatId);
  const { workspace } = useAppSession();
  const { state, send, stop } = thread;
  const working = canStop(state);
  const onSend = useCallback((text: string) => send({ text }), [send]);
  return (
    <ChatFrame
      header={<HomeHeader working={working} onBack={onBack} />}
      above={above}
      composer={
        <Composer
          role={workspace.role}
          streaming={working}
          loading={state.status === 'loading'}
          onSend={onSend}
          onStop={stop}
        />
      }
    >
      <Thread thread={thread} />
    </ChatFrame>
  );
}
