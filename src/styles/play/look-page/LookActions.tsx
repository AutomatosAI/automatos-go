// 'Save as new look' and 'Reset' under the knobs, as the design draws them: 46 pt high (the shared
// Button's least height is 44), radius 10, Geist 600 14 — Save in the accent with its ink and
// stretching, Reset outlined in the ground's line, dimmed when there is no look to go back to.
// Under them, why the last change was refused or not kept, in the error's text colour.

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { DISABLED_OPACITY } from '../../../ui/paint';
import { PLAY_LOOK_COPY } from '../../strings';
import { useCompanionPaint, type CompanionPaint } from '../companion/use-companion';
import { LOOK_PAGE } from './knobs';

const { actions } = LOOK_PAGE;
const PROBLEM_SIZE = 13;

type ActionProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly paint: CompanionPaint;
  readonly primary?: boolean;
  readonly disabled?: boolean;
  readonly hint?: string;
};

function Action({ label, onPress, paint, primary = false, disabled = false, hint }: ActionProps) {
  const { vars, style } = paint;
  const fill = primary
    ? { backgroundColor: vars.accent, borderColor: vars.accent }
    : { backgroundColor: 'transparent', borderColor: vars.groundLine };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.action,
        { borderRadius: style.radii.control },
        primary ? styles.grow : styles.reset,
        fill,
        disabled ? styles.disabled : pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[style.type.button, { color: primary ? vars.accentInk : vars.groundText }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export type LookActionsProps = {
  readonly onSaveAs: () => void;
  readonly onReset: () => void;
  readonly canReset: boolean;
  readonly problem: string | null;
};

export function LookActions({ onSaveAs, onReset, canReset, problem }: LookActionsProps) {
  const paint = useCompanionPaint();
  if (!paint) return null;
  const { vars, style } = paint;
  return (
    <View style={{ gap: style.tokens.spacing.space5 }}>
      <View style={styles.row}>
        <Action label={PLAY_LOOK_COPY.saveAsNew} onPress={onSaveAs} paint={paint} primary />
        <Action
          label={PLAY_LOOK_COPY.reset}
          onPress={onReset}
          paint={paint}
          disabled={!canReset}
          hint={PLAY_LOOK_COPY.resetHint}
        />
      </View>
      {problem === null ? null : (
        <Text
          accessibilityRole="alert"
          style={[style.type.body(PROBLEM_SIZE), { color: vars.errorText }]}
        >
          {problem}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: actions.gap },
  action: {
    minHeight: actions.height,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1 },
  reset: { paddingHorizontal: actions.resetPadX },
  pressed: { opacity: LOOK_PAGE.pressedOpacity },
  disabled: { opacity: DISABLED_OPACITY },
});
