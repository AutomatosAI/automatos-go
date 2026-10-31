// Candy's hold to talk (CANDY-LAYOUT §4: the tab bar's raised centre, A6's own voice control dressed
// with a white fill inside the accent ring the tab bar draws round it): a 64 pt circle in the
// window's fill with lucide's mic in the accent, the accent with its ink while the mic is held. It is
// A6's quick-ask as HUD's and Arcade's homes hold it (useCandyHomeVoice): held from the press in to
// the press out, a toggle under a screen reader (HUD's talkHandlers), the words VoiceOver hears and
// the hint saying how to use it (voiceView's, KV8). Its words twin is the voice window's caption
// while it works ('Listening'), and a tap that is too short says to hold (the window's line). The
// circle stays 64 at every text size: it holds no words, and the tab bar's centre column is fixed.

import Mic from 'lucide-react-native/icons/mic';
import { Pressable, StyleSheet } from 'react-native';

import { DISABLED_OPACITY, ICON_STROKE } from '../../../ui/paint';
import { talkHandlers } from '../../hud/core/HudButtons';
import type { HudTalk } from '../../hud/core/model';
import { TAB_BAR } from '../parts/tab-bar';
import { useCandyPaint } from '../parts/use-candy-paint';

const MIC_SIZE = 26;

export type CandyTalkButtonProps = {
  /** The voice's talk button: its words, state and hold (useCandyHomeVoice). */
  readonly talk: HudTalk;
};

export function CandyTalkButton({ talk }: CandyTalkButtonProps) {
  const { vars } = useCandyPaint();
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
        { backgroundColor: lit ? vars.accent : vars.win },
        { opacity: talk.enabled ? 1 : DISABLED_OPACITY },
      ]}
    >
      <Mic size={MIC_SIZE} color={lit ? vars.accentInk : vars.accent} strokeWidth={ICON_STROKE} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  talk: {
    width: TAB_BAR.voice,
    height: TAB_BAR.voice,
    borderRadius: TAB_BAR.voice / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
