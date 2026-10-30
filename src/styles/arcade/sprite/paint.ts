// What PixelSprite draws, pure (D-ARC-5, D-TOKENS): the sprite's colours from the catalogue's
// SPRITE_COLOURS by the palette's art (the bronze robot on the dark palettes, the four screen shades
// on Handheld; never a literal here), its size (32 sprite pixels, each the look's pixelScale in
// points, the portrait twice that: the kit's art.module.css 'small' and 'portrait'; the status
// bar's mark one point each whatever the scale, the kit's 32 px 'still'), and a frame's
// runs as rects grouped by colour, so Skia draws one path per colour. Every rect sits on whole
// points, so a pixel never blurs. Pure: no React, React Native, Expo or Skia.

import { SPRITE_COLOURS, SPRITE_KEYS, type SpriteKey } from '../../tokens/arcade-catalogue';
import { arcadePalette, arcadePixelScale, type ArcadePaintPicks } from '../../tokens/arcade';
import { AUTO_SIZE } from './auto-sprite';
import type { SpriteFrame } from './states';

/**
 * 'sprite': 32 × pixelScale points; 'portrait' (the dialogue window's): twice that; 'mark' (the
 * status bar's, beside the wordmark): 32 points at every scale.
 */
export type SpriteView = 'mark' | 'sprite' | 'portrait';

/** Points per sprite pixel: the mark's fixed, the others times the look's pixel scale. */
const VIEW_PIXEL: Readonly<Record<SpriteView, (scale: number) => number>> = Object.freeze({
  mark: () => 1,
  sprite: (scale) => scale,
  portrait: (scale) => scale * 2,
});

export type SpriteColours = Readonly<Record<SpriteKey, string>>;

/** How many points one sprite pixel takes in this view. */
export function spritePixel(look: Pick<ArcadePaintPicks, 'pixelScale'>, view: SpriteView): number {
  return VIEW_PIXEL[view](arcadePixelScale(look));
}

/** The sprite's side in points. */
export function spriteSide(look: Pick<ArcadePaintPicks, 'pixelScale'>, view: SpriteView): number {
  return AUTO_SIZE * spritePixel(look, view);
}

/** The palette's sprite colours: Handheld's shades in Handheld, the bronze robot elsewhere. */
export function spriteColours(look: Pick<ArcadePaintPicks, 'palette'>): SpriteColours {
  return SPRITE_COLOURS[arcadePalette(look.palette).art];
}

export type SpriteRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type SpriteLayer = {
  readonly key: SpriteKey;
  readonly colour: string;
  readonly rects: readonly SpriteRect[];
};

/** The frame's runs by colour (SPRITE_KEYS' order, keys with no run left out), `pixel` points each. */
export function spriteLayers(
  frame: SpriteFrame,
  colours: SpriteColours,
  pixel: number,
): readonly SpriteLayer[] {
  const layers = SPRITE_KEYS.map((key) => {
    const rects = frame
      .filter((run) => run.key === key)
      .map((run) =>
        Object.freeze({
          x: run.x * pixel,
          y: run.y * pixel,
          width: run.width * pixel,
          height: pixel,
        }),
      );
    return Object.freeze({ key, colour: colours[key], rects: Object.freeze(rects) });
  });
  return Object.freeze(layers.filter((layer) => layer.rects.length > 0));
}
