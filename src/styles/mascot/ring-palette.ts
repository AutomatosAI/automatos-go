// The light ring under Auto, and the voice core's rings, in every style (D-MASCOT, D-ONE-VOICE,
// D60), pure. The tone for a state is the vendored ringTone (calm light, busy accent, oops error,
// asleep or lost dusk, loading quiet); the colour comes from the resolved style, never a HUD
// constant:
//
//   Play     the vendored ringColour(state, look), the web's Ember rule
//   HUD      light and accent = the look's accent (README 'Mascot contract': light and busy set to
//            the accent), error = the catalogue's fixed error colour, dusk = the vendored duskOf
//            over HUD_LOOK_CATALOGUE, quiet = the ground's text2
//   Studio   light = --foreground (ink), accent = --accent (orange), error = --destructive, dusk
//   themes   and quiet = --muted-foreground (D60: Studio paints ink and orange)

import { duskOf } from '../../core/web/lib/look-kit/css';
import { entryOf } from '../../core/web/lib/look-kit/types';
import { ringColour, ringTone, type RingTone } from '../../core/web/lib/mascot/ring';
import type { MascotName } from '../../core/web/lib/mascot/types';
import type { HudLook } from '../hud/look-schema';
import type { ResolvedStyle } from '../provider/resolve';
import { HUD_LOOK_CATALOGUE } from '../tokens/hud-catalogue';
import type { Colours } from '../tokens/types';

export type { RingTone } from '../../core/web/lib/mascot/ring';

/** Each tone's #rrggbb. */
export type RingPalette = Readonly<Record<RingTone, string>>;

/** What the ring reads of the resolved style. */
export type RingStyle = Pick<ResolvedStyle, 'layout' | 'tokens' | 'playLook' | 'hudLook'>;

/** HUD's ring for a look: everything from the look and HUD's own catalogue. */
export function hudRingPalette(look: HudLook): RingPalette {
  const accent = entryOf(HUD_LOOK_CATALOGUE.accents, look.accent, 'accent').hex;
  const ground = entryOf(HUD_LOOK_CATALOGUE.grounds, look.ground, 'ground');
  return Object.freeze({
    light: accent,
    accent,
    error: HUD_LOOK_CATALOGUE.errorColour,
    dusk: duskOf(HUD_LOOK_CATALOGUE, look.ground),
    quiet: ground.text2,
  });
}

/** Studio's ring (and a theme's): ink and orange from the Studio-keyed tokens. */
export function studioRingPalette(colours: Colours): RingPalette {
  return Object.freeze({
    light: colours.foreground,
    accent: colours.accent,
    error: colours.destructive,
    dusk: colours.mutedForeground,
    quiet: colours.mutedForeground,
  });
}

/** The ring's #rrggbb for Auto's state under the resolved style. */
export function ringColourOf(state: MascotName, style: RingStyle): string {
  if (style.layout === 'play' && style.playLook) return ringColour(state, style.playLook);
  const palette =
    style.layout === 'hud' && style.hudLook
      ? hudRingPalette(style.hudLook)
      : studioRingPalette(style.tokens.colours);
  return palette[ringTone(state)];
}
