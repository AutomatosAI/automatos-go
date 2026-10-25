// Each built-in style's corners under the foundation's radius names (types.ts RadiusName), plus
// the input field's, which Ember rounds past its buttons. Studio is the handoff's set unchanged
// (6 buttons and inputs); Play is Ember's (6 paper · 8 tool line · 10 button · 14 card · pill
// chips) with its 12 pt message field; HUD is square everywhere (its README: circles only for the
// core, gauges and the donut, which Skia draws).

import type { BuiltInStyleId } from '../registry/style-id';
import { STUDIO_RADII } from './studio';
import type { Radii } from './types';

export type StyleRadii = Radii & { readonly input: number };

/** Play alone draws paper: a Deliverable's printed sheet (Ember 02, 04, 05). */
export type PlayRadii = StyleRadii & { readonly paper: number };

/** A pill or a circle: any radius past half the side rounds it fully. */
const ROUND = 999;

const STUDIO: StyleRadii = Object.freeze({ ...STUDIO_RADII, input: STUDIO_RADII.control });

const PLAY: PlayRadii = Object.freeze({
  tag: ROUND,
  chip: 8,
  segment: 10,
  control: 10,
  input: 12,
  card: 14,
  panel: 14,
  pill: ROUND,
  sheet: 14,
  full: ROUND,
  paper: 6,
});

const HUD: StyleRadii = Object.freeze({
  tag: 0,
  chip: 0,
  segment: 0,
  control: 0,
  input: 0,
  card: 0,
  panel: 0,
  pill: 0,
  sheet: 0,
  full: 0,
});

export const STYLE_RADII = Object.freeze({
  studio: STUDIO,
  play: PLAY,
  hud: HUD,
}) satisfies Readonly<Record<BuiltInStyleId, StyleRadii>>;
