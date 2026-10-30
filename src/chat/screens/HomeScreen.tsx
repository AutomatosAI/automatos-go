// Home (D-HOME, the handoff's 2a): the header, the needs strip and the Auto thread with its
// composer. The thread is the newest conversation, checked before reuse, or a draft (KC4,
// useHomeChat); until the list answers, the frame shows loading (or the list's error with Retry)
// and no composer, so nothing is typed into a thread that is not yet chosen. `firstOpen` shows in
// the thread's place while home's conversation is a draft with nothing in it (A5's First open).
// The thread and the strip share whether the brief card is on screen (PRD-268 US-G06): the strip
// then shrinks to its count.

import type { ReactNode } from 'react';

import { BriefOnScreenProvider } from '../../brief/on-screen';
import { ErrorState, LoadingState } from '../../ui';
import { HomeHeader } from '../home/HomeHeader';
import { NeedsStrip } from '../home/NeedsStrip';
import { useHomeChat } from '../home/use-home';
import { ChatFrame } from './ChatFrame';
import { ChatScreen } from './ChatScreen';

export type HomeScreenProps = {
  /** In the thread's place while it is a draft with nothing in it; none by default. */
  readonly firstOpen?: ReactNode;
};

export function HomeScreen({ firstOpen }: HomeScreenProps = {}) {
  const { chatId, error, retry } = useHomeChat();
  if (chatId !== undefined)
    return (
      <BriefOnScreenProvider>
        <ChatScreen chatId={chatId} above={<NeedsStrip />} empty={firstOpen} />
      </BriefOnScreenProvider>
    );
  return (
    <ChatFrame header={<HomeHeader />} above={<NeedsStrip />}>
      {error ? <ErrorState error={error} onRetry={retry} /> : <LoadingState />}
    </ChatFrame>
  );
}
