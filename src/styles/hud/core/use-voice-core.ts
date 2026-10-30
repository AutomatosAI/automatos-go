// The voice core's paint in React (D-ONE-VOICE): the resolved style's voice colours
// (tokens/voice-colours.ts), the style itself (type, tokens) and whether loops may run. Every style
// answers, so A6's voice screen reuses the rings, the waveform, the chip and the transcript in
// Studio's ink and orange, Play's ember, HUD's accent and Arcade's palette. In Arcade the loops
// also stop while the person has paused its motion (US-022i, D-ARC-5, WCAG 2.2.2: the one pause
// the home's status bar sets stills the rings, the waveform and the cursor too).

import { useMemo } from 'react';

import { useArcadeMotion } from '../../arcade/use-arcade-motion';
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
  const { moving } = useArcadeMotion();
  const loops = style.layout === 'arcade' ? moving : style.motion.loops;
  return useMemo(() => ({ paint: voicePaint(style), style, loops }), [style, loops]);
}
