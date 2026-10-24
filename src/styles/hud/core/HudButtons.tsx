// HUD's three buttons ('Automatos Command HUD.dc.html'): TYPE (64 x 44, a 1 pt line, Geist Mono 500
// 11 .1em in text2), HOLD TO TALK (an 84 pt circle, a 2 pt accent border on the accent fill, Geist
// Mono 600 11 .12em in the accent, a 30 pt glow) and STOP (64 x 44, a 1 pt line, Geist Mono 600 11
// .1em in text), 14 above, 24 at the sides and 34 below (or the home indicator's inset). HOLD TO
// TALK is drawn as designed but does nothing in this wave: VoiceOver hears it is unavailable and
// why (A6 gives it the voice, D60). STOP works only while a turn streams. Each grows with Dynamic
// Type and is at least 44 pt to touch.

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { DISABLED_OPACITY } from '../../../ui/paint';
import { HUD_CORE, hudButtons, type HudButtonView } from './model';
import { useVoiceCore, type VoiceCore } from './use-voice-core';

const { buttons, tracking } = HUD_CORE;
const { side, talk } = buttons;

type SideProps = {
  readonly core: VoiceCore;
  readonly view: HudButtonView;
  readonly weight: 500 | 600;
  readonly ink: string;
  readonly onPress: () => void;
};

function SideButton({ core, view, weight, ink, onPress }: SideProps) {
  const { paint, style } = core;
  const face = style.type.mono(HUD_CORE.monoSize, weight, { trackingEm: tracking.mono });
  return (
    <Pressable
      onPress={onPress}
      disabled={view.disabled}
      accessibilityRole="button"
      accessibilityLabel={view.label}
      accessibilityHint={view.hint}
      accessibilityState={{ disabled: view.disabled }}
      style={({ pressed }) => [
        styles.side,
        {
          minWidth: side.width,
          minHeight: side.height,
          borderWidth: side.border,
          borderColor: paint.line,
          backgroundColor: pressed ? paint.accentFill : undefined,
          opacity: view.disabled ? DISABLED_OPACITY : 1,
        },
      ]}
    >
      <Text style={[face, { color: ink }]}>{view.text}</Text>
    </Pressable>
  );
}

function TalkButton({ core, view }: { readonly core: VoiceCore; readonly view: HudButtonView }) {
  const { paint, style } = core;
  const face = style.type.mono(HUD_CORE.monoSize, 600, { trackingEm: tracking.talk });
  return (
    <Pressable
      disabled={view.disabled}
      accessibilityRole="button"
      accessibilityLabel={view.label}
      accessibilityHint={view.hint}
      accessibilityState={{ disabled: view.disabled }}
      style={[
        styles.talk,
        {
          minWidth: talk.size,
          minHeight: talk.size,
          borderRadius: talk.size / 2,
          borderWidth: talk.border,
          borderColor: paint.accent,
          backgroundColor: paint.accentFill,
          boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: talk.glow, color: paint.glow }],
        },
      ]}
    >
      <Text style={[face, styles.centred, { color: paint.accent }]}>{view.text}</Text>
    </Pressable>
  );
}

export type HudButtonsProps = {
  /** A turn is streaming: STOP is on. */
  readonly streaming: boolean;
  readonly onType: () => void;
  readonly onStop: () => void;
  /** The home indicator's inset: the row keeps at least its 34 pt below. */
  readonly bottomInset?: number;
};

export function HudButtons({ streaming, onType, onStop, bottomInset = 0 }: HudButtonsProps) {
  const core = useVoiceCore();
  const view = hudButtons(streaming);
  const { paint } = core;
  return (
    <View
      style={[
        styles.row,
        {
          paddingTop: buttons.padTop,
          paddingHorizontal: buttons.padX,
          paddingBottom: Math.max(buttons.padBottom, bottomInset),
        },
      ]}
    >
      <SideButton core={core} view={view.type} weight={500} ink={paint.text2} onPress={onType} />
      <TalkButton core={core} view={view.talk} />
      <SideButton core={core} view={view.stop} weight={600} ink={paint.text} onPress={onStop} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { alignItems: 'center', justifyContent: 'center' },
  talk: { alignItems: 'center', justifyContent: 'center' },
  centred: { textAlign: 'center' },
});
