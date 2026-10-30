// What PixelSprite and AgentAvatar draw, pure (D-ARC-5, D-ARC-6, D-TOKENS): the sprite's colours
// from the catalogue's SPRITE_COLOURS by the palette's art (the bronze robot on the dark palettes,
// the four screen shades on Handheld; never a literal here), its size (32 sprite pixels, each the
// look's pixelScale in points, the portrait twice that: the kit's art.module.css 'small' and
// 'portrait'; the status bar's mark one point each whatever the scale, the kit's 32 px 'still'),
// and a picture's runs as rects grouped by colour, so Skia draws one path per colour. A party
// robot (agents-icons.ts) takes its body and shade from AGENT_COLOURS by its place in the roster,
// cycled over the four robots, and its outline, crest, visor and eyes from the sprite's colours, as
// the kit's art.module.css fills them; it is 32 points at every scale (the kit's 'agent-small').
// Every rect sits on whole points, so a pixel never blurs. Pure: no React, React Native, Expo or
// Skia.

import {
  AGENT_COLOURS,
  SPRITE_COLOURS,
  SPRITE_KEYS,
  type SpriteKey,
} from '../../tokens/arcade-catalogue';
import { arcadePalette, arcadePixelScale, type ArcadePaintPicks } from '../../tokens/arcade';
import { AGENT_ART, AGENT_LOOKS, AGENT_SIZE, type AgentKey } from './agents-icons';
import { AUTO_SIZE } from './auto-sprite';
import type { Run } from './grid';
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

/** One colour of a picture: every rect Skia fills with it. */
export type ArtLayer<K extends string = string> = {
  readonly key: K;
  readonly colour: string;
  readonly rects: readonly SpriteRect[];
};

export type SpriteLayer = ArtLayer<SpriteKey>;

/** The runs by colour (`keys`' order, keys with no run left out), `pixel` points each. */
export function artLayers<K extends string>(
  runs: readonly Run<K>[],
  keys: readonly K[],
  colours: Readonly<Record<K, string>>,
  pixel: number,
): readonly ArtLayer<K>[] {
  const layers = keys.map((key) => {
    const rects = runs
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

/** A sprite frame's runs by colour (SPRITE_KEYS' order, keys with no run left out). */
export function spriteLayers(
  frame: SpriteFrame,
  colours: SpriteColours,
  pixel: number,
): readonly SpriteLayer[] {
  return artLayers(frame, SPRITE_KEYS, colours, pixel);
}

// ── The party's robots ───────────────────────────────────────────────────────────────────────

/** A robot's colour keys, in the kit's AgentKey order (each pixel has one, so none overlaps). */
export const AGENT_KEYS: readonly AgentKey[] = Object.freeze([
  'body',
  'shade',
  'crest',
  'o',
  'v',
  'e',
]);

/** Points per robot pixel in the party strip: 16 pixels at 32 points (the kit's 'agent-small'). */
export const AGENT_PIXEL = 2;
export const AGENT_SIDE = AGENT_SIZE * AGENT_PIXEL;

export type AgentColours = Readonly<Record<AgentKey, string>>;

/** Which of the four robots an agent is, by its place in the roster (0 first), cycled. */
export function agentLook(index: number): number {
  const whole = Math.max(0, Math.floor(index));
  return whole % AGENT_LOOKS;
}

/** The robot's colours: AGENT_COLOURS by its look, the rest the palette's sprite colours. */
export function agentColours(look: Pick<ArcadePaintPicks, 'palette'>, index: number): AgentColours {
  const art = arcadePalette(look.palette).art;
  const sprite = SPRITE_COLOURS[art];
  const [body, shade] = AGENT_COLOURS[art][agentLook(index)];
  return Object.freeze({ body, shade, crest: sprite.c, o: sprite.o, v: sprite.v, e: sprite.e });
}

/** The robot at this place in the roster, as layers at AGENT_PIXEL points a pixel. */
export function agentLayers(
  look: Pick<ArcadePaintPicks, 'palette'>,
  index: number,
): readonly ArtLayer<AgentKey>[] {
  const runs = AGENT_ART[agentLook(index)];
  return artLayers(runs, AGENT_KEYS, agentColours(look, index), AGENT_PIXEL);
}
