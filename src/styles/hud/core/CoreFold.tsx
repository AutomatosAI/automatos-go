// HIDE AUTO on HUD's home (15 Nov 2026): the core (the rings and Auto) folds away for more room for
// the transcript, and SHOW AUTO brings it back. The button stands beside the state chip, which stays
// either way, in HUD's side-button dress (TYPE's and STOP's: mono 11 in a 1 pt line, 44 pt tall). The
// choice is the phone's, kept by the style store (hud/core-fold.ts), so it survives a relaunch.
// VoiceOver hears 'Hide Auto' or 'Show Auto' and whether the core shows (expanded). HudCore slides the
// core up as it goes and down as it comes back (Reanimated's FadeOutUp and FadeInUp, still under
// Reduce Motion); folded, nothing in it moves.

import { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '../../../ui';
import { useStyleStore } from '../../provider/context';
import { HUD_CORE_COPY } from '../../strings';
import { foldButtonView } from '../core-fold';
import { HUD_CORE } from './model';
import { useVoiceCore } from './use-voice-core';

const { buttons, tracking } = HUD_CORE;
const { side } = buttons;
const PAD_X = 12;

/** The fold as HudCore reads it: folded or not, and the press that flips it. */
export type HudCoreFold = {
  readonly folded: boolean;
  readonly onToggle: () => void;
};

/** HUD's home's fold, from the style store; a flip is kept on the phone. */
export function useHudCoreFold(): HudCoreFold {
  const folded = useStyleStore((state) => state.hudCoreFolded);
  const setFolded = useStyleStore((state) => state.setHudCoreFolded);
  const onToggle = useCallback(() => {
    setFolded(!folded);
  }, [setFolded, folded]);
  return { folded, onToggle };
}

export function FoldButton({ fold }: { readonly fold: HudCoreFold }) {
  const { paint, style } = useVoiceCore();
  const view = foldButtonView(fold.folded);
  const face = style.type.mono(HUD_CORE.monoSize, 500, { trackingEm: tracking.mono });
  return (
    <Pressable
      onPress={fold.onToggle}
      accessibilityRole="button"
      accessibilityLabel={view.label}
      accessibilityHint={HUD_CORE_COPY.foldHint}
      accessibilityState={{ expanded: !fold.folded }}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: side.height,
          borderWidth: side.border,
          borderColor: paint.line,
          backgroundColor: pressed ? paint.accentFill : undefined,
        },
      ]}
    >
      <Text style={[face, { color: paint.accent }]}>{view.text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexShrink: 0, justifyContent: 'center', paddingHorizontal: PAD_X },
});
