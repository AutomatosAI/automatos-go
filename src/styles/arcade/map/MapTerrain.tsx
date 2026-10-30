// The overworld's terrain on screen (PRD-001 §4.6.1 D-ARC-6; the design kit's quests/map-view.tsx
// Terrain, ported): Skia draws world-map.ts's rects in the palette's map colours, one crisp path
// per colour with no antialiasing (PixelSprite's ArtPath, in map-paint.ts's layer order), scaled
// to the width the screen gives it, 40 × 24 tiles tall. Drawn once per palette and width. It is
// decoration: VoiceOver skips it (the region names and the markers say what the map holds).

import { Canvas } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { useArcadePaint } from '../parts/use-arcade-paint';
import { ArtPath } from '../sprite/PixelSprite';
import { mapHeightFor, mapLayers } from './map-paint';

export type MapTerrainProps = {
  /** The map's width in points; its height follows the tiles. */
  readonly width: number;
};

export const MapTerrain = memo(function MapTerrain({ width }: MapTerrainProps) {
  const { palette } = useArcadePaint().look;
  const layers = useMemo(() => mapLayers({ palette }, width), [palette, width]);
  const size = { width, height: mapHeightFor(width) };
  return (
    <View
      style={size}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Canvas style={size}>
        {layers.map((layer) => (
          <ArtPath key={layer.key} layer={layer} />
        ))}
      </Canvas>
    </View>
  );
});
