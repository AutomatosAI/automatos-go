import { describe, expect, it } from 'vitest';

import { routes } from '../../../navigation/routes';
import { STYLE_SCREENS, lookScreen } from '../../nav';
import { STYLE_REGISTRY } from '../../registry/registry';

describe('STYLE_SCREENS', () => {
  it('names the picker and the four look pages under Settings', () => {
    expect(STYLE_SCREENS).toEqual({
      settingsStyle: '/settings/style',
      lookPlay: '/settings/look/play',
      lookHud: '/settings/look/hud',
      lookArcade: '/settings/look/arcade',
      lookCandy: '/settings/look/candy',
    });
    expect(Object.isFrozen(STYLE_SCREENS)).toBe(true);
  });

  it("sits under the foundation's Settings route and repeats none of its paths", () => {
    const paths = Object.values(STYLE_SCREENS);
    expect(paths.every((path) => path.startsWith(`${routes.settings}/`))).toBe(true);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("links each style's look page: Play's, HUD's, Arcade's and Candy's, none for Studio", () => {
    expect(STYLE_REGISTRY.map((style) => [style.id, lookScreen(style.lookPage)])).toEqual([
      ['studio', null],
      ['play', '/settings/look/play'],
      ['hud', '/settings/look/hud'],
      ['arcade', '/settings/look/arcade'],
      ['candy', '/settings/look/candy'],
    ]);
  });
});
