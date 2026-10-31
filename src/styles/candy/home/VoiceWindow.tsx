// The voice window over Candy's tab bar (US-023g, D-AI-LABEL, D-A11Y): while hold to talk works, has
// a line to say, or Stop is on, a window card (rs, the window's fill and the palette's tinted
// shadow) floats over the raised voice. It opens with the untouched AI label (one muted caption,
// D73: Auto speaks here, so he is named an AI here), then the voice's state words as a glyph and a
// word ('● Listening', the lit circle's text twin, announced as they change), A6's own VoiceLine
// (why the mic cannot start, Open Settings, Download, 'See it in the chat', which opens the Chat
// view) and Stop (quick-ask's, and A2's for a typed turn). The home places it over the tab bar; on
// the Chat view it sits in the column over the message box (US-023h, chat.ts chatViewVoice).

import { StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import type { CandyHomeVoice } from '../../../voice/home/use-candy-home-voice';
import { VoiceLine } from '../../../voice/screen/VoiceLine';
import { AiLabel } from '../../ai-label';
import { Pill } from '../parts/Pill';
import { TAB_BAR } from '../parts/tab-bar';
import { useCandyPaint } from '../parts/use-candy-paint';
import { CANDY_COPY, CANDY_VOICE_COPY } from '../strings';

const WINDOW = Object.freeze({ padV: 12, padH: 16, gap: 6 });

type WindowVoice = Pick<CandyHomeVoice, 'caption' | 'line' | 'lineAction' | 'stopEnabled' | 'stop'>;

export type VoiceWindowProps = {
  readonly voice: WindowVoice;
  /** How far over the screen's foot it floats (above the tab bar); in the column when omitted. */
  readonly bottom?: number;
};

/** Whether the window has anything to say. */
export function voiceWindowShown(voice: WindowVoice): boolean {
  return voice.caption !== null || voice.line !== null || voice.stopEnabled;
}

export function VoiceWindow({ voice, bottom }: VoiceWindowProps) {
  const { vars, type, rs, shadow } = useCandyPaint();
  if (!voiceWindowShown(voice)) return null;
  const { caption } = voice;
  return (
    <View
      style={[
        styles.window,
        bottom === undefined ? styles.inColumn : [styles.floating, { bottom }],
        { borderRadius: rs, backgroundColor: vars.win },
        shadow,
      ]}
    >
      <AiLabel />
      {caption ? (
        <View accessible accessibilityLabel={caption.label} accessibilityLiveRegion="polite">
          <Text style={[type.display('status'), { color: vars.text }]}>
            {`${CANDY_COPY.statusGlyph.active} ${caption.text}`}
          </Text>
        </View>
      ) : null}
      <VoiceLine line={voice.line} onAction={voice.lineAction} />
      {voice.stopEnabled ? (
        <View style={styles.stop}>
          <Pill
            label={CANDY_VOICE_COPY.stop}
            accessibilityHint={CANDY_VOICE_COPY.stopHint}
            onPress={voice.stop}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  floating: { position: 'absolute', left: TAB_BAR.side, right: TAB_BAR.side },
  inColumn: { marginHorizontal: TAB_BAR.side },
  window: {
    paddingVertical: WINDOW.padV,
    paddingHorizontal: WINDOW.padH,
    gap: WINDOW.gap,
    alignItems: 'center',
  },
  stop: { alignSelf: 'center' },
});
