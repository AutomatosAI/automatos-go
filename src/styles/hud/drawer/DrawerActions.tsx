// 'SAVE AS NEW LOOK' and 'RESET' at the foot of the drawer, as the drawing draws them: 46 pt high,
// Geist Mono 600 12 at .14em — Save filling the row in the accent with the accent ink, Reset
// outlined in the line (dimmed when the look is as it was picked). Under them, why the last change
// was refused or not kept, in the error colour.

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { DISABLED_OPACITY } from '../../../ui/paint';
import { HUD_DRAWER_COPY, PLAY_LOOK_COPY } from '../../strings';
import { HUD_DRAWER } from '../drawer-model';
import { useDrawerPaint } from './use-drawer';

const { actions } = HUD_DRAWER;
const PROBLEM_SIZE = 13;
const said = HUD_DRAWER_COPY;

export type DrawerActionsProps = {
  readonly onSaveAs: () => void;
  readonly onReset: () => void;
  readonly canReset: boolean;
  readonly problem: string | null;
};

export function DrawerActions({ onSaveAs, onReset, canReset, problem }: DrawerActionsProps) {
  const paint = useDrawerPaint();
  if (!paint) return null;
  const { vars, style } = paint;
  const face = style.type.mono(actions.size, 600, { trackingEm: actions.tracking });
  return (
    <View style={styles.foot}>
      <View style={styles.row}>
        <Pressable
          onPress={onSaveAs}
          accessibilityRole="button"
          accessibilityLabel={said.saveAsNewLabel}
          style={({ pressed }) => [
            styles.action,
            styles.grow,
            { backgroundColor: vars.accent },
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[face, { color: vars.accentInk }]}>{said.saveAsNew}</Text>
        </Pressable>
        <Pressable
          onPress={onReset}
          disabled={!canReset}
          accessibilityRole="button"
          accessibilityLabel={said.resetLabel}
          accessibilityHint={PLAY_LOOK_COPY.resetHint}
          accessibilityState={{ disabled: !canReset }}
          style={({ pressed }) => [
            styles.action,
            styles.reset,
            { borderColor: vars.line },
            !canReset ? styles.disabled : pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[face, { color: vars.text }]}>{said.reset}</Text>
        </Pressable>
      </View>
      {problem === null ? null : (
        <Text
          accessibilityRole="alert"
          style={[style.type.body(PROBLEM_SIZE), { color: vars.error }]}
        >
          {problem}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  foot: { marginTop: 'auto', gap: actions.gap },
  row: { flexDirection: 'row', gap: actions.gap },
  action: { minHeight: actions.height, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  reset: { paddingHorizontal: actions.resetPadX, borderWidth: HUD_DRAWER.restLine },
  pressed: { opacity: HUD_DRAWER.pressedOpacity },
  disabled: { opacity: DISABLED_OPACITY },
});
