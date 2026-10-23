// Home (D-HOME, the handoff's 2a): the header, the needs strip and the Auto thread with its
// composer. The thread is the newest conversation, checked before reuse, or a draft (KC4,
// useHomeChat); until the list answers, the frame shows loading (or the list's error with Retry)
// and no composer, so nothing is typed into a thread that is not yet chosen.

import { ErrorState, LoadingState } from '../../ui';
import { HomeHeader } from '../home/HomeHeader';
import { NeedsStrip } from '../home/NeedsStrip';
import { useHomeChat } from '../home/use-home';
import { ChatFrame } from './ChatFrame';
import { ChatScreen } from './ChatScreen';

export function HomeScreen() {
  const { chatId, error, retry } = useHomeChat();
  if (chatId !== undefined) return <ChatScreen chatId={chatId} above={<NeedsStrip />} />;
  return (
    <ChatFrame header={<HomeHeader working={false} />} above={<NeedsStrip />}>
      {error ? <ErrorState error={error} onRetry={retry} /> : <LoadingState />}
    </ChatFrame>
  );
}
