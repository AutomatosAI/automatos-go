import { describe, expect, it } from 'vitest';

import { rgba } from '../../../core/web/lib/look-kit/css';
import { safeGlowAlpha } from '../../../core/frozen/lib/looks/engine';
import { DAYLIGHT, EMBER, OBSIDIAN, PRESETS } from '../../../core/frozen/lib/looks/presets';
import type { Look } from '../../../core/frozen/lib/looks/types';
import { MASCOT_STATES, type MascotName } from '../../../core/frozen/lib/mascot/types';
import { PLAY_PAGE_GLOW, PLAY_GLOW_CROSSFADE_MS, playVars } from '../../tokens/play';
import { PLAY_GLOW_EASING, RESTING_STATE, playGlowPlan } from '../play-glow';
import { PLAY_SPOTS, SCREEN_KINDS, type ScreenKind } from '../spots';

function plan(kind: ScreenKind, state: MascotName = 'idle', look: Look = EMBER, loops = true) {
  return playGlowPlan({ look, vars: playVars(look), kind, state, loops });
}

function alphaOf(colour: string): number {
  const match = /,([\d.]+)\)$/.exec(colour);
  if (!match) throw new Error(`${colour} has no alpha`);
  return Number(match[1]);
}

// app/play-theme.css: data-glow → body::before (the glow) and body::after (the snag) opacity.
const LEVELS: Readonly<Record<MascotName, readonly [number, number]>> = {
  hello: [1, 0],
  idle: [0.45, 0],
  listening: [0.45, 0],
  celebrate: [1, 0],
  thinking: [0.7, 0],
  working: [0.7, 0],
  searching: [0.7, 0],
  reading: [0.7, 0],
  oops: [0, 1],
  sleeping: [0, 0],
  lost: [0.45, 0],
  loading: [0.45, 0],
};

describe('the level for Auto’s state', () => {
  it.each(MASCOT_STATES)('%s fades the glow and the snag layer as the web does', (state) => {
    const chat = plan('chat', state);
    expect([chat?.light.opacity, chat?.snag?.opacity]).toEqual(LEVELS[state]);
  });

  it('rests at idle when a screen names no state', () => {
    expect(RESTING_STATE).toBe('idle');
    expect(plan('page')?.light.opacity).toBe(PLAY_PAGE_GLOW.calm.accent);
  });
});

describe('the crossfade', () => {
  it('fades over 600 ms on --pl-ease-out, at once under Reduce Motion', () => {
    expect(plan('chat')?.fadeMs).toBe(PLAY_GLOW_CROSSFADE_MS);
    expect(PLAY_GLOW_CROSSFADE_MS).toBe(600);
    expect(plan('chat', 'idle', EMBER, false)?.fadeMs).toBe(0);
    expect(PLAY_GLOW_EASING).toEqual([0.2, 0.8, 0.2, 1]);
  });
});

describe('the light’s colour', () => {
  it('paints Ember at its brightest exactly as each phone is drawn, up to the safe glow', () => {
    const cap = safeGlowAlpha(EMBER.ground, EMBER.accent);
    for (const kind of SCREEN_KINDS) {
      const spot = PLAY_SPOTS[kind];
      if (spot?.light !== 'glow') continue;
      const lit = plan(kind, 'celebrate');
      expect(lit?.light.stops.centre, kind).toBe(rgba(playVars(EMBER).accent, Math.min(spot.alpha, cap)));
      expect(lit?.light.opacity, kind).toBe(1);
    }
  });

  it('holds First open, drawn at .26, to Ember’s safe glow of .25', () => {
    expect(plan('first-open')?.light.stops.centre).toBe(rgba(playVars(EMBER).accent, 0.25));
  });

  it('scales with the look’s glow: Obsidian’s 6 paints a quarter of Ember’s 24', () => {
    expect(plan('report', 'idle', OBSIDIAN)?.light.stops.centre).toBe(
      rgba(playVars(OBSIDIAN).accent, 0.06),
    );
    expect(plan('chat', 'idle', OBSIDIAN)?.light.stops.centre).toBe(
      rgba(playVars(OBSIDIAN).accent, 0.05),
    );
  });

  it('never paints past the vendored safe glow, whatever the look asks for', () => {
    for (const look of [...PRESETS, { ...EMBER, glow: 40 }, { ...DAYLIGHT, glow: 40 }]) {
      const cap = safeGlowAlpha(look.ground, look.accent);
      for (const kind of SCREEN_KINDS) {
        const lit = plan(kind, 'celebrate', look);
        if (!lit || PLAY_SPOTS[kind]?.light !== 'glow') continue;
        expect(alphaOf(lit.light.stops.centre), `${look.id} ${kind}`).toBeLessThanOrEqual(cap);
      }
    }
  });

  it('fades each light to its own colour at 0, not to black', () => {
    const lit = plan('chat');
    expect(lit?.light.stops.edge).toBe(rgba(playVars(EMBER).accent, 0));
    expect(lit?.snag?.stops.edge).toBe(rgba(playVars(EMBER).error, 0));
  });

  it('draws the snag layer as --pl-glow-snag', () => {
    for (const look of PRESETS) {
      expect(plan('chat', 'oops', look)?.snag?.stops.centre, look.id).toBe(playVars(look).glowSnag);
    }
  });
});

describe('the edge screens’ own lights', () => {
  it('Not running holds the ground’s dusk as drawn, whatever Auto is doing', () => {
    for (const state of ['sleeping', 'idle', 'oops'] as const) {
      const dusk = plan('not-running', state);
      expect(dusk?.light).toEqual({ stops: { centre: rgba(playVars(EMBER).autoDusk, 0.18), edge: rgba(playVars(EMBER).autoDusk, 0) }, opacity: 1 });
      expect(dusk?.snag).toBeNull();
    }
  });

  it('Something went wrong is the error coral, never past the ground’s snag alpha', () => {
    expect(plan('something-wrong', 'oops')?.light.stops.centre).toBe(
      rgba(playVars(EMBER).error, 0.15),
    );
    expect(plan('something-wrong', 'oops', DAYLIGHT)?.light.stops.centre).toBe(
      rgba(playVars(DAYLIGHT).error, 0.1),
    );
    expect(plan('something-wrong', 'oops')?.snag).toBeNull();
  });

  it('draws nothing where Ember’s phone draws no light', () => {
    expect(plan('conversations')).toBeNull();
    expect(plan('deliverable')).toBeNull();
  });
});
