// The handheld's controls under the screen (README 'Pages'; the design kit's frame/controls.tsx and
// the 'Phone 390' controls): the D-pad (▲ Quests, ◀ Chat, ▶ Inventory, ▼ Menu; the home says where
// each goes) and the voice button in the round arcade surround, side by side, wrapping onto two
// rows when the phone's width or text size leaves no room. The voice button is A6's quick-ask as
// HUD's home holds it (useArcadeHomeVoice): HOLD TO TALK held from the press in to the press out,
// a toggle under a screen reader, lit in the accent while the mic is held, the words saying why
// when it is off. Under the surround, the voice's state words while it works (the caption, the
// text twin of the lit button) and the EN/PT switch; under the row, the voice's line (A6's
// VoiceLine: why the mic cannot start, Open Settings).

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { DISABLED_OPACITY, MIN_TOUCH } from '../../../ui/paint';
import type { ArcadeHomeVoice } from '../../../voice/home/use-arcade-home-voice';
import { VoiceLine } from '../../../voice/screen/VoiceLine';
import { talkHandlers } from '../../hud/core/HudButtons';
import type { HudLanguage, HudTalk } from '../../hud/core/model';
import { DPad, type DPadProps } from '../parts/DPad';
import { CONTROLS_PAD_H } from '../parts/pad-grid';
import { SURROUND, VoiceSurround } from '../parts/VoiceSurround';
import { useArcadePaint } from '../parts/use-arcade-paint';

/** The button inside the surround's accent ring, a 2 pt border; the row's and caption's gaps. */
const CONTROLS = Object.freeze({
  talk: SURROUND.accent - SURROUND.accentRing * 2,
  ring: 2,
  gap: 12,
  padH: CONTROLS_PAD_H,
  captionGap: 8,
});

function TalkButton({ talk }: { readonly talk: HudTalk }) {
  const { vars, type } = useArcadePaint();
  const lit = talk.active;
  return (
    <Pressable
      {...talkHandlers(talk)}
      disabled={!talk.enabled}
      accessibilityRole="button"
      accessibilityLabel={talk.label}
      accessibilityHint={talk.hint}
      accessibilityState={{ disabled: !talk.enabled, selected: lit }}
      style={[
        styles.talk,
        { backgroundColor: lit ? vars.ac : vars.page, borderColor: vars.bd },
        { opacity: talk.enabled ? 1 : DISABLED_OPACITY },
      ]}
    >
      <Text style={[type.label, styles.centred, { color: lit ? vars.aci : vars.tx }]}>
        {talk.text}
      </Text>
    </Pressable>
  );
}

function LanguageButton({ language }: { readonly language: HudLanguage }) {
  const { vars, type } = useArcadePaint();
  return (
    <Pressable
      onPress={language.onPress}
      accessibilityRole="button"
      accessibilityLabel={language.label}
      accessibilityHint={language.hint}
      style={({ pressed }) => [
        styles.language,
        { borderColor: vars.bd, backgroundColor: pressed ? vars.win : vars.page },
      ]}
    >
      <Text style={[type.label, { color: vars.tx }]}>{language.text}</Text>
    </Pressable>
  );
}

function Voice({ voice }: { readonly voice: ArcadeHomeVoice }) {
  const { vars, type } = useArcadePaint();
  const { caption, language } = voice;
  return (
    <View style={styles.voice}>
      <VoiceSurround>
        <TalkButton talk={voice.talk} />
      </VoiceSurround>
      {caption ? (
        <Text
          accessibilityLabel={caption.label}
          accessibilityLiveRegion="polite"
          style={[type.display('status'), styles.centred, { color: vars.tx2 }]}
        >
          {caption.text}
        </Text>
      ) : null}
      {language ? <LanguageButton language={language} /> : null}
    </View>
  );
}

export type ArcadeControlsProps = {
  readonly pad: DPadProps;
  readonly voice: ArcadeHomeVoice;
};

export function ArcadeControls({ pad, voice }: ArcadeControlsProps) {
  return (
    <View>
      <View style={styles.row}>
        <DPad {...pad} />
        <Voice voice={voice} />
      </View>
      <VoiceLine line={voice.line} onAction={voice.lineAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: CONTROLS.gap,
    paddingHorizontal: CONTROLS.padH,
  },
  voice: { alignItems: 'center', gap: CONTROLS.captionGap },
  talk: {
    minWidth: CONTROLS.talk,
    minHeight: CONTROLS.talk,
    borderRadius: CONTROLS.talk / 2,
    borderWidth: CONTROLS.ring,
    alignItems: 'center',
    justifyContent: 'center',
  },
  language: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    borderWidth: CONTROLS.ring,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centred: { textAlign: 'center' },
});
