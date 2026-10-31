// Candy's pause control (US-023e, D-CAN-5, WCAG 2.2.2; the kit's motion/pause-toggle.tsx): a pill,
// 'Pause' while Candy moves and 'Play' while it is paused, at least 44 pt each way and growing with
// Dynamic Type. Filled (the chip's fill and the text colour, on the page and the home's header) or
// the stage's outline (1.5 pt in the card's white ink, on a card gradient). VoiceOver hears the
// action a tap takes ('Pause the animation', 'Play the animation'). One tap sets the one stored
// value (styles.candy.motionPaused), so every Candy loop stops together. Under Reduce Motion, or
// while the look's Motion is 'paused', nothing moves, so it draws nothing (candyPauseControlOf).

import { Pressable, StyleSheet } from 'react-native';

import { Text } from '../../ui';
import { MIN_TOUCH } from '../../ui/paint';
import { useStyle } from '../theme';
import { candyVars, type CandyVars } from '../tokens/candy';
import { CANDY_DEFAULT_LOOK } from './look-schema';
import { candyPauseControlOf } from './motion-pause';
import { useCandyMotion } from './use-candy-motion';

const OUTLINE = 1.5;
const PADDING = 16;
const PRESSED_OPACITY = 0.7;

export type CandyPauseVariant = 'filled' | 'outline';

export type CandyPauseButtonProps = {
  /** 'filled' on the page and the header (the default); 'outline' on the stage's gradient. */
  readonly variant?: CandyPauseVariant;
};

function variantPaint(variant: CandyPauseVariant, colours: CandyVars) {
  if (variant === 'outline') {
    return { box: { borderWidth: OUTLINE, borderColor: colours.cardInk }, ink: colours.cardInk };
  }
  return { box: { backgroundColor: colours.chip }, ink: colours.text };
}

export function CandyPauseButton({ variant = 'filled' }: CandyPauseButtonProps) {
  const style = useStyle();
  const motion = useCandyMotion();
  const control = candyPauseControlOf(motion);
  if (!control) return null;
  const colours = style.candy ?? candyVars(style.candyLook ?? CANDY_DEFAULT_LOOK);
  const paint = variantPaint(variant, colours);
  return (
    <Pressable
      onPress={motion.togglePause}
      accessibilityRole="button"
      accessibilityLabel={control.label}
      style={({ pressed }) => [
        styles.pill,
        { borderRadius: style.radii.pill, opacity: pressed ? PRESSED_OPACITY : 1 },
        paint.box,
      ]}
    >
      <Text style={[style.type.button, { color: paint.ink }]}>{control.word}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    paddingHorizontal: PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
