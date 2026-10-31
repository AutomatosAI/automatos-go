// Today's stat cards (CANDY-LAYOUT §4 P1; the kit's today/stat-cards.tsx at 3920359d5): a row that
// scrolls sideways and bleeds off the right edge, the cards bottom-aligned 12 apart — Working now,
// Needs you (16 taller) and In queue, each a gradient card 132 wide in its place's set (today.ts
// statCards) with rs corners: a 34 pt white circle holding a 12 pt dot of the card's start colour,
// the label (Nunito 800 13, white) under it, and the figure (Outfit 600 34, white) at the foot. The
// label sits under the circle at the card's top, over the gradient's a and b stops, where small white
// text may sit (D-A11Y; the P1 mock sets it over the figure, where the c stop runs); the large figure
// takes the foot. A card grows taller with Dynamic Type, never wider. VoiceOver hears each card as
// one line ('Working now, 2'); a card whose number the app has not had is not drawn (today.ts).

import { ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { CARD_START_VARS } from '../../tokens/candy';
import { PAGE_GUTTER } from '../parts/orb-model';
import { GradientCard } from '../parts/GradientCard';
import { useCandyPaint } from '../parts/use-candy-paint';
import { CANDY_TODAY_COPY } from '../strings';
import { STAT_CARD, type StatCard } from './today';

const LABEL_GAP = 8;

function StatCardView({ card }: { readonly card: StatCard }) {
  const { vars, type } = useCandyPaint();
  const ink = { color: vars.cardInk };
  return (
    <GradientCard
      set={card.set}
      style={{ width: STAT_CARD.width, minHeight: card.height }}
      contentStyle={styles.content}
    >
      <View accessible accessibilityLabel={card.accessibilityLabel} style={styles.fill}>
        <View style={[styles.badge, { backgroundColor: vars.cardInk }]}>
          <View style={[styles.dot, { backgroundColor: vars[CARD_START_VARS[card.set]] }]} />
        </View>
        <Text style={[type.display('panel'), ink, styles.label]}>{card.label}</Text>
        <View style={styles.fill} />
        <Text style={[type.display('number'), ink]}>{card.figure}</Text>
      </View>
    </GradientCard>
  );
}

export function StatCards({ cards }: { readonly cards: readonly StatCard[] }) {
  if (cards.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={CANDY_TODAY_COPY.statsLabel}
      style={styles.bleed}
      contentContainerStyle={styles.row}
    >
      {cards.map((card) => (
        <StatCardView key={card.key} card={card} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { marginRight: -PAGE_GUTTER },
  row: { gap: STAT_CARD.gap, alignItems: 'flex-end', paddingRight: PAGE_GUTTER },
  content: { padding: STAT_CARD.padding },
  fill: { flexGrow: 1 },
  badge: {
    width: STAT_CARD.badge,
    height: STAT_CARD.badge,
    borderRadius: STAT_CARD.badge / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: STAT_CARD.dot, height: STAT_CARD.dot, borderRadius: STAT_CARD.dot / 2 },
  label: { marginTop: LABEL_GAP },
});
