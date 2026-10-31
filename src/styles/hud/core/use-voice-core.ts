// The voice core's paint in React (D-ONE-VOICE): the resolved style's voice colours
// (tokens/voice-colours.ts), the style itself (type, tokens) and whether loops may run. Every style
// answers, so A6's voice screen reuses the rings, the waveform, the chip and the transcript in
// Studio's ink and orange, Play's ember, HUD's accent and Arcade's palette. In Arcade the loops
// also stop while the person has paused its motion (US-022i, D-ARC-5, WCAG 2.2.2: the one pause,
// set from the home's status bar or the voice screen's own control, stills the rings, the waveform
// and the cursor too). In Candy they follow Candy's motion (US-023l, D-CAN-5): Reduce Motion, the
// look's Motion 'paused' and the person's pause, set on the home or the voice screen, still them
// with the orb's arc and Auto.

import { useMemo } from 'react';

import { useArcadeMotion } from '../../arcade/use-arcade-motion';
import { useCandyMotion } from '../../candy/use-candy-motion';
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
  const candy = useCandyMotion();
  const own = style.layout === 'candy' ? candy.moving : style.motion.loops;
  const loops = style.layout === 'arcade' ? moving : own;
  return useMemo(() => ({ paint: voicePaint(style), style, loops }), [style, loops]);
}
