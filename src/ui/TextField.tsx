// The text field (at-input): card ground, 1 pt border, 6 pt radius, 40 tall or a multiline area
// from 80; the olive focus ring, an orange border with the error's words when invalid. It always
// has a label: shown above the field, or only to VoiceOver when hidden (the composer's 'Message
// Auto'). The error, else the helper, is the accessibility hint. A5: the dress gives the field's
// radius (the style's input: Play's 12, HUD's 0) and the label's face, case and tracking (Play's
// and HUD's small label in capitals); the keyboard takes Play's and HUD's tone
// (keyboardAppearanceFor), a caller's keyboardAppearance first. Its heights are the style's
// (useStyle().controls.field, rule 3.5). A single-line field is drawn 40 tall and takes the 44 pt
// touch the other controls take (rules 3.2, 10.1; variants.ts fieldTouch): the input sits in a
// frame whose slop grows it to 44, and a tap in that slop focuses the input, unless the field
// cannot be edited (disabled, readOnly or editable={false}: text-field-model.ts). The slop is on the
// frame, not the input, because Android's text input does not read hitSlop (React Native reads it
// only on a view); the field's own box makes room for it, so nothing is drawn or laid out anew.

import { useRef, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TargetedEvent,
  type TextInputProps,
} from 'react-native';

import { useDress } from '../styles/dress/use-dress';
import { keyboardAppearanceFor } from '../styles/ground/ground';
import { useStyle } from '../styles/theme';
import type { Tokens } from '../styles/tokens';
import { Text } from './Text';
import { fieldLabelStyle } from './dressed';
import { fieldEditable } from './text-field-model';
import { fieldNote, fieldPaint, fieldTouch, textFace, type FieldPaint } from './variants';
import { selectionProps } from './selection';

const NOTE_LEVEL = 5;

type FocusEvent = NativeSyntheticEvent<TargetedEvent>;

export type TextFieldProps = Omit<
  TextInputProps,
  'style' | 'placeholderTextColor' | 'accessibilityLabel' | 'multiline'
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
  readOnly,
  editable,
  onFocus,
  onBlur,
  ...input
}: TextFieldProps) {
  const style = useStyle();
  const dress = useDress();
  const { tokens } = style;
  const { field } = style.controls;
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const touch = fieldTouch(field, multiline);
  const canEdit = fieldEditable({ disabled, readOnly, editable });
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
  // a touch in the frame's slop, just outside the drawn field, focuses it as a touch on it does
  const takesTouch = () => canEdit;
  const focus = () => inputRef.current?.focus();
  return (
    <View style={[styles.field, touch.room, { gap: tokens.spacing.space2 }]}>
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
      <View
        collapsable={false}
        hitSlop={touch.slop}
        onStartShouldSetResponder={takesTouch}
        onResponderRelease={focus}
      >
        <TextInput
          {...input}
          ref={inputRef}
          multiline={multiline}
          editable={canEdit}
          onFocus={handleFocus}
          onBlur={handleBlur}
          allowFontScaling
          keyboardAppearance={input.keyboardAppearance ?? keyboardAppearanceFor(style)}
          accessibilityLabel={label}
          accessibilityHint={note?.text}
          accessibilityState={{ disabled }}
          placeholderTextColor={tone.placeholder}
          {...selectionProps(tokens.colours)}
          style={[
            styles.input,
            inputStyle(tokens, tone, multiline, dress.radii.input),
            multiline ? styles.multiline : null,
            { minHeight: multiline ? field.multilineMinHeight : field.height },
          ]}
        />
      </View>
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
  multiline: { textAlignVertical: 'top' },
});
