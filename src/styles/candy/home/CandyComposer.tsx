// Candy's message box (PRD-001 §4.6.2, US-023h; CANDY-LAYOUT §4 P2, the 390 mock and the kit's
// chat/composer.tsx at 3920359d5), as play/companion/PlayComposer.tsx is Play's: 14 in from the
// screen's sides and 28 above the bottom inset, a pill at least 56 tall in the window's fill under
// the palette's tinted shadow, 'Message Auto' in the quiet text, and a 44 pt accent circle that
// sends (lucide's arrow up in the accent's ink, 'Send') and is Stop while Auto answers (its square,
// 'Stop' with its hint). Return inserts a newline: only the button sends (A2's D-COMPOSER). A2's
// composerState (composer.ts candyComposerView) says when the pill takes no typing and the button
// does nothing, and gives a viewer's notice above it. A2's attachments sit in the slots: their
// chips above the pill, the [+] at its start. To its right, A6's hold to talk at 56 (Candy's talk
// button over useCandyHomeVoice; none for a viewer). No AI label sits beside it (D73: the caption
// opens the thread). The keyboard takes the palette's tone (keyboardAppearanceFor); the home hears
// the pill's focus and blur (Auto listens while it has the keyboard).

import ArrowUp from 'lucide-react-native/icons/arrow-up';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ComposerState } from '../../../chat/composer/composer-state';
import { Text } from '../../../ui';
import { DISABLED_OPACITY, ICON_STROKE, hitSlopFor } from '../../../ui/paint';
import { keyboardAppearanceFor } from '../../ground/ground';
import type { HudTalk } from '../../hud/core/model';
import { useStyle } from '../../theme';
import { useCandyPaint } from '../parts/use-candy-paint';
import { COMPOSER, candyComposerView, type CandyComposerView } from './composer';
import { CandyTalkButton } from './TalkButton';

const SEND_SLOP = hitSlopFor(COMPOSER.send, COMPOSER.send);
const PRESSED_OPACITY = 0.7;

export type CandyComposerProps = {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly onSend: () => void;
  readonly onStop: () => void;
  /** A2's composerState over the home's thread. */
  readonly composerState: ComposerState;
  /** Hold to talk beside the pill (useCandyHomeVoice); none for a viewer. */
  readonly talk?: HudTalk | null;
  /** Above the pill: the attached files' chips. */
  readonly above?: ReactNode;
  /** At the pill's start: the [+] that attaches files. */
  readonly leading?: ReactNode;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
};

type SendProps = Pick<CandyComposerProps, 'onSend' | 'onStop'> & {
  readonly view: CandyComposerView;
};

function buttonOpacity(disabled: boolean, pressed: boolean): number {
  if (disabled) return DISABLED_OPACITY;
  return pressed ? PRESSED_OPACITY : 1;
}

function SendButton({ view, onSend, onStop }: SendProps) {
  const { vars } = useCandyPaint();
  const ink = vars.accentInk;
  return (
    <Pressable
      onPress={view.stop ? onStop : onSend}
      disabled={view.disabled}
      hitSlop={SEND_SLOP}
      accessibilityRole="button"
      accessibilityLabel={view.label}
      accessibilityHint={view.hint}
      accessibilityState={{ disabled: view.disabled }}
      style={({ pressed }) => [
        styles.send,
        { backgroundColor: vars.accent, opacity: buttonOpacity(view.disabled, pressed) },
      ]}
    >
      {view.stop ? (
        <View style={[styles.square, { backgroundColor: ink }]} />
      ) : (
        <ArrowUp size={COMPOSER.icon} color={ink} strokeWidth={ICON_STROKE} />
      )}
    </Pressable>
  );
}

export function CandyComposer({
  value,
  onChangeText,
  onSend,
  onStop,
  composerState,
  talk = null,
  above,
  leading,
  onFocus,
  onBlur,
}: CandyComposerProps) {
  const style = useStyle();
  const { vars, type, round, shadow } = useCandyPaint();
  const insets = useSafeAreaInsets();
  const view = candyComposerView(composerState);
  const face = type.body(COMPOSER.size);
  const padY = Math.max(0, (COMPOSER.send - face.lineHeight) / 2);
  const { notice } = composerState;
  return (
    <View style={[styles.box, { paddingBottom: insets.bottom + COMPOSER.bottom }]}>
      {notice ? <Text style={[type.label, { color: vars.quiet }]}>{notice.text}</Text> : null}
      {above}
      <View style={styles.row}>
        <View style={[styles.pill, { borderRadius: round, backgroundColor: vars.win }, shadow]}>
          {leading}
          <TextInput
            value={value}
            onChangeText={onChangeText}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={view.placeholder}
            placeholderTextColor={vars.quiet}
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
                color: vars.text,
                paddingVertical: padY,
                maxHeight: face.lineHeight * COMPOSER.maxLines + padY * 2,
              },
            ]}
          />
          <SendButton view={view} onSend={onSend} onStop={onStop} />
        </View>
        {talk ? (
          <View style={[{ borderRadius: round }, shadow]}>
            <CandyTalkButton talk={talk} size={COMPOSER.talk} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingHorizontal: COMPOSER.side, gap: COMPOSER.gap },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: COMPOSER.gap },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: COMPOSER.pill,
    paddingVertical: (COMPOSER.pill - COMPOSER.send) / 2,
    paddingLeft: COMPOSER.padLeft,
    paddingRight: COMPOSER.padRight,
  },
  input: { flex: 1, minWidth: 0, minHeight: COMPOSER.send, textAlignVertical: 'top' },
  send: {
    width: COMPOSER.send,
    height: COMPOSER.send,
    borderRadius: COMPOSER.send / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  square: { width: COMPOSER.square, height: COMPOSER.square, borderRadius: COMPOSER.squareRadius },
});
