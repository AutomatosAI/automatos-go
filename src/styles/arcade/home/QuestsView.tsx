// Quests in the handheld's screen (PRD-001 §4.6.1 D-ARC-6, US-022m; README 'Pages' /x/quests and
// the design kit's quests/{quests-page,quest-window}.tsx at 034fa629c): ▲ Quests on the D-pad shows
// it in place of the chat (no route). The map window: WORLD MAP and the count ('6 quests') over the
// overworld (QuestMap: the regions and a marker per quest, Skia's terrain scaled to the screen's
// width); 'Unfolding the map…' until the Board answers, 'Couldn't load the map.' with Try again
// when it cannot, and with no quests Auto asleep, 'The map is quiet. Start a quest from the chat.'
// and GO TO CHAT, which shows the chat again. Under the map, the quest window for the selected
// marker (the first that needs you until another is pressed): its state as a glyph and a word with
// its region, its title, OPEN (the ticket sheet) and BOARD (the whole Board). The quests are the
// Board's tickets (quests.ts) from the query the Command Centre already makes (use-quests.ts).

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { NeedsYouRows } from '../../../api/needs-you';
import { Text } from '../../../ui';
import { ARCADE_QUESTS_COPY } from '../../strings';
import { ARCADE_BODY_MIN } from '../../typeface/arcade-type';
import { QuestMap } from '../map/QuestMap';
import { ArcadeButton } from '../parts/ArcadeButton';
import { ArcadeWindow } from '../parts/ArcadeWindow';
import { useArcadePaint } from '../parts/use-arcade-paint';
import { PixelSprite } from '../sprite/PixelSprite';
import {
  QUEST_BOARD_ROUTE,
  QUEST_TONES,
  questCountLine,
  questLine,
  questRoute,
  type Quest,
  type QuestLog,
} from './quests';
import { useQuestLog, useQuestPick, type QuestRead } from './use-quests';

/** The windows' padding and gaps (the kit's phone .mapWindow and .quest: 10 pt), the title's size. */
const QUESTS = Object.freeze({ pad: 10, gap: 12, title: 20, titleLines: 4 });

function QuestWindow({ quest }: { readonly quest: Quest }) {
  const { vars, type } = useArcadePaint();
  const router = useRouter();
  const said = ARCADE_QUESTS_COPY;
  const line = questLine(quest);
  return (
    <ArcadeWindow title={said.quest} contentStyle={styles.window}>
      <Text
        accessibilityLabel={line.label}
        style={[type.label, { color: vars[QUEST_TONES[quest.status.tone]] }]}
      >
        {line.text}
      </Text>
      <Text
        accessibilityRole="header"
        numberOfLines={QUESTS.titleLines}
        style={[type.body(QUESTS.title), { color: vars.tx }]}
      >
        {quest.title}
      </Text>
      <View style={styles.actions}>
        <ArcadeButton
          kind="primary"
          label={said.open}
          hint={said.openHint}
          onPress={() => router.push(questRoute(quest))}
        />
        <ArcadeButton
          label={said.board}
          hint={said.boardHint}
          onPress={() => router.push(QUEST_BOARD_ROUTE)}
        />
      </View>
    </ArcadeWindow>
  );
}

function Quiet({ onChat }: { readonly onChat: () => void }) {
  const { vars, type } = useArcadePaint();
  const said = ARCADE_QUESTS_COPY;
  return (
    <View style={styles.quiet}>
      <PixelSprite state="sleeping" />
      <Text
        accessibilityRole="header"
        style={[type.display('screen'), styles.centred, { color: vars.tx }]}
      >
        {said.quietTitle}
      </Text>
      <Text style={[type.body(ARCADE_BODY_MIN), styles.centred, { color: vars.tx2 }]}>
        {said.quietLine}
      </Text>
      <ArcadeButton
        kind="primary"
        label={said.goToChat}
        hint={said.goToChatHint}
        onPress={onChat}
      />
    </View>
  );
}

function Unread({ read }: { readonly read: Exclude<QuestRead, { phase: 'ready' }> }) {
  const { vars, type } = useArcadePaint();
  const said = ARCADE_QUESTS_COPY;
  if (read.phase === 'loading') {
    return (
      <Text
        accessibilityLiveRegion="polite"
        style={[type.body(ARCADE_BODY_MIN), { color: vars.tx2 }]}
      >
        {said.loading}
      </Text>
    );
  }
  return (
    <View style={styles.quiet}>
      <Text accessibilityRole="alert" style={[type.body(ARCADE_BODY_MIN), { color: vars.hp }]}>
        {said.loadFailed}
      </Text>
      <ArcadeButton label={said.retry} onPress={read.retry} />
    </View>
  );
}

function MapHead({ count }: { readonly count: string | null }) {
  const { vars, type } = useArcadePaint();
  return (
    <View style={styles.head}>
      <Text accessibilityRole="header" style={[type.display('panel'), { color: vars.tx2 }]}>
        {ARCADE_QUESTS_COPY.worldMap}
      </Text>
      {count === null ? null : (
        <Text style={[type.body(ARCADE_BODY_MIN), { color: vars.tx2 }]}>{count}</Text>
      )}
    </View>
  );
}

function Mapped({ log, onChat }: { readonly log: QuestLog; readonly onChat: () => void }) {
  const pick = useQuestPick(log.quests);
  return (
    <>
      <ArcadeWindow contentStyle={styles.window}>
        <MapHead count={questCountLine(log)} />
        {log.quests.length === 0 ? (
          <Quiet onChat={onChat} />
        ) : (
          <QuestMap
            quests={log.quests}
            spots={pick.spots}
            selected={pick.selected?.id ?? null}
            onSelect={pick.onSelect}
          />
        )}
      </ArcadeWindow>
      {pick.selected ? <QuestWindow quest={pick.selected} /> : null}
    </>
  );
}

export type QuestsViewProps = {
  /** useNeedsYou's rows: a ticket one names needs you. */
  readonly needsYou: NeedsYouRows;
  /** Shows the chat again (GO TO CHAT on a quiet map). */
  readonly onChat: () => void;
};

export function QuestsView({ needsYou, onChat }: QuestsViewProps) {
  const read = useQuestLog(needsYou);
  return (
    <View style={styles.view}>
      {read.phase === 'ready' ? (
        <Mapped log={read.log} onChat={onChat} />
      ) : (
        <ArcadeWindow contentStyle={styles.window}>
          <MapHead count={null} />
          <Unread read={read} />
        </ArcadeWindow>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  view: { gap: QUESTS.gap },
  window: { padding: QUESTS.pad, gap: QUESTS.gap },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: QUESTS.gap,
  },
  quiet: { alignItems: 'center', gap: QUESTS.gap, paddingVertical: QUESTS.pad },
  centred: { textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: QUESTS.gap },
});
