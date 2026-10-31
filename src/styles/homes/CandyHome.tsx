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
//   P2 Chat (US-023h): Auto's stage (his state, the state pill and the pause control), A2's
// discussion bar for a ticket, the thread (the AI label first), then, lifted over the keyboard on
// iOS, the voice window while the voice works and the message box with hold to talk beside it.
//   P3 Shelf (US-023i): A3's Deliverables as candy tiles under the type chips (ShelfView reads the
// gallery itself, as Arcade's Inventory does); an empty shelf's Chat pill shows the Chat view.

import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';

import { AttachMenu } from '../../chat/attachments/AttachMenu';
import { AttachmentChips } from '../../chat/attachments/AttachmentChips';
import { DiscussionBar } from '../../chat/discussion/DiscussionBar';
import { HomeMenu } from '../../chat/home/HomeMenu';
import type { ThreadReport } from '../../chat/report/report';
import { useMessageReport } from '../../chat/report/use-message-report';
import { ReportSheet, Screen } from '../../ui';
import { useCandyHomeVoice, type CandyHomeVoice } from '../../voice/home/use-candy-home-voice';
import { portraitState } from '../arcade/sprite/turn-state';
import { stageOf, type Stage } from '../candy/auto/stage';
import { CandyComposer } from '../candy/home/CandyComposer';
import { chatViewVoice } from '../candy/home/chat';
import { ChatStage } from '../candy/home/ChatStage';
import { ChatView } from '../candy/home/ChatView';
import type { MenuCircleProps } from '../candy/home/MenuCircle';
import { CandyTalkButton } from '../candy/home/TalkButton';
import { TodayView } from '../candy/home/TodayView';
import { ShelfView } from '../candy/home/ShelfView';
import { TeamStandIn } from '../candy/home/ViewStandIn';
import { VoiceWindow } from '../candy/home/VoiceWindow';
import { TabBar } from '../candy/parts/TabBar';
import { useCandyPaint } from '../candy/parts/use-candy-paint';
import { showsTabBar, type CandyView } from './candy-home';
import { useOneShotEnd } from './use-arcade-home';
import { useCandyChat, useCandyComposer, useChatTitle, useStageBack } from './use-candy-chat';
import { useCandyHome, useTabBarRoom, type CandyViews, type TabBarRoom } from './use-candy-home';
import type { HomeThread } from './use-home-thread';

/** The home draws its own safe area: the band runs under the status bar, the tab bar over the foot. */
const SIDES = Object.freeze(['left', 'right'] as const);
const KEYBOARD_BEHAVIOUR = Platform.OS === 'ios' ? 'padding' : undefined;

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

type ChatPaneProps = {
  readonly home: HomeThread;
  readonly voice: CandyHomeVoice;
  readonly report: ThreadReport;
  readonly stage: Stage;
  readonly menu: MenuCircleProps;
  readonly onBack: () => void;
};

/** The message box over A2's composer state, its files in the slots, hold to talk beside it. */
function ChatComposer({ home, voice }: Pick<ChatPaneProps, 'home' | 'voice'>) {
  const composer = useCandyComposer(home, voice.typed);
  const { files } = home;
  return (
    <CandyComposer
      value={composer.text}
      onChangeText={composer.setText}
      onSend={composer.send}
      onStop={composer.stop}
      onFocus={composer.onFocus}
      onBlur={composer.onBlur}
      composerState={composer.state}
      talk={voice.available ? voice.talk : null}
      above={<AttachmentChips chips={files.chips} onRemove={files.remove} />}
      leading={
        <AttachMenu
          disabled={!composer.state.inputEditable}
          room={files.room}
          onPicked={files.add}
        />
      }
    />
  );
}

/** P2 Chat: the stage, A2's discussion bar, the thread, the voice window and the message box. */
function ChatPane({ home, voice, report, stage, menu, onBack }: ChatPaneProps) {
  const { vars } = useCandyPaint();
  const { y: stackTop } = useSafeAreaFrame();
  const chat = useCandyChat(home);
  const { state } = home.thread;
  const title = useChatTitle(state);
  return (
    <View style={[styles.fill, { backgroundColor: vars.page }]}>
      <ChatStage stage={stage} title={title} onBack={onBack} menu={menu} />
      <DiscussionBar state={home.discussion} messages={state.messages} />
      <KeyboardAvoidingView
        behavior={KEYBOARD_BEHAVIOUR}
        keyboardVerticalOffset={stackTop}
        style={styles.fill}
      >
        <ChatView
          entries={chat.entries}
          onRetry={chat.onRetry}
          onCard={chat.onCard}
          onLink={chat.onLink}
          report={report}
        />
        {voice.available ? <VoiceWindow voice={{ ...voice, ...chatViewVoice(voice) }} /> : null}
        <ChatComposer home={home} voice={voice} />
      </KeyboardAvoidingView>
    </View>
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
  const back = useStageBack(views.showToday, onBack);
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
      {views.view === 'chat' ? (
        <ChatPane
          home={home}
          voice={voice}
          report={report}
          stage={stage}
          menu={menuCircle}
          onBack={back}
        />
      ) : null}
      {views.view === 'shelf' ? (
        <ShelfView menu={menuCircle} footRoom={room.foot} onChat={views.showChat} />
      ) : null}
      {/* CANDY_STAND_IN US-023j */}
      {views.view === 'team' ? <TeamStandIn footRoom={room.foot} menu={menuCircle} /> : null}
      <Floating views={views} voice={voice} room={room} />
      <HomeMenu menu={menu} needsYou={needsYou.total} />
      <ReportSheet {...sheet} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
