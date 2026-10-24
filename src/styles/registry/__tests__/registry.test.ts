import { describe, expect, it } from 'vitest';

import { DEFAULT_CHOICE, STYLE_REGISTRY, styleEntry } from '../registry';
import { BUILT_IN_STYLE_IDS, builtinChoice, layoutOf, sameChoice, themeChoice } from '../style-id';

describe('the built-in styles (D54)', () => {
  it('lists Studio, Play and HUD in the picker order, each with its name and tagline', () => {
    expect(STYLE_REGISTRY.map(({ id, name, tagline }) => ({ id, name, tagline }))).toEqual([
      { id: 'studio', name: 'Studio', tagline: 'Cream paper or Studio Dark' },
      { id: 'play', name: 'Play', tagline: 'Auto and the Ember look' },
      { id: 'hud', name: 'HUD', tagline: 'Voice first, glow and grid' },
    ]);
    expect(STYLE_REGISTRY.map((style) => style.id)).toEqual([...BUILT_IN_STYLE_IDS]);
  });

  it('gives each style its own layout, look page and mascot rule', () => {
    expect(
      STYLE_REGISTRY.map(({ layout, lookPage, mascot }) => ({ layout, lookPage, mascot })),
    ).toEqual([
      { layout: 'studio', lookPage: 'scheme', mascot: 'never' },
      { layout: 'play', lookPage: 'play', mascot: 'always' },
      { layout: 'hud', lookPage: 'hud', mascot: 'look' },
    ]);
  });

  it('starts the phone on Studio (PRD-001 §4.6)', () => {
    expect(DEFAULT_CHOICE).toEqual({ kind: 'builtin', id: 'studio' });
    expect(Object.isFrozen(DEFAULT_CHOICE)).toBe(true);
  });

  it('is frozen, entries included', () => {
    expect(Object.isFrozen(STYLE_REGISTRY)).toBe(true);
    expect(STYLE_REGISTRY.every((style) => Object.isFrozen(style))).toBe(true);
  });

  it('finds a style by id', () => {
    expect(styleEntry('hud').name).toBe('HUD');
    expect(() => styleEntry('mist' as never)).toThrow('no style registered as mist');
  });
});

describe('a choice and its layout (D58)', () => {
  it('paints a built-in style with its own layout and a theme with Studio', () => {
    expect(layoutOf(builtinChoice('studio'))).toBe('studio');
    expect(layoutOf(builtinChoice('play'))).toBe('play');
    expect(layoutOf(builtinChoice('hud'))).toBe('hud');
    expect(layoutOf(themeChoice('a1b2'))).toBe('studio');
  });

  it('compares choices by kind and id', () => {
    expect(sameChoice(builtinChoice('play'), builtinChoice('play'))).toBe(true);
    expect(sameChoice(builtinChoice('play'), builtinChoice('hud'))).toBe(false);
    expect(sameChoice(themeChoice('a'), themeChoice('a'))).toBe(true);
    expect(sameChoice(themeChoice('a'), themeChoice('b'))).toBe(false);
    expect(sameChoice(builtinChoice('studio'), themeChoice('studio'))).toBe(false);
    expect(sameChoice(themeChoice('studio'), builtinChoice('studio'))).toBe(false);
  });
});
