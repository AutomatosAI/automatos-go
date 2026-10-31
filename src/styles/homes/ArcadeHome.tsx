// Arcade's home (PRD-001 §4.6.1 D-ARC-6, US-022g; README 'Pages', the 'Phone 390' handheld and the
// design kit's chat/chat-view.tsx): the handheld over A2's one thread, talking to the same Auto as
// Studio's home, with the hooks HUD's home uses. Top to bottom in the console body: the status bar
// (Auto's mark, today's counters, the pause control), the party strip right under it (US-022l: the
// chat's agents, each its robot, name and state; nothing with no agents), the story window (the AI
// label, then YOU and AUTO lines, ★ for what a turn did, ITEM RECEIVED for a Deliverable, A2's own
// cards under '! A choice awaits'), the dialogue window (Auto's portrait in his turn's state, his
// newest reply typing out), then the controls: the D-pad and the voice surround.
//   TYPE in the dialogue window opens the Sheet HUD's home uses: A2's discussion bar for a ticket and
// A2's Composer (the viewer's read-only copy comes with it, D17); sending is A2's sendMessage and
// closes the sheet; Auto listens while it is open. STOP shows while Auto answers or the voice
// works: quick-ask's stop, and A2's for a typed turn (HUD's). Hold to talk is A6's quick-ask in
// place (useArcadeHomeVoice). The D-pad switches the handheld's screen, as the web handheld does:
// ▲ Quests shows the overworld map in place of the story and the dialogue (QuestsView, US-022m),
// ▶ Inventory the Deliverables as items (InventoryView, US-022n), neither a route; ◀ Chat the chat
// again (kept mounted while hidden, so the story's place and the typing hold); ▼ Menu the header
// menu (HomeMenu over A2's MENU_ITEMS: New chat, Chats, the Command Centre with the needs-you
// number, Settings). The page on screen is
// selected on the D-pad. Report this (D15) on Auto's saved replies in the story and on the one the
// dialogue says opens the foundation's one ReportSheet.
//   The column scrolls when the phone's text size leaves it no room; the story window keeps a share
// of the screen and scrolls inside it.
//   PRD-268 in Arcade (D-ARC-7), on the data and hooks every layout uses. The day's brief (US-G06,
// only where discovery lists `brief`): the dialogue says the brief the newest reply carries, its
// greeting and Auto's Read as plain words, with OPEN BRIEF beside TYPE and Report this kept; a brief
// in the story is its own window; OPEN BRIEF opens the brief's own view in a Sheet beside TYPE's
// (useArcadeBriefSheet). Auto's suggestions (US-G01, only where discovery lists `suggestions`):
// 'IDEAS · N' under the status bar opens the sheet of them all (useIdeas().sheet), and the newest
// is the NEXT line under it (ArcadeIdeas, ArcadeNext). An approval (US-G08,
// src/approvals/use-hud-approval.tsx): a card waiting with an ApprovalView opens its answer sheet by
// itself, once; closed unanswered, its way back in sits under the dialogue window. A suggestion
// Auto posted is its card's window in the story (StoryEntry, ThreadSuggestion), its words the
// dialogue's when it is the newest reply. The story opens at its focus message (US-G03), the chat
// route's or the brief on open's (useThreadFocus, as Studio's and Play's threads), once the chat is
// on the handheld's screen: scrolled there, or settled at once when the dialogue says it.

import { ScrollView, StyleSheet, View } from 'react-native';

import { useNeedsYou } from '../../api/needs-you';
import { useHudApproval } from '../../approvals/use-hud-approval';
import { Composer } from '../../chat/composer/Composer';
import { DiscussionBar } from '../../chat/discussion/DiscussionBar';
import { HomeMenu } from '../../chat/home/HomeMenu';
import { menuHere } from '../../chat/home/menu';
import { useHomeMenu } from '../../chat/home/use-home-menu';
import { useMessageReport } from '../../chat/report/use-message-report';
import { useThreadFocus } from '../../chat/use-thread-focus';
import { useIdeas } from '../../suggestions/use-ideas';
import { ReportSheet, Screen, Sheet } from '../../ui';
import { useArcadeHomeVoice, type ArcadeHomeVoice } from '../../voice/home/use-arcade-home-voice';
import { useArcadeBriefSheet } from '../arcade/home/ArcadeBrief';
import { ArcadeControls } from '../arcade/home/ArcadeControls';
import { ArcadeIdeas } from '../arcade/home/ArcadeNext';
import { InventoryView } from '../arcade/home/InventoryView';
import { QuestsView } from '../arcade/home/QuestsView';
import { StoryWindow } from '../arcade/home/StoryWindow';
import { ArcadeButton, DialogueWindow, PartyStrip, StatusBar } from '../arcade/parts';
import { portraitState } from '../arcade/sprite/turn-state';
import { ARCADE_HOME_COPY } from '../strings';
import {
  useArcadeComposer,
  useArcadeCounters,
  useArcadeParty,
  useArcadeStory,
  useDialogueSay,
  useHandheld,
  useOneShotEnd,
} from './use-arcade-home';
import { useHomeThread } from './use-home-thread';

/** Between the console's pieces, and its sides. */
const CONSOLE = Object.freeze({ gap: 12, padH: 12, padBottom: 12 });

export type ArcadeHomeProps = {
  /** The conversation to open (checked first), or null for a draft. */
  readonly chatId: string | null;
  /** The ticket a new conversation discusses; none by default. */
  readonly ticketId?: string | null;
  /** The message the story opens at (the chat route's focus param, PRD-268 US-G03). */
  readonly focusMessageId?: string | null;
};

type DialogueControlsProps = {
  readonly onType: () => void;
  readonly voice: Pick<ArcadeHomeVoice, 'stopEnabled' | 'stop'>;
  /** OPEN BRIEF, while the dialogue says the day's brief; absent, none. */
  readonly onBrief?: () => void;
};

/** TYPE, OPEN BRIEF while the dialogue says the brief, and STOP while Auto answers or the voice works. */
function DialogueControls({ onType, voice, onBrief }: DialogueControlsProps) {
  const said = ARCADE_HOME_COPY;
  return (
    <View style={styles.dialogueControls}>
      <ArcadeButton kind="primary" label={said.type} hint={said.typeHint} onPress={onType} />
      {onBrief ? (
        <ArcadeButton label={said.brief.open} hint={said.brief.openHint} onPress={onBrief} />
      ) : null}
      {voice.stopEnabled ? (
        <ArcadeButton label={said.stop} hint={said.stopHint} onPress={voice.stop} />
      ) : null}
    </View>
  );
}

export function ArcadeHome({ chatId, ticketId = null, focusMessageId = null }: ArcadeHomeProps) {
  const home = useHomeThread(chatId, ticketId);
  const needsYou = useNeedsYou();
  const { state, stop } = home.thread;
  const { focus, settle } = useThreadFocus(state.chatId, focusMessageId);
  const menu = useHomeMenu(menuHere(state, ticketId));
  const voice = useArcadeHomeVoice(home);
  const { report, sheet } = useMessageReport();
  const composer = useArcadeComposer(home, voice.typed);
  const counters = useArcadeCounters(needsYou.query.data ? needsYou.total : null);
  const party = useArcadeParty(needsYou.rows);
  const story = useArcadeStory(home, report);
  const say = useDialogueSay(state, story.saying);
  const handheld = useHandheld(menu.open);
  const ideas = useIdeas();
  const approval = useHudApproval(state, home.thread.settleCard);
  const brief = useArcadeBriefSheet();
  const sayingBrief = say.brief;
  const chatShown = handheld.screen === 'chat';
  useOneShotEnd(home.mascot);
  return (
    <Screen ground="chat">
      <ScrollView contentContainerStyle={styles.console} keyboardShouldPersistTaps="handled">
        <View>
          <StatusBar counters={counters} />
          <ArcadeIdeas button={ideas.button} />
          <PartyStrip members={party} />
        </View>
        <View style={[styles.screen, styles.inset]}>
          <View style={[styles.screen, chatShown ? null : styles.hidden]}>
            <StoryWindow
              entries={story.entries}
              onRetry={story.onRetry}
              onCard={story.onCard}
              onLink={story.onLink}
              report={report}
              onBrief={brief.open}
              focusMessageId={chatShown ? focus : null}
              onFocused={settle}
              sayingId={story.sayingId}
            />
            <DialogueWindow
              state={portraitState(home.mascot.driver.mascot)}
              reply={say.reply}
              thinking={say.thinking}
              onReport={story.sayingReport}
            >
              <DialogueControls
                onType={composer.open}
                voice={voice}
                onBrief={sayingBrief ? () => brief.open(sayingBrief) : undefined}
              />
            </DialogueWindow>
            {approval.line}
          </View>
          {handheld.screen === 'quests' ? (
            <QuestsView needsYou={needsYou.rows} onChat={handheld.showChat} />
          ) : null}
          {handheld.screen === 'inventory' ? <InventoryView onChat={handheld.showChat} /> : null}
        </View>
        <ArcadeControls
          pad={{ current: handheld.screen, menuOpen: menu.visible, onPress: handheld.onPad }}
          voice={voice}
        />
      </ScrollView>
      <Sheet visible={composer.visible} onClose={composer.close}>
        <DiscussionBar state={home.discussion} messages={state.messages} />
        <Composer
          role={home.role}
          streaming={home.working}
          loading={home.holding}
          files={home.files}
          onSend={composer.onSend}
          onStop={stop}
        />
      </Sheet>
      {ideas.sheet}
      {brief.sheet}
      <HomeMenu menu={menu} needsYou={needsYou.total} />
      <ReportSheet {...sheet} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  console: { flexGrow: 1, gap: CONSOLE.gap, paddingBottom: CONSOLE.padBottom },
  screen: { flex: 1, gap: CONSOLE.gap },
  inset: { paddingHorizontal: CONSOLE.padH },
  hidden: { display: 'none' },
  dialogueControls: { flexDirection: 'row', flexWrap: 'wrap', gap: CONSOLE.gap },
});
