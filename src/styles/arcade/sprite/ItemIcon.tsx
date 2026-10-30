// An Inventory item's icon on screen (D-ARC-6; the kit's art/pixel-art.tsx ItemIcon, ported): the
// 12-pixel report, document, image or post (agents-icons.ts ICON_ART) in the palette's
// ICON_COLOURS, at the look's pixel scale plus one point a pixel (paint.ts iconLayers), drawn crisp
// by PixelSprite.tsx's PixelArt. It never moves. Decoration: the slot says the item's kind in words.

import { useMemo } from 'react';

import { useStyle } from '../../theme';
import { ARCADE_DEFAULT_LOOK } from '../look-schema';
import type { ItemKind } from './agents-icons';
import { iconLayers, iconSide } from './paint';
import { PixelArt } from './PixelSprite';

export function ItemIcon({ kind }: { readonly kind: ItemKind }) {
  const look = useStyle().arcadeLook ?? ARCADE_DEFAULT_LOOK;
  const layers = useMemo(() => iconLayers(look, kind), [look, kind]);
  return <PixelArt layers={layers} side={iconSide(look)} />;
}
