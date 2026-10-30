// Arcade's pause control (US-022e, WCAG 2.2.2; the kit's motion/pause-toggle.tsx): a text button,
// PAUSE while Arcade moves and PLAY while it is paused, in Arcade's button face on the window with
// its border, the menu's highlight while pressed. VoiceOver hears the action a tap takes ('Pause the
// animation', 'Play the animation'). At least 44 pt each way, and it grows with Dynamic Type. Under
// Reduce Motion nothing moves, so it draws nothing (motion-pause.ts pauseControlOf).

import { Pressable, StyleSheet } from 'react-native';

import { Text } from '../../ui';
import { MIN_TOUCH } from '../../ui/paint';
import { useStyle } from '../theme';
import { arcadeVars } from '../tokens/arcade';
import { ARCADE_DEFAULT_LOOK } from './look-schema';
import { pauseControlOf } from './motion-pause';
import { useArcadeMotion } from './use-arcade-motion';

const BORDER = 2;
const PADDING = 12;

export function PauseButton() {
  const style = useStyle();
  const motion = useArcadeMotion();
  const control = pauseControlOf(motion);
  if (!control) return null;
  const colours = style.arcade ?? arcadeVars(style.arcadeLook ?? ARCADE_DEFAULT_LOOK);
  return (
    <Pressable
      onPress={motion.togglePause}
      accessibilityRole="button"
      accessibilityLabel={control.label}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: colours.bd,
          backgroundColor: pressed ? colours.hl : colours.win,
        },
      ]}
    >
      {({ pressed }) => (
        <Text style={[style.type.button, { color: pressed ? colours.hlt : colours.tx }]}>
          {control.word}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    paddingHorizontal: PADDING,
    borderWidth: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
