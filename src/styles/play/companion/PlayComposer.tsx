// Play's message box (Ember 01-02, 06 and the style sheet's 'message box · Send / Stop'): a
// radius-12 field on the ground's surface with a 1 pt line of the ground's text at 0.14 and
// 'Message Auto' (Geist 16, text-3); the button a 42 pt circle in Play's paint (the ground's text
// with the ground as ink, the accent on First open) — Send its arrow up, Stop its 10 x 10 radius-2
// square, each named to VoiceOver ('Send', 'Stop') — as Studio's composer draws it, so on a 375 pt
// phone the field keeps its width beside the [+] and the voice button. Return inserts a newline:
// only the button sends (A2's D-COMPOSER). No AI label sits beside it (D73: the caption opens the
// thread). A2's composerState (wired in US-016k) says when the field takes no typing and the button
// does nothing, and gives a viewer's notice. A2's attachments sit in the slots: their chips above
// the field, the [+] at its start (US-016k). The keyboard takes the look's tone (Daylight light,
// the rest dark), never Studio's Light / Dark / System.
// Given `voice`, A6's voice button (US-019k) sits beside Send, in Play's dress; without it the box
// is as above. Given `language` (27 Oct 2026), the EN/PT switch sits just before the voice button.

import ArrowUp from 'lucide-react-native/icons/arrow-up';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '../../../ui';
import { DISABLED_OPACITY, ICON_STROKE, hitSlopFor } from '../../../ui/paint';
import { VoiceButton, type VoiceButtonProps } from '../../../voice/entry/VoiceButton';
import { keyboardAppearanceFor } from '../../ground/ground';
import {
  COMPANION,
  composerView,
  draftComposerState,
  type ComposerView,
  type PlayComposerState,
} from './model';
import { composerButtonPaint } from './paint';
import { useCompanionPaint, type CompanionPaint } from './use-companion';

export type PlayComposerProps = {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly onSend: () => void;
  readonly onStop: () => void;
  /** A2's composerState; until it is wired, Send once something is typed. */
  readonly composerState?: PlayComposerState;
  /** First open (Ember 06): Send in the accent. */
  readonly firstOpen?: boolean;
  /** The conversation's voice button (A6): the role and the chat's id; none by default. */
  readonly voice?: VoiceButtonProps;
  /** Just before the voice button: the EN/PT switch (A6, LanguageChip); none by default. */
  readonly language?: ReactNode;
  /** Above the field: the attached files' chips. */
  readonly above?: ReactNode;
  /** At the field's start: the [+] that attaches files. */
  readonly leading?: ReactNode;
};

const { composer, target } = COMPANION;
const BUTTON_SLOP = hitSlopFor(composer.button, composer.button);

function buttonOpacity(disabled: boolean, pressed: boolean): number {
  if (disabled) return DISABLED_OPACITY;
  return pressed ? COMPANION.pressedOpacity : 1;
}

type ButtonProps = {
  readonly view: ComposerView;
  readonly paint: CompanionPaint;
  readonly onSend: () => void;
  readonly onStop: () => void;
};

function ComposerButton({ view, paint, onSend, onStop }: ButtonProps) {
  const { fill, ink } = composerButtonPaint(view, paint);
  return (
    <Pressable
      onPress={view.square ? onStop : onSend}
      disabled={view.disabled}
      hitSlop={BUTTON_SLOP}
      accessibilityRole="button"
      accessibilityLabel={view.label}
      accessibilityHint={view.hint}
      accessibilityState={{ disabled: view.disabled }}
      style={({ pressed }) => [
        styles.button,
        {
          width: composer.button,
          height: composer.button,
          borderRadius: paint.style.radii.full,
          backgroundColor: fill,
          opacity: buttonOpacity(view.disabled, pressed),
        },
      ]}
    >
      {view.square ? (
        <View
          style={{
            width: composer.square,
            height: composer.square,
            borderRadius: composer.squareRadius,
            backgroundColor: ink,
          }}
        />
      ) : (
        <ArrowUp size={composer.icon} color={ink} strokeWidth={ICON_STROKE} />
      )}
    </Pressable>
  );
}

export function PlayComposer({
  value,
  onChangeText,
  onSend,
  onStop,
  composerState,
  firstOpen = false,
  voice,
  language,
  above,
  leading,
}: PlayComposerProps) {
  const paint = useCompanionPaint();
  if (!paint) return null;
  const { vars, lines, style, text3 } = paint;
  const view = composerView(composerState ?? draftComposerState(value), firstOpen);
  const face = style.type.body(composer.size);
  const padY = Math.max(0, (target - face.lineHeight) / 2);
  const notice = composerState?.notice ?? null;
  return (
    <View style={{ gap: style.tokens.spacing.space2 }}>
      {notice ? (
        <Text style={[style.type.body(composer.noticeSize), { color: vars.groundText2 }]}>
          {notice.text}
        </Text>
      ) : null}
      {above}
      <View
        style={[
          styles.field,
          {
            gap: style.tokens.spacing.space3,
            padding: composer.fieldPad,
            paddingLeft: composer.fieldPadLeft,
            borderRadius: style.radii.input,
            backgroundColor: vars.groundSurface,
            borderColor: lines.fieldLine,
          },
        ]}
      >
        {leading}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={view.placeholder}
          placeholderTextColor={text3}
          editable={view.editable}
          multiline
          submitBehavior="newline"
          returnKeyType="default"
          allowFontScaling
          keyboardAppearance={keyboardAppearanceFor(style)}
          accessibilityLabel={view.placeholder}
          accessibilityState={{ disabled: !view.editable }}
          selectionColor={vars.accent}
          style={[
            styles.input,
            face,
            {
              color: vars.groundText,
              paddingVertical: padY,
              maxHeight: face.lineHeight * composer.maxLines + padY * 2,
            },
          ]}
        />
        {language}
        {voice ? <VoiceButton {...voice} /> : null}
        <ComposerButton view={view} paint={paint} onSend={onSend} onStop={onStop} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1 },
  input: { flex: 1, minWidth: 0, minHeight: target, textAlignVertical: 'top' },
  button: { alignItems: 'center', justifyContent: 'center' },
});
