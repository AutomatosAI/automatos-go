// Candy's preview: a small Today in the default look (Blush, whatever look the phone keeps) — the
// band over the page, Auto at 56 as on Today's header, the orb at 96 with needs-you's sample figure
// in white, and three mini cards in the look's gradients. Every moving part is held still (Auto and
// the orb's arc): the picker draws no pause control, so nothing loops here (D-CAN-5, WCAG 2.2.2).

import { StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { CandyAuto } from '../../candy/auto/CandyAuto';
import { CANDY_DEFAULT_LOOK } from '../../candy/look-schema';
import { Band } from '../../candy/parts/Band';
import { GradientCard } from '../../candy/parts/GradientCard';
import { Orb } from '../../candy/parts/Orb';
import { useCandyPaint } from '../../candy/parts/use-candy-paint';
import type { CandySetIndex } from '../../tokens/candy-paint';
import { StyleScope } from '../../provider/StyleScope';
import { builtinChoice } from '../../registry/style-id';
import { PREVIEW } from '../cards';

const CANDY = builtinChoice('candy');
const { candy } = PREVIEW;
const SETS: readonly CandySetIndex[] = Object.freeze([1, 2, 3]);
const FIGURE_SCALING = Object.freeze({
  // D38: a decorative figure inside a fixed 96 pt ball (the card says its name); 2× still fits it.
  maxFontSizeMultiplier: 2,
});

function OrbWithFigure() {
  const { vars, type } = useCandyPaint();
  return (
    <View style={styles.orb}>
      <Orb size={candy.orb} room={candy.orb} still />
      <View style={[StyleSheet.absoluteFill, styles.centred]}>
        <Text {...FIGURE_SCALING} style={[type.display('number'), { color: vars.cardInk }]}>
          {candy.figure}
        </Text>
      </View>
    </View>
  );
}

function SmallToday() {
  return (
    <View style={styles.ground}>
      <Band height={candy.band} />
      <View style={styles.top}>
        <CandyAuto state="idle" size={candy.auto} label={null} still />
        <OrbWithFigure />
      </View>
      <View style={styles.cards}>
        {SETS.map((set) => (
          <GradientCard key={set} set={set} style={styles.card} />
        ))}
      </View>
    </View>
  );
}

export function CandyPreview() {
  return (
    <StyleScope choice={CANDY} look={CANDY_DEFAULT_LOOK}>
      <SmallToday />
    </StyleScope>
  );
}

const styles = StyleSheet.create({
  ground: { minHeight: PREVIEW.minHeight, padding: candy.pad, gap: candy.gap },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orb: { width: candy.orb, height: candy.orb },
  centred: { alignItems: 'center', justifyContent: 'center' },
  cards: { flexDirection: 'row', gap: candy.gap },
  card: { flex: 1, height: candy.card },
});
