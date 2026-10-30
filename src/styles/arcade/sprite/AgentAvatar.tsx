// A party member's robot on screen (D-ARC-6; the kit's art/pixel-art.tsx AgentAvatar, ported): one
// of the four 16-pixel robots by its place in the roster, cycled, in that place's AGENT_COLOURS on
// the palette's sprite colours (paint.ts agentLayers), 32 points at every scale, drawn crisp by
// PixelSprite.tsx's PixelArt. It never moves. Decoration unless labelled: the party strip names
// each member itself.

import { useMemo } from 'react';

import { useStyle } from '../../theme';
import { ARCADE_DEFAULT_LOOK } from '../look-schema';
import { AGENT_SIDE, agentLayers } from './paint';
import { PixelArt } from './PixelSprite';

export type AgentAvatarProps = {
  /** The agent's place in the roster, 0 first. */
  readonly index: number;
  /** The agent's name and state for VoiceOver; leave it out where the words around it say them. */
  readonly label?: string;
};

export function AgentAvatar({ index, label }: AgentAvatarProps) {
  const palette = (useStyle().arcadeLook ?? ARCADE_DEFAULT_LOOK).palette;
  const layers = useMemo(() => agentLayers({ palette }, index), [palette, index]);
  return <PixelArt layers={layers} side={AGENT_SIDE} label={label} />;
}
