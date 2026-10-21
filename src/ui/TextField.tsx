// The text field (at-input): card ground, 1 pt border, 6 pt radius, 40 tall or a multiline area
// from 80; the olive focus ring, an orange border with the error's words when invalid. It always
// has a label: shown above the field, or only to VoiceOver when hidden (the composer's 'Message
// Auto'). The error, else the helper, is the accessibility hint.

import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TargetedEvent,
  type TextInputProps,
} from 'react-native';

import { useTokens } from '../styles/theme';
import type { Tokens } from '../styles/tokens';
import { Text } from './Text';
import {
  FIELD_HEIGHT,
  FIELD_MULTILINE_MIN_HEIGHT,
  fieldNote,
  fieldPaint,
  textFace,
  type FieldPaint,
} from './variants';

const LABEL_LEVEL = 3;
const NOTE_LEVEL = 5;
const LABEL_WEIGHT = 500;

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

function inputStyle(tokens: Tokens, tone: FieldPaint, multiline: boolean) {
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
    borderRadius: tokens.radii.control,
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
  const tokens = useTokens();
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
          level={LABEL_LEVEL}
          weight={LABEL_WEIGHT}
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
          inputStyle(tokens, tone, multiline),
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
