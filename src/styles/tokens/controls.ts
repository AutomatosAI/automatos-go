// Each built-in style's control sizes (styles/controls.ts ControlSizes, rule 3.5), as radii.ts
// gives each its corners: Studio's list as the handoff draws it, and the four styles whose
// buttons and filter pills are taller, each built from Studio's with its own heights. The
// controls keep Studio's sizes; a style raises the least a button and a pill are tall.
//
//   Play    Ember: buttons at least 44, filter chips 40 (Ember 04)
//   HUD     its README: buttons and chips at least 44, a button inside a panel 46
//   Arcade  buttons and chips at least 44 (the Inventory's tabs: --arcade-target)
//   Candy   buttons and chips at least 44 (the kit's filter pill is 40, raised: D-A11Y)
//
// A style resolves with its list (provider/resolve.ts), and an installed theme takes Studio's.

import type { BuiltInStyleId } from '../registry/style-id';
import { CONTROL_SPECS, STUDIO_CONTROLS, buildControlSizes, type ControlSizes } from '../controls';

/** Ember and HUD: Apple's 44 pt, the least a button or chip is tall. */
export const DRESS_MIN_HEIGHT = 44;
/** HUD's README: buttons inside a panel are 46 high. */
export const HUD_PANEL_BUTTON_HEIGHT = 46;
/** Ember 04's filter chips. */
export const PLAY_PILL_HEIGHT = 40;

/** Studio's controls, a button at least `button` tall (`inPanel` in a panel), a pill `pill`. */
function raised(button: number, inPanel: number, pill: number): ControlSizes {
  return buildControlSizes({
    ...CONTROL_SPECS,
    buttonMinHeight: button,
    panelButtonMinHeight: inPanel,
    pillMinHeight: pill,
  });
}

export const STYLE_CONTROLS = Object.freeze({
  studio: STUDIO_CONTROLS,
  play: raised(DRESS_MIN_HEIGHT, DRESS_MIN_HEIGHT, PLAY_PILL_HEIGHT),
  hud: raised(DRESS_MIN_HEIGHT, HUD_PANEL_BUTTON_HEIGHT, DRESS_MIN_HEIGHT),
  arcade: raised(DRESS_MIN_HEIGHT, DRESS_MIN_HEIGHT, DRESS_MIN_HEIGHT),
  candy: raised(DRESS_MIN_HEIGHT, DRESS_MIN_HEIGHT, DRESS_MIN_HEIGHT),
}) satisfies Readonly<Record<BuiltInStyleId, ControlSizes>>;
