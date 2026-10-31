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
//   P4 Team (US-023j): the chat's agents, the active ones first in the row of rings, then every
// agent with its status chip (TeamView reads the agents and the Board, as Arcade's party does; the
// home hands it needs-you's rows).
//   PRD-268 in Candy (D-CAN-8, US-023n), on the data and hooks every layout uses, each only where
// discovery lists its capability. Auto's suggestions (US-G01): 'Ideas · N' in Today's header opens
// the sheet of them all (useIdeas, its sheet mounted beside the menu), and the newest is pinned
// directly above the Chat view's message box (PinnedSuggestion, as Play's home places it). The
// day's brief (US-G06): the Chat view's rows keep a message's brief (threadRows' briefs, as Play's
// thread), drawn in Auto's bubble (ChatEntry). An approval (US-G08, useHudApproval): a card waiting
// with an ApprovalView opens its answer sheet by itself, once; closed unanswered, its way back in
// sits under the stage's state pill.

import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';

import { useHudApproval } from '../../approvals/use-hud-approval';
import { AttachMenu } from '../../chat/attachments/AttachMenu';
import { AttachmentChips } from '../../chat/attachments/AttachmentChips';
import { DiscussionBar } from '../../chat/discussion/DiscussionBar';
import { HomeMenu } from '../../chat/home/HomeMenu';
import type { ThreadReport } from '../../chat/report/report';
import { useMessageReport } from '../../chat/report/use-message-report';
import { PinnedSuggestion } from '../../suggestions/PinnedSuggestion';
import { useIdeas } from '../../suggestions/use-ideas';
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
import { TeamView } from '../candy/home/TeamView';
import { ideasPill } from '../candy/home/today';
import { VoiceWindow } from '../candy/home/VoiceWindow';
import { TabBar } from '../candy/parts/TabBar';
import { useCandyPaint } from '../candy/parts/use-candy-paint';
import type { SpaceName } from '../tokens';
import { showsTabBar, type CandyView } from './candy-home';
import { useOneShotEnd } from './use-arcade-home';
import {
  useCandyChat,
  useCandyComposer,
  useChatTitle,
  useRouteFocus,
  useStageBack,
  type RouteFocus,
} from './use-candy-chat';
import { useCandyHome, useTabBarRoom, type CandyViews, type TabBarRoom } from './use-candy-home';
import type { HomeThread } from './use-home-thread';

/** The home draws its own safe area: the band runs under the status bar, the tab bar over the foot. */
const SIDES = Object.freeze(['left', 'right'] as const);
const KEYBOARD_BEHAVIOUR = Platform.OS === 'ios' ? 'padding' : undefined;
/** The pinned suggestion lines up with the message box: its 14 in from the sides (composer.ts). */
const COMPOSER_INSET: SpaceName = 'space6';

export type CandyHomeProps = {
  /** The conversation to open (checked first), or null for a draft. */
  readonly chatId: string | null;
  /** The ticket a new conversation discusses; none by default. */
  readonly ticketId?: string | null;
  /** A conversation's route: its Back. */
  readonly onBack?: () => void;
  /** The view to open; the route's own when omitted (candy-home.ts openingView). */
  readonly view?: CandyView;
  /** The message the Chat view's thread opens at (the chat route's focus param, PRD-268 US-G03). */
  readonly focusMessageId?: string | null;
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
  /** The approval sheet's line, under the stage's state pill (useHudApproval). */
  readonly approval: ReactNode;
  /** The route's focus, kept by the home across the Chat view's mounts (useRouteFocus). */
  readonly routeFocus: RouteFocus;
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

/**
 * P2 Chat: the stage, A2's discussion bar, the thread, the voice window, the newest of Auto's open
 * suggestions and the message box.
 */
function ChatPane(props: ChatPaneProps) {
  const { home, voice, report, stage, menu, onBack, approval, routeFocus } = props;
  const { vars } = useCandyPaint();
  const { y: stackTop } = useSafeAreaFrame();
  const chat = useCandyChat(home, routeFocus);
  const { state } = home.thread;
  const title = useChatTitle(state);
  return (
    <View style={[styles.fill, { backgroundColor: vars.page }]}>
      <ChatStage stage={stage} title={title} onBack={onBack} menu={menu} approval={approval} />
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
          focusMessageId={chat.focus}
          onFocused={chat.onFocused}
        />
        {voice.available ? <VoiceWindow voice={{ ...voice, ...chatViewVoice(voice) }} /> : null}
        <PinnedSuggestion inset={COMPOSER_INSET} />
        <ChatComposer home={home} voice={voice} />
      </KeyboardAvoidingView>
    </View>
  );
}

export function CandyHome(props: CandyHomeProps) {
  const { chatId, ticketId = null, onBack, view, focusMessageId = null } = props;
  const { home, needsYou, menu, views, today } = useCandyHome(chatId, ticketId, view);
  const voice = useCandyHomeVoice(home, views.showChat);
  const { report, sheet } = useMessageReport();
  const ideas = useIdeas();
  const approval = useHudApproval(home.thread.state, home.thread.settleCard);
  const room = useTabBarRoom();
  useOneShotEnd(home.mascot);
  const stage = stageOf(portraitState(home.mascot.driver.mascot), voice.stage);
  const menuCircle = { needsYou: needsYou.total, expanded: menu.visible, onPress: menu.open };
  const back = useStageBack(views.showToday, onBack);
  const routeFocus = useRouteFocus(focusMessageId);
  return (
    <Screen ground="chat" edges={SIDES}>
      {views.view === 'today' ? (
        <TodayView
          today={today}
          stage={stage}
          menu={menuCircle}
          language={voice.language}
          ideas={ideasPill(ideas.button)}
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
          approval={approval.line}
          routeFocus={routeFocus}
        />
      ) : null}
      {views.view === 'shelf' ? (
        <ShelfView menu={menuCircle} footRoom={room.foot} onChat={views.showChat} />
      ) : null}
      {views.view === 'team' ? (
        <TeamView menu={menuCircle} footRoom={room.foot} needsYou={needsYou.rows} />
      ) : null}
      <Floating views={views} voice={voice} room={room} />
      {ideas.sheet}
      <HomeMenu menu={menu} needsYou={needsYou.total} />
      <ReportSheet {...sheet} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
