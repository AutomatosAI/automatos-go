// The layout switch for home and the chat route (US-016k, D54): the resolved style's layout picks
// the home (layout.ts homeFor), and every home talks to the same Auto over A2's one thread.
//
//   Studio   A2's home exactly as built (HomeScreen; the chat route's ChatScreen), First open in
//            its thread's place while home's conversation is a blank draft
//   Play     PlayHome (Ember 01-02, 06)
//   HUD      HudHome (the voice-first core)
//   Arcade   ArcadeHome (the handheld, US-022g)
//   Candy    CandyHome (Today, Chat, Shelf and Team, US-023g): Today on home, Chat on the chat route
//
// Play's, HUD's, Arcade's and Candy's home open the conversation A2's home would (useHomeChat: the newest
// chat, checked before reuse, or a draft); until the list answers they show loading, or its error
// with Retry, and no composer, as A2's home does. A flip between styles mounts the other home: the read
// on screen is let go of and never cancelled (the reply is saved and the new home reopens it).

import { useHomeChat } from '../../chat/home/use-home';
import { ChatScreen, type ChatScreenProps } from '../../chat/screens/ChatScreen';
import { HomeScreen } from '../../chat/screens/HomeScreen';
import { ErrorState, LoadingState, Screen } from '../../ui';
import { useStyle } from '../theme';
import { ArcadeHome } from './ArcadeHome';
import { CandyHome } from './CandyHome';
import { FirstOpenThread } from './FirstOpenThread';
import { HudHome } from './HudHome';
import { homeFor } from './layout';
import { PlayHome } from './PlayHome';

/** Studio's First open draws no starters (D29), so a starter can never be tapped there. */
const NO_STARTERS = () => undefined;

/** A styled home while the newest chat is being chosen: loading, or the error with Retry. */
function Choosing({ error, retry }: { readonly error: unknown; readonly retry: () => void }) {
  return (
    <Screen ground="chat">
      {error ? <ErrorState error={error} onRetry={retry} /> : <LoadingState />}
    </Screen>
  );
}

function StyledHome({ kind }: { readonly kind: 'play' | 'hud' | 'arcade' | 'candy' }) {
  const { chatId, error, retry } = useHomeChat();
  if (chatId === undefined) return <Choosing error={error} retry={retry} />;
  if (kind === 'play') return <PlayHome chatId={chatId} home />;
  if (kind === 'candy') return <CandyHome chatId={chatId} view="today" />;
  return kind === 'hud' ? <HudHome chatId={chatId} /> : <ArcadeHome chatId={chatId} />;
}

/** app/(app)/index.tsx: the home the style's layout draws. */
export function StyleHome() {
  const kind = homeFor(useStyle().layout);
  if (kind === 'studio')
    return <HomeScreen firstOpen={<FirstOpenThread onStarter={NO_STARTERS} />} />;
  return <StyledHome key={kind} kind={kind} />;
}

/**
 * app/(app)/chat/[id].tsx: one conversation in the style's layout, opened at its focus message in
 * Studio's and Play's threads and Arcade's story (PRD-268 US-G03; HUD shows only the newest turn, Candy's
 * chat view opens at its newest turn).
 */
export function StyleChat({
  chatId,
  ticketId = null,
  onBack,
  focusMessageId = null,
}: Omit<ChatScreenProps, 'above' | 'empty'>) {
  const kind = homeFor(useStyle().layout);
  if (kind === 'play')
    return (
      <PlayHome
        chatId={chatId}
        ticketId={ticketId}
        onBack={onBack}
        focusMessageId={focusMessageId}
      />
    );
  if (kind === 'hud') return <HudHome chatId={chatId} ticketId={ticketId} />;
  if (kind === 'arcade')
    return <ArcadeHome chatId={chatId} ticketId={ticketId} focusMessageId={focusMessageId} />;
  if (kind === 'candy')
    return <CandyHome chatId={chatId} ticketId={ticketId} onBack={onBack} view="chat" />;
  return (
    <ChatScreen
      chatId={chatId}
      ticketId={ticketId}
      onBack={onBack}
      focusMessageId={focusMessageId}
    />
  );
}
