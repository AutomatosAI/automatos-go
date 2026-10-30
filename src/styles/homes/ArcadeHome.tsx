// Arcade's home (PRD-001 §4.6.1 D-ARC-6, US-022g; README 'Pages', the 'Phone 390' handheld and the
// design kit's chat/chat-view.tsx): the handheld over A2's one thread, talking to the same Auto as
// Studio's home, with the hooks HUD's home uses. Top to bottom in the console body: the status bar
// (Auto's mark, today's counters, the pause control), the story window (the AI label, then YOU and
// AUTO lines, ★ for what a turn did, ITEM RECEIVED for a Deliverable, A2's own cards under '! A
// choice awaits'), the dialogue window (Auto's portrait in his turn's state, his newest reply typing
// out), then the controls: the D-pad and the voice surround.
//   TYPE in the dialogue window opens the Sheet HUD's home uses: A2's discussion bar for a ticket and
// A2's Composer (the viewer's read-only copy comes with it, D17); sending is A2's sendMessage and
// closes the sheet; Auto listens while it is open. STOP shows while Auto answers or the voice
// works: quick-ask's stop, and A2's for a typed turn (HUD's). Hold to talk is A6's quick-ask in
// place (useArcadeHomeVoice). The D-pad: ▲ Quests the Board, ▶ Inventory the Deliverables, ▼ Menu
// the header menu (HomeMenu over A2's MENU_ITEMS: New chat, Chats, the Command Centre with the
// needs-you number, Settings), ◀ Chat the home, selected here. Report this (D15) on Auto's saved
// replies in the story and on the one the dialogue says opens the foundation's one ReportSheet.
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
import { StoryWindow } from '../arcade/home/StoryWindow';
import { ArcadeButton, DialogueWindow, StatusBar } from '../arcade/parts';
import { portraitState } from '../arcade/sprite/turn-state';
import { ARCADE_HOME_COPY } from '../strings';
import {
  useArcadeComposer,
  useArcadeCounters,
  useArcadeStory,
  useDialogueSay,
  useOneShotEnd,
  usePadPress,
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
  const story = useArcadeStory(home, report);
  const say = useDialogueSay(state);
  const onPad = usePadPress(menu.open);
  useOneShotEnd(home.mascot);
  return (
    <Screen ground="chat">
      <ScrollView contentContainerStyle={styles.console} keyboardShouldPersistTaps="handled">
        <StatusBar counters={counters} />
        <View style={styles.screen}>
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
        <ArcadeControls
          pad={{ current: 'chat', menuOpen: menu.visible, onPress: onPad }}
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
  screen: { flex: 1, gap: CONSOLE.gap, paddingHorizontal: CONSOLE.padH },
  dialogueControls: { flexDirection: 'row', flexWrap: 'wrap', gap: CONSOLE.gap },
});
