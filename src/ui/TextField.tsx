// The text field (at-input): card ground, 1 pt border, 6 pt radius, 40 tall or a multiline area
// from 80; the olive focus ring, an orange border with the error's words when invalid. It always
// has a label: shown above the field, or only to VoiceOver when hidden (the composer's 'Message
// Auto'). The error, else the helper, is the accessibility hint. A5: the dress gives the field's
// radius (the style's input: Play's 12, HUD's 0) and the label's face, case and tracking (Play's
// and HUD's small label in capitals).

import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TargetedEvent,
  type TextInputProps,
} from 'react-native';

import { useDress } from '../styles/dress/use-dress';
import { useStyle } from '../styles/theme';
import type { Tokens } from '../styles/tokens';
import { Text } from './Text';
import { fieldLabelStyle } from './dressed';
import {
  FIELD_HEIGHT,
  FIELD_MULTILINE_MIN_HEIGHT,
  fieldNote,
  fieldPaint,
  textFace,
  type FieldPaint,
} from './variants';

const NOTE_LEVEL = 5;

type FocusEvent = NativeSyntheticEvent<TargetedEvent>;

export type TextFieldProps = Omit<
  TextInputProps,
  'style' | 'editable' | 'placeholderTextColor' | 'accessibilityLabel' | 'multiline'
> & {
  readonly label: string;
  readonly hideLabel?: boolean;
  readonly multiline?: boolean;
  readonly helper?: string;
  /** The words under an invalid field; its presence marks the field invalid. */
  readonly error?: string;
  readonly disabled?: boolean;
};

function inputStyle(tokens: Tokens, tone: FieldPaint, multiline: boolean, radius: number) {
  const face = textFace(tokens.type, 'body1');
  return {
    fontFamily: face.fontFamily,
    fontSize: face.fontSize,
    // a single-line iOS field drifts off centre with a lineHeight; a multiline area needs one
    lineHeight: multiline ? face.lineHeight : undefined,
    color: tone.color,
    backgroundColor: tone.backgroundColor,
    borderColor: tone.borderColor,
    opacity: tone.opacity,
    borderRadius: radius,
    paddingHorizontal: tokens.spacing.space5,
    paddingVertical: tokens.spacing.space3,
    boxShadow: tone.boxShadow,
  };
}

export function TextField({
  label,
  hideLabel = false,
  multiline = false,
  helper,
  error,
  disabled = false,
  onFocus,
  onBlur,
  ...input
}: TextFieldProps) {
  const style = useStyle();
  const dress = useDress();
  const { tokens } = style;
  const [focused, setFocused] = useState(false);
  const tone = fieldPaint(tokens.colours, { focused, invalid: error !== undefined, disabled });
  const note = fieldNote(error, helper);
  const handleFocus = (event: FocusEvent) => {
    setFocused(true);
    onFocus?.(event);
  };
  const handleBlur = (event: FocusEvent) => {
    setFocused(false);
    onBlur?.(event);
  };
  return (
    <View style={[styles.field, { gap: tokens.spacing.space2 }]}>
      {hideLabel ? null : (
        // the field itself carries the label, so VoiceOver does not read it twice
        <Text
          style={fieldLabelStyle(style, dress)}
          accessible={false}
          importantForAccessibility="no"
        >
          {label}
        </Text>
      )}
      <TextInput
        {...input}
        multiline={multiline}
        editable={!disabled}
        onFocus={handleFocus}
        onBlur={handleBlur}
        allowFontScaling
        accessibilityLabel={label}
        accessibilityHint={note?.text}
        accessibilityState={{ disabled }}
        placeholderTextColor={tone.placeholder}
        selectionColor={tokens.colours.accent}
        style={[
          styles.input,
          inputStyle(tokens, tone, multiline, dress.radii.input),
          multiline ? styles.multiline : styles.single,
        ]}
      />
      {note ? (
        <Text level={NOTE_LEVEL} tone={note.tone}>
          {note.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { alignSelf: 'stretch' },
  input: { borderWidth: 1 },
  single: { minHeight: FIELD_HEIGHT },
  multiline: { minHeight: FIELD_MULTILINE_MIN_HEIGHT, textAlignVertical: 'top' },
});
