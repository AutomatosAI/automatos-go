// The voice core's paint in React (D-ONE-VOICE): the resolved style's voice colours
// (tokens/voice-colours.ts), the style itself (type, tokens) and whether loops may run. Every style
// answers, so A6's voice screen reuses the rings, the waveform, the chip and the transcript in
// Studio's ink and orange, Play's ember and HUD's accent.

import { useMemo } from 'react';

import type { ResolvedStyle } from '../../provider/resolve';
import { useStyle } from '../../theme';
import { voicePaint, type VoicePaint } from '../../tokens/voice-colours';

export type VoiceCore = {
  readonly paint: VoicePaint;
  readonly style: ResolvedStyle;
  readonly loops: boolean;
};

export function useVoiceCore(): VoiceCore {
  const style = useStyle();
  return useMemo(
    () => ({ paint: voicePaint(style), style, loops: style.motion.loops }),
    [style],
  );
}
