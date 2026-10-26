// Each style's whole token set (Tokens, types.ts): the colours a look paints (play.ts, hud.ts, or
// an installed theme's, US-016i) with that style's radii (radii.ts), the foundation's spacing,
// shadows and type scale, and the chat thread's paint derived from those colours (thread.ts), so
// every shared screen reads Play and HUD through the same accessor it reads Studio by. One frozen
// value per look (or painting) object, so a screen's memoised styles hold until the look changes.
// Studio's own two sets stay studio.ts's (studioTokens), unchanged.

import type { Look } from '../../core/frozen/lib/looks/types';
import { STUDIO_TYPE } from '../type';
import { HUD_TONE, hudTokens, type HudPaintPicks } from './hud';
import { playTokens, playTone } from './play';
import { STYLE_RADII } from './radii';
import { STUDIO_SHADOWS, STUDIO_SPACING, STUDIO_THREAD } from './studio';
import { threadPaint } from './thread';
import type { ColourScheme, Colours, Radii, StyleId, Tokens } from './types';

function assemble(style: StyleId, scheme: ColourScheme, colours: Colours, radii: Radii): Tokens {
  return Object.freeze({
    style,
    scheme,
    colours,
    radii,
    spacing: STUDIO_SPACING,
    shadows: STUDIO_SHADOWS,
    type: STUDIO_TYPE,
    // the web's white mark on Auto's disc, as Studio draws it in both tones
    thread: threadPaint(colours, STUDIO_THREAD[scheme].sail),
  });
}

/** build(key), once per key object: the same value back while the caller keeps the same object. */
export function oncePerObject<Key extends object, Value>(
  build: (key: Key) => Value,
): (key: Key) => Value {
  const built = new WeakMap<Key, Value>();
  return (key) => {
    const found = built.get(key);
    if (found !== undefined) return found;
    const value = build(key);
    built.set(key, value);
    return value;
  };
}

/** A Play look's set: the ground's tone (the phone's Light / Dark / System does not apply). */
export const playStyleTokens: (look: Look) => Tokens = oncePerObject((look: Look) =>
  assemble('play', playTone(look), playTokens(look), STYLE_RADII.play),
);

/** A HUD look's set: always dark, square everywhere. */
export const hudStyleTokens: (look: HudPaintPicks) => Tokens = oncePerObject(
  (look: HudPaintPicks) => assemble('hud', HUD_TONE, hudTokens(look), STYLE_RADII.hud),
);

const painted = new WeakMap<Colours, Partial<Record<ColourScheme, Tokens>>>();

/** An installed theme's colours (Studio's keys) on the Studio layout, in the scheme it paints. */
export function paintedStudioTokens(colours: Colours, scheme: ColourScheme): Tokens {
  const sets = painted.get(colours) ?? {};
  const found = sets[scheme];
  if (found) return found;
  const tokens = assemble('studio', scheme, colours, STYLE_RADII.studio);
  painted.set(colours, { ...sets, [scheme]: tokens });
  return tokens;
}
