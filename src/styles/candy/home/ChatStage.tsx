// Auto's stage on the Chat view (PRD-001 §4.6.2 D-CAN-5, D-CAN-6, US-023h; CANDY-LAYOUT §4 P2, the
// 390 mock and the kit's chat/stage.tsx StageStrip at 3920359d5): the violet set's card gradient
// at least 290 tall across the top of the view, under the status bar, its foot rounded 40. Its top
// row, 18 in from each side: a 40 pt back circle in white at 22 % ('‹', 'Back'), the chat's title
// (Outfit 600 17, centred, wrapping under Dynamic Type) and the home menu's circle on the stage's
// ground (D73, with needs-you's number). Under it Auto at 128 in his turn's state, or the voice's
// while it works (stageOf), named 'Auto, {what he is doing}'; then two pills: his state as a glyph
// and a word ('● Listening', the stage ink on white, 30 tall; the polite status VoiceOver hears
// change, the text twin of his drawing) and the pause control in its outline (Auto floats and
// blinks here, and the writing dots under the stage bounce: one control stops them all, D-CAN-5).
// Small white text sits at the top, over the gradient's a and b stops (D-A11Y).

import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../../ui';
import { hitSlopFor } from '../../../ui/paint';
import { SHARED_COLOURS } from '../../tokens/candy-catalogue';
import { candyAvatarInitial } from '../../typeface/candy-type';
import { CandyAuto } from '../auto/CandyAuto';
import { stageLabel, type Stage } from '../auto/stage';
import { CandyPauseButton } from '../CandyPauseButton';
import { GradientCard } from '../parts/GradientCard';
import type { Corners } from '../parts/shapes';
import { useCandyPaint } from '../parts/use-candy-paint';
import { CANDY_CHAT_COPY } from '../strings';
import { statePill } from './chat';
import { MenuCircle, type MenuCircleProps } from './MenuCircle';

/** The P2 mock's measures, in points. */
const STAGE = Object.freeze({
  height: 290,
  foot: 40,
  padH: 18,
  rowGap: 10,
  circle: 40,
  glyph: 22,
  auto: 128,
  gap: 8,
  top: 6,
  bottom: 16,
  pill: 30,
  pillPadH: 14,
});
const CORNERS: Corners = Object.freeze({
  topLeft: 0,
  topRight: 0,
  bottomRight: STAGE.foot,
  bottomLeft: STAGE.foot,
});
const CIRCLE_SLOP = hitSlopFor(STAGE.circle, STAGE.circle);
const PRESSED_OPACITY = 0.7;
/** The violet set: the second of the look's three card gradients. */
const STAGE_SET = 2;

export type ChatStageProps = {
  /** Auto's stage: the turn's state, or the voice's while it works (stageOf). */
  readonly stage: Stage;
  /** The chat's own title, else 'New chat' (chat.ts chatTitle). */
  readonly title: string;
  readonly onBack: () => void;
  readonly menu: MenuCircleProps;
};

function BackCircle({ onBack }: Pick<ChatStageProps, 'onBack'>) {
  const { vars, round } = useCandyPaint();
  return (
    <Pressable
      onPress={onBack}
      hitSlop={CIRCLE_SLOP}
      accessibilityRole="button"
      accessibilityLabel={CANDY_CHAT_COPY.back}
      style={({ pressed }) => [
        styles.circle,
        { borderRadius: round, backgroundColor: SHARED_COLOURS.white22 },
        { opacity: pressed ? PRESSED_OPACITY : 1 },
      ]}
    >
      <Text style={[candyAvatarInitial(STAGE.glyph), { color: vars.cardInk }]}>
        {CANDY_CHAT_COPY.backGlyph}
      </Text>
    </Pressable>
  );
}

function StatePill({ stage }: Pick<ChatStageProps, 'stage'>) {
  const { vars, type, round } = useCandyPaint();
  const pill = statePill(stage);
  return (
    <View
      accessible
      accessibilityLabel={pill.label}
      accessibilityLiveRegion="polite"
      style={[styles.pill, { borderRadius: round, backgroundColor: vars.cardInk }]}
    >
      <Text style={[type.display('status'), { color: vars.stageInk }]}>{pill.text}</Text>
    </View>
  );
}

export function ChatStage({ stage, title, onBack, menu }: ChatStageProps) {
  const { vars, type } = useCandyPaint();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top, paddingBottom: STAGE.bottom };
  return (
    <GradientCard set={STAGE_SET} corners={CORNERS} style={styles.stage} contentStyle={pad}>
      <View style={styles.row}>
        <BackCircle onBack={onBack} />
        <Text
          accessibilityRole="header"
          style={[type.display('card'), styles.title, { color: vars.cardInk }]}
        >
          {title}
        </Text>
        <MenuCircle {...menu} ground="stage" />
      </View>
      <View style={styles.auto}>
        <CandyAuto state={stage.state} size={STAGE.auto} label={stageLabel(stage)} />
        <View style={styles.pills}>
          <StatePill stage={stage} />
          <CandyPauseButton variant="outline" />
        </View>
      </View>
    </GradientCard>
  );
}

const styles = StyleSheet.create({
  stage: { minHeight: STAGE.height },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: STAGE.rowGap,
    paddingHorizontal: STAGE.padH,
  },
  circle: {
    minWidth: STAGE.circle,
    minHeight: STAGE.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, textAlign: 'center' },
  auto: { alignItems: 'center', gap: STAGE.gap, marginTop: STAGE.top },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: STAGE.gap,
    paddingHorizontal: STAGE.padH,
  },
  pill: { minHeight: STAGE.pill, paddingHorizontal: STAGE.pillPadH, justifyContent: 'center' },
});
