// A style's type (PRD-001 §4.6, D57, D38): styleType(resolved) answers title, display, body,
// mono, label, eyebrow and button for the layout it paints and its look's font knob. Studio is the
// foundation's scale (studio-type.ts), Play Ember's (play-type.ts), HUD its README's (hud-type.ts),
// Arcade the handheld's (arcade-type.ts).
// Nothing is below 11 pt, and Dynamic Type stays on: these are plain text styles, and the Text
// primitive passes TEXT_SCALING (allowFontScaling true, uncapped) with every one of them.

import { TYPE_STYLE_KEYS, type TypeStyleKey } from '../../core/frozen/lib/looks/catalogue';
import { HUD_FONT_KEYS, type HudFontKey } from '../tokens/hud-catalogue';
import { arcadeType } from './arcade-type';
import { hudType } from './hud-type';
import { playType } from './play-type';
import { STUDIO_STYLE_TYPE } from './studio-type';
import type { StyleType, TypeSource } from './types';

function byKey<K extends string>(keys: readonly K[], build: (key: K) => StyleType) {
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, build(key)]))) as Readonly<
    Record<K, StyleType>
  >;
}

/** Built once, when the module loads: a face the app does not bundle fails here, not on screen. */
const PLAY_TYPES = byKey<TypeStyleKey>(TYPE_STYLE_KEYS, playType);
const HUD_TYPES = byKey<HudFontKey>(HUD_FONT_KEYS, hudType);
const ARCADE_TYPE = arcadeType();

/** The type a resolved style paints with: one frozen value per layout and font knob. */
export function styleType(source: TypeSource): StyleType {
  if (source.layout === 'play') return PLAY_TYPES[source.font];
  if (source.layout === 'hud') return HUD_TYPES[source.font];
  if (source.layout === 'arcade') return ARCADE_TYPE;
  if (source.layout === 'candy') return STUDIO_STYLE_TYPE; // CANDY_STAND_IN US-023d
  return STUDIO_STYLE_TYPE;
}

export type { DisplaySlot, StyleType, TitleRole, TypeOptions, TypeSource } from './types';
export { DISPLAY_SLOTS, TITLE_ROLES } from './types';
