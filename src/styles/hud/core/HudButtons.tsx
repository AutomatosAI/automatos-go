// HUD's three buttons ('Automatos Command HUD.dc.html'): TYPE (64 x 44, a 1 pt line, Geist Mono 500
// 11 .1em in text2), HOLD TO TALK (an 84 pt circle, a 2 pt accent border on the accent fill, Geist
// Mono 600 11 .12em in the accent, a 30 pt glow) and STOP (64 x 44, a 1 pt line, Geist Mono 600 11
// .1em in text), 14 above, 24 at the sides and 34 below (or the home indicator's inset). HOLD TO
// TALK is drawn as designed but does nothing in this wave: VoiceOver hears it is unavailable and
// why (A6 gives it the voice, D60). STOP works only while a turn streams. Each grows with Dynamic
// Type and is at least 44 pt to touch.
//   A6's voice screen (US-019j) passes `talk`: HOLD TO TALK opens the mic on the press in and sends
// on the press out, lit (the accent, its words in the accent's ink) while the mic is held; under a
// screen reader it toggles on its 'activate' action instead (double-tap to talk, again to send). It
// may also turn TYPE off (a viewer). Without them the row is exactly HUD's home's.
//   A6's EN/PT switch (27 Oct 2026, `language`): a 44 pt square with a 1 pt line and the
// language's letters, 6 to the right of HOLD TO TALK, with the same room left empty on its other
// side so the circle stays in the middle of the row. Without it the row is as above.

import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type PressableProps,
} from 'react-native';

import { Text } from '../../../ui';
import { DISABLED_OPACITY } from '../../../ui/paint';
import {
  HUD_CORE,
  voiceButtons,
  type HudButtonView,
  type HudLanguage,
  type HudTalk,
} from './model';
import { useVoiceCore, type VoiceCore } from './use-voice-core';

const { buttons, tracking } = HUD_CORE;
const { side, talk, language: switchSize } = buttons;

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

const ACTIVATE: PressableProps['accessibilityActions'] = [{ name: 'activate' }];

type TalkHandlers = Pick<
  PressableProps,
  'onPressIn' | 'onPressOut' | 'onPress' | 'accessibilityActions' | 'onAccessibilityAction'
>;

/** A6's hold, or under a screen reader its toggle; none without A6 (HUD's home: inert). */
function talkHandlers(voice: HudTalk | undefined): TalkHandlers {
  if (!voice) return {};
  if (!voice.toggle) return { onPressIn: voice.onPressIn, onPressOut: voice.onPressOut };
  return {
    onPress: voice.onToggle,
    accessibilityActions: ACTIVATE,
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'activate') voice.onToggle();
    },
  };
}

type TalkProps = {
  readonly core: VoiceCore;
  readonly view: HudButtonView;
  readonly voice?: HudTalk;
};

function TalkButton({ core, view, voice }: TalkProps) {
  const { paint, style } = core;
  const face = style.type.mono(HUD_CORE.monoSize, 600, { trackingEm: tracking.talk });
  const lit = voice?.active === true;
  return (
    <Pressable
      {...talkHandlers(voice)}
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
          backgroundColor: lit ? paint.accent : paint.accentFill,
          boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: talk.glow, color: paint.glow }],
          opacity: voice && view.disabled ? DISABLED_OPACITY : 1,
        },
      ]}
    >
      <Text style={[face, styles.centred, { color: lit ? paint.accentInk : paint.accent }]}>
        {view.text}
      </Text>
    </Pressable>
  );
}

type LanguageProps = { readonly core: VoiceCore; readonly language: HudLanguage };

/** The EN/PT switch: the language's letters in a 44 pt square, a tap switching it. */
function LanguageButton({ core, language }: LanguageProps) {
  const { paint, style } = core;
  const face = style.type.mono(HUD_CORE.monoSize, 600, { trackingEm: tracking.mono });
  return (
    <Pressable
      onPress={language.onPress}
      accessibilityRole="button"
      accessibilityLabel={language.label}
      accessibilityHint={language.hint}
      style={({ pressed }) => [
        styles.side,
        {
          minWidth: switchSize.size,
          minHeight: switchSize.size,
          borderWidth: switchSize.border,
          borderColor: paint.line,
          backgroundColor: pressed ? paint.accentFill : undefined,
        },
      ]}
    >
      <Text style={[face, { color: paint.text }]}>{language.text}</Text>
    </Pressable>
  );
}

/** HOLD TO TALK, with the EN/PT switch to its right when given (and its twin room to its left). */
function Centre({ core, view, voice, language }: TalkProps & { readonly language?: HudLanguage }) {
  const button = <TalkButton core={core} view={view} voice={voice} />;
  if (!language) return button;
  return (
    <View style={[styles.centre, { gap: switchSize.gap }]}>
      <View style={{ width: switchSize.size }} />
      {button}
      <LanguageButton core={core} language={language} />
    </View>
  );
}

export type HudButtonsProps = {
  /** A turn is streaming: STOP is on. */
  readonly streaming: boolean;
  readonly onType: () => void;
  readonly onStop: () => void;
  /** The home indicator's inset: the row keeps at least its 34 pt below. */
  readonly bottomInset?: number;
  /** A6: HOLD TO TALK's hold handlers, words and state; absent, it stays inert. */
  readonly talk?: HudTalk;
  /** A6: TYPE is on (a viewer may not type); absent, always on. */
  readonly typeEnabled?: boolean;
  /** A6: the EN/PT switch beside HOLD TO TALK; absent, none. */
  readonly language?: HudLanguage;
};

export function HudButtons(props: HudButtonsProps) {
  const { streaming, onType, onStop, bottomInset = 0, talk: voice, typeEnabled, language } = props;
  const core = useVoiceCore();
  const view = voiceButtons(streaming, voice, typeEnabled);
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
      <Centre core={core} view={view.talk} voice={voice} language={language} />
      <SideButton core={core} view={view.stop} weight={600} ink={paint.text} onPress={onStop} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { alignItems: 'center', justifyContent: 'center' },
  talk: { alignItems: 'center', justifyContent: 'center' },
  centre: { flexDirection: 'row', alignItems: 'center' },
  centred: { textAlign: 'center' },
});
