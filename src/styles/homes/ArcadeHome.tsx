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

import { ScrollView, StyleSheet, View } from 'react-native';

import { useNeedsYou } from '../../api/needs-you';
import { Composer } from '../../chat/composer/Composer';
import { DiscussionBar } from '../../chat/discussion/DiscussionBar';
import { HomeMenu } from '../../chat/home/HomeMenu';
import { menuHere } from '../../chat/home/menu';
import { useHomeMenu } from '../../chat/home/use-home-menu';
import { useMessageReport } from '../../chat/report/use-message-report';
import { ReportSheet, Screen, Sheet } from '../../ui';
import { useArcadeHomeVoice, type ArcadeHomeVoice } from '../../voice/home/use-arcade-home-voice';
import { ArcadeControls } from '../arcade/home/ArcadeControls';
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
};

type DialogueControlsProps = {
  readonly onType: () => void;
  readonly voice: Pick<ArcadeHomeVoice, 'stopEnabled' | 'stop'>;
};

/** TYPE, and STOP while Auto answers or the voice works. */
function DialogueControls({ onType, voice }: DialogueControlsProps) {
  const said = ARCADE_HOME_COPY;
  return (
    <View style={styles.dialogueControls}>
      <ArcadeButton kind="primary" label={said.type} hint={said.typeHint} onPress={onType} />
      {voice.stopEnabled ? (
        <ArcadeButton label={said.stop} hint={said.stopHint} onPress={voice.stop} />
      ) : null}
    </View>
  );
}

export function ArcadeHome({ chatId, ticketId = null }: ArcadeHomeProps) {
  const home = useHomeThread(chatId, ticketId);
  const needsYou = useNeedsYou();
  const { state, stop } = home.thread;
  const menu = useHomeMenu(menuHere(state, ticketId));
  const voice = useArcadeHomeVoice(home);
  const { report, sheet } = useMessageReport();
  const composer = useArcadeComposer(home, voice.typed);
  const counters = useArcadeCounters(needsYou.query.data ? needsYou.total : null);
  const party = useArcadeParty(needsYou.rows);
  const story = useArcadeStory(home, report);
  const say = useDialogueSay(state);
  const handheld = useHandheld(menu.open);
  const chatShown = handheld.screen === 'chat';
  useOneShotEnd(home.mascot);
  return (
    <Screen ground="chat">
      <ScrollView contentContainerStyle={styles.console} keyboardShouldPersistTaps="handled">
        <View>
          <StatusBar counters={counters} />
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
            />
            <DialogueWindow
              state={portraitState(home.mascot.driver.mascot)}
              reply={say.reply}
              thinking={say.thinking}
              onReport={story.sayingReport}
            >
              <DialogueControls onType={composer.open} voice={voice} />
            </DialogueWindow>
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
