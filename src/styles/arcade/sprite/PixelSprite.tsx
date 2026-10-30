// Auto as Arcade's pixel sprite on screen (PRD-001 §4.6.1, D-ARC-5; the kit's art/pixel-art.tsx
// AutoSprite and PixelArt, ported): Skia draws a picture's runs as rects, one path per colour, with
// no antialiasing, so every pixel is a whole number of points and stays crisp at every scale
// (PixelArt, which the party's robots share: AgentAvatar.tsx). 32 sprite pixels at the look's
// pixelScale (the portrait twice that), in the palette's sprite colours (Handheld's shades in
// Handheld). The state's loop steps on the shared Arcade clock (SPRITE_TICKS) while Arcade moves;
// under Reduce Motion, while paused (use-arcade-motion.ts) or when `still`, it shows frame 1 and
// does not listen to the clock. With a label a picture is an image with that name; without one it
// is decoration VoiceOver skips (the words around it say what it shows).

import { Canvas, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { View } from 'react-native';

import type { MascotName } from '../../../core/frozen/lib/mascot/types';
import { useStyle } from '../../theme';
import { ARCADE_DEFAULT_LOOK } from '../look-schema';
import { useArcadeMotion } from '../use-arcade-motion';
import { SPRITE_TICKS, frameAt } from './clock';
import {
  spriteColours,
  spriteLayers,
  spritePixel,
  spriteSide,
  type ArtLayer,
  type SpriteView,
} from './paint';
import { useTicks } from './use-ticks';

/** One path of filled rects: a Skia path is built imperatively, once per layer. */
function layerPath(layer: ArtLayer): SkPath {
  const path = Skia.Path.Make();
  layer.rects.forEach((rect) =>
    path.addRect(Skia.XYWHRect(rect.x, rect.y, rect.width, rect.height)),
  );
  return path;
}

/** One colour of a picture as one crisp path (the Quests map's terrain draws its layers with it). */
export const ArtPath = memo(function ArtPath({ layer }: { readonly layer: ArtLayer }) {
  const path = useMemo(() => layerPath(layer), [layer]);
  return <Path path={path} color={layer.colour} antiAlias={false} />;
});

export type PixelArtProps = {
  /** The picture by colour, in points (paint.ts). */
  readonly layers: readonly ArtLayer[];
  /** The square's side in points. */
  readonly side: number;
  /** Its name for VoiceOver; leave it out where the words around it say it. */
  readonly label?: string;
};

/** A pixel picture, crisp: Auto's frames here, the party's robots in AgentAvatar. */
export const PixelArt = memo(function PixelArt({ layers, side, label }: PixelArtProps) {
  const size = { width: side, height: side };
  const named = label !== undefined;
  return (
    <View
      style={size}
      pointerEvents="none"
      accessible={named}
      accessibilityRole={named ? 'image' : undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={!named}
      importantForAccessibility={named ? 'yes' : 'no-hide-descendants'}
    >
      <Canvas style={size}>
        {layers.map((layer) => (
          <ArtPath key={layer.key} layer={layer} />
        ))}
      </Canvas>
    </View>
  );
});

export type PixelSpriteProps = {
  /** Auto's state: one of the vendored mascot names. */
  readonly state: MascotName;
  /** 'sprite' (32 × pixelScale), 'portrait' (twice that) or 'mark' (32 pt); 'sprite' when omitted. */
  readonly view?: SpriteView;
  /** Auto's name and state for VoiceOver; leave it out where the words around him say it. */
  readonly label?: string;
  /** Hold frame 1 whatever the motion (a gallery's stills, a mark). */
  readonly still?: boolean;
};

export function PixelSprite({ state, view = 'sprite', label, still = false }: PixelSpriteProps) {
  const look = useStyle().arcadeLook ?? ARCADE_DEFAULT_LOOK;
  const { moving } = useArcadeMotion();
  const running = moving && !still;
  const step = useTicks(SPRITE_TICKS, running);
  const frame = frameAt(state, running ? step * SPRITE_TICKS : 0);
  const pixel = spritePixel(look, view);
  const colours = spriteColours(look);
  const layers = useMemo(() => spriteLayers(frame, colours, pixel), [frame, colours, pixel]);
  return <PixelArt layers={layers} side={spriteSide(look, view)} label={label} />;
}
