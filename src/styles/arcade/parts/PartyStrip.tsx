// The party strip under the handheld's status bar (D-ARC-6, US-022l; the design kit's
// chat/party.tsx PartyStrip and the 'Phone 390' PARTY row): PARTY in the label face, then each
// agent as its 32 pt robot (AgentAvatar, its colour by its place in the list) beside its name (the
// running face) and its state as a glyph and a word in the state's colour (party.ts, the label
// face), so colour is never the only sign and a sighted user can tell the robots apart (the kit's
// desktop party names each too). Each agent is one VoiceOver element at least 44 pt each way
// ('Scout, needs you'). The row scrolls sideways when it does not fit; it sits on the screen's
// ground over a 2 pt rule in the window colour. Props only: the home feeds the members; with none
// it draws nothing.

import { ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { MIN_TOUCH } from '../../../ui/paint';
import { ARCADE_PARTY_COPY } from '../../strings';
import { partyBadge, type PartyMember } from '../home/party';
import { AgentAvatar } from '../sprite/AgentAvatar';
import { useArcadePaint } from './use-arcade-paint';

/**
 * The phone's strip: 4 / 10 pt padding, 8 pt between pieces, 3 inside a member, a 2 pt rule; a
 * name in Pixelify Sans at 15 pt (the kit's desktop party sets names in the running face).
 */
const STRIP = Object.freeze({ padV: 4, padH: 10, gap: 8, inner: 3, rule: 2, name: 15 });

function Member({ member }: { readonly member: PartyMember }) {
  const { vars, type } = useArcadePaint();
  const badge = partyBadge(member);
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={badge.label} style={styles.member}>
      <AgentAvatar index={member.look} />
      <View style={styles.words}>
        <Text style={[type.body(STRIP.name), { color: vars.tx }]}>{member.name}</Text>
        <Text style={[type.label, { color: vars[badge.tone] }]}>
          {`${badge.glyph} ${badge.word}`}
        </Text>
      </View>
    </View>
  );
}

export type PartyStripProps = {
  /** The party, in the read's order; none draws nothing. */
  readonly members: readonly PartyMember[];
};

export function PartyStrip({ members }: PartyStripProps) {
  const { vars, type } = useArcadePaint();
  if (members.length === 0) return null;
  return (
    <View style={[styles.strip, { borderBottomColor: vars.win }]}>
      <Text accessibilityRole="header" style={[type.display('panel'), { color: vars.tx2 }]}>
        {ARCADE_PARTY_COPY.title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.members}
      >
        {members.map((member) => (
          <Member key={member.id} member={member} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: STRIP.gap,
    paddingVertical: STRIP.padV,
    paddingHorizontal: STRIP.padH,
    borderBottomWidth: STRIP.rule,
  },
  members: { flexDirection: 'row', alignItems: 'center', gap: STRIP.gap },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: STRIP.inner,
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
  },
  words: { justifyContent: 'center' },
});
