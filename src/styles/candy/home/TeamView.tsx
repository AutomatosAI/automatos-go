// P4 Team (PRD-001 §4.6.2 D-CAN-6, US-023j; CANDY-LAYOUT §4 P4 and the 390 mock), over team.ts:
// the band 300 tall behind the top of the view, then a column 20 in from each side, 16 apart: the
// header at the top inset + 8 — 'Your team' (Outfit 600 30) with '{active} of {total} agents
// active' (Nunito 700 14, the band's quiet text) under it, the pause control and the home menu
// circle at the right — then the active row: up to five 66 pt avatars, the active ones first, each
// in its 3 pt ring (the three cards' starts round its gradient while active, the line colour round
// a chip face while resting) with its name (Nunito 800 12) under it, sliding sideways past the right
// gutter; then the list: a window card (rs corners, 6 × 14 inside), a row per agent at least 58
// tall — a 40 pt avatar, the name (Nunito 800 14), its line (12, quiet, one line) and its status
// chip ('● Working' or '● Needs you' on the chip fill, '○ Ready' in quiet text), the chip dropping
// under the name when Dynamic Type leaves no room beside it. VoiceOver hears each agent as one line
// ('Iris, Social media lead, working'); the rows are not buttons (the app has no agent screen).
// Until the agents are read the view waits with the foundation's spinner; a failed read shows A2's
// error words with Try again (ErrorState); no agents is 'No agents yet.' and nothing else. Nothing
// here moves, but the header keeps the pause control (CANDY-LAYOUT §4: the home header). The column
// scrolls, and its foot clears the floating tab bar.

import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { NeedsYouRows } from '../../../api/needs-you';
import { ErrorState, LoadingState, Text } from '../../../ui';
import { CANDY_LEADING, CANDY_MIN, CANDY_STEPS } from '../../typeface/candy-type';
import { CandyPauseButton } from '../CandyPauseButton';
import { Avatar } from '../parts/Avatar';
import { Band } from '../parts/Band';
import { PAGE_GUTTER } from '../parts/orb-model';
import { BAND_CURVE } from '../parts/shapes';
import { StatusChip } from '../parts/StatusChip';
import { useCandyPaint } from '../parts/use-candy-paint';
import { CANDY_TEAM_COPY } from '../strings';
import { MenuCircle, type MenuCircleProps } from './MenuCircle';
import { TEAM, type Team, type TeamMember } from './team';
import { useTeam, type TeamRead } from './use-team';

/** The words beside a row's avatar keep this much room before its status chip drops under them. */
const WORDS_ROOM = 120;
const said = CANDY_TEAM_COPY;
const LEADING = Object.freeze({ leading: CANDY_LEADING.label });

type HeaderProps = { readonly team: Team | null; readonly menu: MenuCircleProps };

function TeamHeader({ team, menu }: HeaderProps) {
  const { vars, type } = useCandyPaint();
  const counted = team !== null && team.total > 0;
  return (
    <View style={styles.header}>
      <View style={styles.title}>
        <Text accessibilityRole="header" style={[type.display('screen'), { color: vars.text }]}>
          {said.title}
        </Text>
        {counted ? <Text style={[type.label, { color: vars.bandQuiet }]}>{team.count}</Text> : null}
      </View>
      <View style={styles.controls}>
        <CandyPauseButton />
        <MenuCircle {...menu} />
      </View>
    </View>
  );
}

function FrontAgent({ member }: { readonly member: TeamMember }) {
  const { vars, type } = useCandyPaint();
  return (
    <View accessible accessibilityLabel={member.label} style={styles.front}>
      <Avatar
        name={member.name}
        size={TEAM.frontAvatar}
        set={member.set}
        state={member.active ? 'active' : 'resting'}
        ring
      />
      <Text
        numberOfLines={2}
        style={[type.body(CANDY_MIN, 800, LEADING), styles.centred, { color: vars.text }]}
      >
        {member.name}
      </Text>
    </View>
  );
}

function FrontRow({ members }: { readonly members: readonly TeamMember[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={said.frontLabel}
      style={styles.bleed}
      contentContainerStyle={styles.frontRow}
    >
      {members.map((member) => (
        <FrontAgent key={member.id} member={member} />
      ))}
    </ScrollView>
  );
}

function TeamRow({ member }: { readonly member: TeamMember }) {
  const { vars, type } = useCandyPaint();
  return (
    <View accessible accessibilityLabel={member.label} style={styles.row}>
      <Avatar
        name={member.name}
        size={TEAM.rowAvatar}
        set={member.set}
        state={member.active ? 'active' : 'resting'}
        ground="win"
      />
      <View style={styles.words}>
        <Text style={[type.body(CANDY_STEPS.label, 800, LEADING), { color: vars.text }]}>
          {member.name}
        </Text>
        {member.line ? (
          <Text
            numberOfLines={1}
            style={[type.body(CANDY_MIN, 400, LEADING), { color: vars.quiet }]}
          >
            {member.line}
          </Text>
        ) : null}
      </View>
      <View style={styles.chip}>
        <StatusChip active={member.active} word={member.word} />
      </View>
    </View>
  );
}

function TeamList({ members }: { readonly members: readonly TeamMember[] }) {
  const { vars, rs } = useCandyPaint();
  return (
    <View style={[styles.list, { borderRadius: rs, backgroundColor: vars.win }]}>
      {members.map((member) => (
        <TeamRow key={member.id} member={member} />
      ))}
    </View>
  );
}

function TeamBody({ read }: { readonly read: TeamRead }) {
  const { vars, type } = useCandyPaint();
  const { team, error, retry } = read;
  if (team === null) return error ? <ErrorState error={error} onRetry={retry} /> : <LoadingState />;
  if (team.total === 0) {
    return <Text style={[type.label, { color: vars.bandQuiet }]}>{said.empty}</Text>;
  }
  return (
    <>
      <FrontRow members={team.front} />
      <TeamList members={team.members} />
    </>
  );
}

export type TeamViewProps = {
  /** The home menu at the top right, as on every view (D73). */
  readonly menu: MenuCircleProps;
  /** The room the floating tab bar takes at the view's foot. */
  readonly footRoom: number;
  /** needs-you's rows, as the home holds them (useNeedsYou): who needs you. */
  readonly needsYou: NeedsYouRows;
};

export function TeamView({ menu, footRoom, needsYou }: TeamViewProps) {
  const insets = useSafeAreaInsets();
  const read = useTeam(needsYou);
  const pad = { paddingTop: insets.top + TEAM.top, paddingBottom: footRoom };
  return (
    <ScrollView style={styles.view} contentContainerStyle={[styles.column, pad]}>
      <Band height={TEAM.band} curve={BAND_CURVE.max} />
      <TeamHeader team={read.team} menu={menu} />
      <TeamBody read={read} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  view: { flex: 1 },
  column: { flexGrow: 1, paddingHorizontal: PAGE_GUTTER, gap: TEAM.gap },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: TEAM.headerGap },
  title: { flexGrow: 1, flexShrink: 1, gap: TEAM.lineGap },
  controls: { flexDirection: 'row', alignItems: 'center', gap: TEAM.headerGap },
  bleed: { marginRight: -PAGE_GUTTER },
  frontRow: { gap: TEAM.frontGap, paddingRight: PAGE_GUTTER },
  front: { width: TEAM.frontColumn, alignItems: 'center', gap: TEAM.frontNameGap },
  centred: { textAlign: 'center' },
  list: { paddingVertical: TEAM.listPadV, paddingHorizontal: TEAM.listPadH },
  row: {
    minHeight: TEAM.rowHeight,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: TEAM.rowGap,
    rowGap: TEAM.lineGap,
  },
  words: { flexGrow: 1, flexShrink: 1, flexBasis: WORDS_ROOM },
  chip: { alignSelf: 'center' },
});
