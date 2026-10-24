// The composer's pill (the handoff's 2j input): 42 tall with a 21 pt radius, --background ground and
// 1 pt border, the field's olive focus ring; the words in the thread's 16/24 (D72), as they will
// read once sent; it grows with the message up to six lines, then scrolls.
// Multiline, and Return inserts a newline: it never submits (D-COMPOSER). Painted with the
// foundation's fieldPaint, so it focuses and dims as every text field does. A5: its corners round
// only where the style rounds things (HUD's TYPE sheet draws it square; src/styles/dress/cc-dress.ts).
// FOUNDATION GAP: src/ui/TextField has no pill shape (6 pt radius, multiline from 80, no style).

import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { roundCorner } from '../../styles/dress/cc-dress';
import { useTokens } from '../../styles/theme';
import { fieldPaint, textFace } from '../../ui/variants';
import { pillMetrics } from './composer-state';

export type PillInputProps = {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly placeholder: string;
  /** VoiceOver's name for the pill (the placeholder is not read as one). */
  readonly label: string;
  readonly editable: boolean;
};

export function PillInput({ value, onChangeText, placeholder, label, editable }: PillInputProps) {
  const tokens = useTokens();
  const [focused, setFocused] = useState(false);
  const tone = fieldPaint(tokens.colours, { focused, disabled: !editable });
  const face = textFace(tokens.type, 'thread');
  const metrics = pillMetrics(face.lineHeight);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      editable={editable}
      multiline
      submitBehavior="newline"
      returnKeyType="default"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      allowFontScaling
      accessibilityLabel={label}
      accessibilityState={{ disabled: !editable }}
      placeholderTextColor={tone.placeholder}
      selectionColor={tokens.colours.accent}
      style={[
        styles.pill,
        {
          fontFamily: face.fontFamily,
          fontSize: face.fontSize,
          lineHeight: face.lineHeight,
          color: tone.color,
          backgroundColor: tokens.colours.background,
          borderColor: tone.borderColor,
          opacity: tone.opacity,
          boxShadow: tone.boxShadow,
          minHeight: metrics.minHeight,
          maxHeight: metrics.maxHeight,
          borderRadius: roundCorner(metrics.radius, tokens.radii),
          paddingVertical: metrics.paddingVertical,
          paddingHorizontal: metrics.paddingHorizontal,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  pill: { flex: 1, minWidth: 0, borderWidth: 1, textAlignVertical: 'top' },
});
