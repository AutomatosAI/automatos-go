// Play's home (Ember 01-02, 06; D54, US-016k): the Companion chat over A2's one thread, talking to
// the same Auto as Studio's home. PlayHeader (the chat's title, 'Shelf +N' for the Deliverables
// this conversation made, the needs line from useNeedsYou), A2's discussion bar for a ticket, the
// thread (PlayThread over A2's view-model), Auto's row fed by the thread (use-home-thread.ts), then
// Play's message box on A2's composerState with A2's attachments in its slots. First open (Ember
// 06, US-017f) takes the header's and the thread's place on home while its conversation is a blank
// draft: the brand line, Auto's hello and the three starters, which fill the box and never send
// (KS13); the box's Send in the accent, A6's voice button beside it (US-019k: the conversation's id,
// none for a viewer). The frame is First open's: the ground's light where the
// screen kind puts it, everything lifted over the keyboard on iOS. Report this opens A2's one
// ReportSheet. Chats goes back on the chat route, else to the history; Shelf to the Deliverables.

import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';

import { roleCan } from '../../auth/role';
import { AttachMenu } from '../../chat/attachments/AttachMenu';
import { AttachmentChips } from '../../chat/attachments/AttachmentChips';
import { useFollowLink } from '../../chat/components/follow-link';
import { DiscussionBar } from '../../chat/discussion/DiscussionBar';
import { useMessageReport } from '../../chat/report/use-message-report';
import { LIVE_AUTO_KEY, retryInput, threadRows } from '../../chat/view-model';
import { routes } from '../../navigation/routes';
import { ReportSheet, Screen } from '../../ui';
import { EdgeBrand } from '../edges/parts';
import { AutoRow, PlayComposer, PlayHeader } from '../play/companion';
import { useTokens } from '../theme';
import { FirstOpenThread } from './FirstOpenThread';
import { showsFirstOpen } from './layout';
import { captionFactsOf } from './mascot-feed';
import { caretOn } from './play-thread';
import { PlayThread } from './PlayThread';
import { placeReports, shelfCount, type ShelfMemory } from './shelf';
import { useHomeThread, type HomeThread } from './use-home-thread';
import { usePlayComposer, usePlayTitle, useShelf, type PlayComposerModel } from './use-play-home';

const KEYBOARD_BEHAVIOUR = Platform.OS === 'ios' ? 'padding' : undefined;

export type PlayHomeProps = {
  /** The conversation to open (checked first), or null for a draft. */
  readonly chatId: string | null;
  /** The ticket a new conversation discusses; none by default. */
  readonly ticketId?: string | null;
  /** The chat route's way back: Chats goes there. */
  readonly onBack?: () => void;
  /** Home: First open shows while the conversation is a blank draft. */
  readonly home?: boolean;
};

type ComposerProps = {
  readonly home: HomeThread;
  readonly composer: PlayComposerModel;
  readonly firstOpen: boolean;
};

function Composer({ home, composer, firstOpen }: ComposerProps) {
  const { files, role } = home;
  return (
    <PlayComposer
      value={composer.text}
      onChangeText={composer.setText}
      onSend={composer.send}
      onStop={composer.stop}
      composerState={composer.state}
      firstOpen={firstOpen}
      above={<AttachmentChips chips={files.chips} onRemove={files.remove} />}
      leading={
        <AttachMenu
          disabled={!composer.state.inputEditable}
          room={files.room}
          onPicked={files.add}
        />
      }
      voice={{ roleCanChat: roleCan(role, 'chat'), chatId: home.thread.state.chatId }}
    />
  );
}

type ThreadProps = { readonly home: HomeThread; readonly shelf: ShelfMemory };

function Thread({ home, shelf }: ThreadProps) {
  const { state, send, settleCard } = home.thread;
  const follow = useFollowLink();
  const { report, sheet } = useMessageReport();
  const rows = useMemo(() => threadRows(state), [state]);
  const reports = useMemo(
    () => placeReports(shelf, state, LIVE_AUTO_KEY, new Set(rows.map((row) => row.key))),
    [shelf, state, rows],
  );
  const askAgain = useCallback(() => {
    const again = retryInput(state);
    if (again) send(again);
  }, [state, send]);
  return (
    <>
      <PlayThread
        rows={rows}
        caretKey={caretOn(LIVE_AUTO_KEY, state) ? LIVE_AUTO_KEY : null}
        reports={reports}
        onLink={follow}
        onRetry={askAgain}
        onCard={settleCard}
        report={report}
      />
      <ReportSheet {...sheet} />
    </>
  );
}

export function PlayHome({ chatId, ticketId = null, onBack, home: isHome = false }: PlayHomeProps) {
  const router = useRouter();
  const { spacing } = useTokens();
  const { y: stackTop } = useSafeAreaFrame();
  const home = useHomeThread(chatId, ticketId);
  const composer = usePlayComposer(home);
  const { state } = home.thread;
  const title = usePlayTitle(state);
  const shelf = useShelf(state);
  const firstOpen = isHome && showsFirstOpen(state, ticketId);
  const toChats = onBack ?? (() => router.push(routes.chats));
  const pad = { paddingHorizontal: spacing.space7, paddingBottom: spacing.space5 };
  return (
    <Screen ground={firstOpen ? 'first-open' : 'chat'} autoState={home.mascot.driver.mascot.mascot}>
      {firstOpen ? (
        <EdgeBrand />
      ) : (
        <PlayHeader
          title={title}
          shelfCount={shelfCount(shelf)}
          onChats={toChats}
          onShelf={() => router.push(routes.cc.deliverables)}
        />
      )}
      <DiscussionBar state={home.discussion} messages={state.messages} />
      <KeyboardAvoidingView
        behavior={KEYBOARD_BEHAVIOUR}
        keyboardVerticalOffset={stackTop}
        style={styles.fill}
      >
        {firstOpen ? (
          <FirstOpenThread onStarter={composer.setText} />
        ) : (
          <Thread home={home} shelf={shelf} />
        )}
        <View style={[pad, { gap: spacing.space5 }]}>
          {firstOpen ? null : <AutoRow state={home.mascot} facts={captionFactsOf(state)} />}
          <Composer home={home} composer={composer} firstOpen={firstOpen} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
