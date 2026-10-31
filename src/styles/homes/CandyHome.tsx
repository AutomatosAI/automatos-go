// Candy's home (PRD-001 §4.6.2 D-CAN-6, US-023g; CANDY-LAYOUT §4): P1 Today, P2 Chat, P3 Shelf and
// P4 Team over A2's one thread, talking to the same Auto as Studio's home, with the hooks Arcade's
// home uses. The views switch in place (candy-home.ts): the home's route opens Today, a
// conversation's route Chat. Today, Shelf and Team float the tab bar (Today, Chat, the voice raised
// in its centre, Shelf, Team) over the view's foot; Chat has none (its back and menu circles,
// US-023h). The voice is A6's quick-ask in place (useCandyHomeVoice): hold to talk in the tab bar's
// centre for someone who may talk (a viewer gets none), and the voice window over the bar while it
// works, opening with the AI label. The header menu is A2's HomeMenu (New chat, Chats, the Command
// Centre with the needs-you number, Settings), opened from each view's menu circle; Report this
// (D15) is the foundation's one ReportSheet, mounted once beside the views, the Chat view's to open.
// Auto has no clip boundary in Candy, so a one-shot (hello, celebrate) ends on Arcade's timer.
// Today is unmounted under the other views: it announces nothing (the thread's live words are the
// Chat view's, and the voice window's caption stays over the tab bar on every view that has one).

import { HomeMenu } from '../../chat/home/HomeMenu';
import { useMessageReport } from '../../chat/report/use-message-report';
import { ReportSheet, Screen } from '../../ui';
import { useCandyHomeVoice, type CandyHomeVoice } from '../../voice/home/use-candy-home-voice';
import { portraitState } from '../arcade/sprite/turn-state';
import { stageOf } from '../candy/auto/stage';
import { CandyTalkButton } from '../candy/home/TalkButton';
import { TodayView } from '../candy/home/TodayView';
import { ChatStandIn, ShelfStandIn, TeamStandIn } from '../candy/home/ViewStandIn';
import { VoiceWindow } from '../candy/home/VoiceWindow';
import { TabBar } from '../candy/parts/TabBar';
import { showsTabBar, type CandyView } from './candy-home';
import { useOneShotEnd } from './use-arcade-home';
import { useCandyHome, useTabBarRoom, type CandyViews, type TabBarRoom } from './use-candy-home';

/** The home draws its own safe area: the band runs under the status bar, the tab bar over the foot. */
const SIDES = Object.freeze(['left', 'right'] as const);

export type CandyHomeProps = {
  /** The conversation to open (checked first), or null for a draft. */
  readonly chatId: string | null;
  /** The ticket a new conversation discusses; none by default. */
  readonly ticketId?: string | null;
  /** A conversation's route: its Back. */
  readonly onBack?: () => void;
  /** The view to open; the route's own when omitted (candy-home.ts openingView). */
  readonly view?: CandyView;
};

type FloatingProps = {
  readonly views: CandyViews;
  readonly voice: CandyHomeVoice;
  readonly room: TabBarRoom;
};

/** On Today, Shelf and Team: the tab bar with the voice in its centre, and the voice window over it. */
function Floating({ views, voice, room }: FloatingProps) {
  if (!showsTabBar(views.view)) return null;
  const talk = voice.available ? <CandyTalkButton talk={voice.talk} /> : null;
  return (
    <>
      {voice.available ? <VoiceWindow voice={voice} bottom={room.window} /> : null}
      <TabBar active={views.view} onSelect={views.select}>
        {talk}
      </TabBar>
    </>
  );
}

export function CandyHome({ chatId, ticketId = null, onBack, view }: CandyHomeProps) {
  const { home, needsYou, menu, views, today } = useCandyHome(chatId, ticketId, view);
  const voice = useCandyHomeVoice(home, views.showChat);
  const { report, sheet } = useMessageReport();
  const room = useTabBarRoom();
  useOneShotEnd(home.mascot);
  const stage = stageOf(portraitState(home.mascot.driver.mascot), voice.stage);
  const menuCircle = { needsYou: needsYou.total, expanded: menu.visible, onPress: menu.open };
  return (
    <Screen ground="chat" edges={SIDES}>
      {views.view === 'today' ? (
        <TodayView
          today={today}
          stage={stage}
          menu={menuCircle}
          language={voice.language}
          footRoom={room.foot}
        />
      ) : null}
      {/* CANDY_STAND_IN US-023h */}
      {views.view === 'chat' ? (
        <ChatStandIn report={report} onBack={onBack ?? views.showToday} />
      ) : null}
      {/* CANDY_STAND_IN US-023i */}
      {views.view === 'shelf' ? <ShelfStandIn footRoom={room.foot} menu={menuCircle} /> : null}
      {/* CANDY_STAND_IN US-023j */}
      {views.view === 'team' ? <TeamStandIn footRoom={room.foot} menu={menuCircle} /> : null}
      <Floating views={views} voice={voice} room={room} />
      <HomeMenu menu={menu} needsYou={needsYou.total} />
      <ReportSheet {...sheet} />
    </Screen>
  );
}
