// Make it sweet's live preview (the kit's looks/look-preview.tsx at 3920359d5): a window on the
// palette's win with the look's r corners on its tinted shadow (repoContradictions: r for this
// preview), the band across its top; on it Auto at 84 beside his bubble, then three of Today's cards
// in the look's gradients. It draws nothing of its own: every colour, corner and the glow come from
// the look the page is editing (its StyleScope), so each change shows here at once. Auto floats and
// blinks (the page's pause control stills him) and celebrates for a moment after Save look. The
// sample is a picture: VoiceOver hears one line saying what it shows, never numbers that aren't
// real. Small white text sits at the cards' tops, over their a and b stops (D-A11Y).

import { StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { nearestRadius } from '../../tokens/candy';
import { CANDY_LEADING } from '../../typeface/candy-type';
import { CandyAuto } from '../auto/CandyAuto';
import { Band } from '../parts/Band';
import { BAND_CURVE } from '../parts/shapes';
import { GradientCard } from '../parts/GradientCard';
import { useCandyPaint } from '../parts/use-candy-paint';
import { CANDY_SWEET_COPY } from '../strings';
import { PREVIEW_CARDS, SWEET_PAGE } from './sweet';

const { preview } = SWEET_PAGE;
const said = CANDY_SWEET_COPY.preview;
const BUBBLE_SIZE = 14;

function Cards() {
  const { vars, type } = useCandyPaint();
  const ink = { color: vars.cardInk };
  return (
    <View style={styles.cards}>
      {PREVIEW_CARDS.map((card) => (
        <GradientCard
          key={card.set}
          set={card.set}
          style={styles.card}
          contentStyle={styles.cardContent}
        >
          <Text style={[type.display('panel'), ink]}>{card.label}</Text>
          <View style={styles.fill} />
          <Text style={[type.display('number'), ink]}>{card.figure}</Text>
        </GradientCard>
      ))}
    </View>
  );
}

export type SweetPreviewProps = {
  /** Auto celebrates after Save look (CELEBRATE_MS). */
  readonly celebrating: boolean;
};

export function SweetPreview({ celebrating }: SweetPreviewProps) {
  const { look, vars, type, shadow, rs } = useCandyPaint();
  const corners = { borderRadius: nearestRadius(look.roundness) };
  const bubble = type.body(BUBBLE_SIZE, 700, { leading: CANDY_LEADING.label });
  return (
    <View style={styles.block}>
      <Text accessibilityRole="header" style={[type.display('snag'), { color: vars.text }]}>
        {said.title}
      </Text>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={said.says}
        style={[corners, { backgroundColor: vars.win }, shadow]}
      >
        <View style={[styles.clip, corners]}>
          <Band height={preview.band} curve={BAND_CURVE.max} page={false} />
          <View style={styles.content}>
            <View style={styles.auto}>
              <CandyAuto
                state={celebrating ? 'celebrate' : 'idle'}
                size={preview.auto}
                label={null}
              />
              <View style={[styles.bubble, { backgroundColor: vars.chip, borderRadius: rs }]}>
                <Text style={[bubble, { color: vars.text }]}>{said.bubble}</Text>
              </View>
            </View>
            <Cards />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: SWEET_PAGE.sectionGap },
  clip: { overflow: 'hidden' },
  content: { padding: preview.pad, gap: preview.gap },
  auto: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: preview.gap },
  bubble: {
    flexShrink: 1,
    flexBasis: preview.card.minWidth,
    flexGrow: 1,
    paddingHorizontal: preview.bubble.padH,
    paddingVertical: preview.bubble.padV,
  },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: preview.card.gap },
  card: { flexGrow: 1, flexBasis: preview.card.minWidth, minHeight: preview.card.minHeight },
  cardContent: { padding: preview.card.pad },
  fill: { flexGrow: 1 },
});
