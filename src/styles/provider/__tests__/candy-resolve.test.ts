// resolveStyle paints Candy (PRD-001 §4.6.2, D-CAN-3, D-CAN-7, D-CAN-9): layout 'candy' in its
// look's palette whatever Studio's scheme says (Blush and Lilac light, Night bloom dark), the
// look's tokens, corners and variables, Candy's own type (Outfit and Nunito, US-023d), never the
// bundled Auto (D-CAN-5) and never a theme's painting; Blush while the input carries no Candy look;
// Candy's look painted only for Candy. resolve.test.ts holds the rest of resolveStyle.

import { describe, expect, it } from 'vitest';

import { EMBER, OBSIDIAN } from '../../../core/frozen/lib/looks/presets';
import { CANDY_DEFAULT_LOOK, CANDY_PRESET_LOOKS, type CandyLook } from '../../candy/look-schema';
import { HUD_DEFAULT_LOOK } from '../../hud/look-schema';
import { builtinChoice, themeChoice, type StyleChoice } from '../../registry/style-id';
import { THEME_CHOICES, type SystemScheme } from '../../theme-choice';
import { candyRadii, candyTokens, candyVars } from '../../tokens/candy';
import { playTokens } from '../../tokens/play';
import { candyStyleTokens } from '../../tokens/style-tokens';
import { styleType } from '../../typeface/scale';
import { resolveStyle, type StyleInput } from '../resolve';

const CANDY = builtinChoice('candy');
const INSTALL_ID = '3f2b6c1e-9d4a-4b7e-8c21-5a6f0e9d1b42';
const THEME = themeChoice(INSTALL_ID);
const LILAC = CANDY_PRESET_LOOKS[1] as CandyLook;
const NIGHT_BLOOM = CANDY_PRESET_LOOKS[2] as CandyLook;
const ROUND: CandyLook = Object.freeze({
  ...LILAC,
  id: 'mine-1',
  name: 'My look 1',
  roundness: '40',
});

const SYSTEM_SCHEMES: readonly SystemScheme[] = ['light', 'dark', null, undefined];
const SCHEME_GRID = THEME_CHOICES.flatMap((studioScheme) =>
  SYSTEM_SCHEMES.map((systemScheme) => [studioScheme, systemScheme] as const),
);

function input(choice: StyleChoice, overrides: Partial<StyleInput> = {}): StyleInput {
  return Object.freeze({
    choice,
    studioScheme: 'system',
    systemScheme: 'light',
    playLook: EMBER,
    hudLook: HUD_DEFAULT_LOOK,
    themePaint: null,
    reduceMotion: false,
    ...overrides,
  });
}

describe("Candy paints its look's palette, whatever the scheme says (D-CAN-7)", () => {
  it.each(SCHEME_GRID)(
    'Blush is light under Studio %s on a %s phone',
    (studioScheme, systemScheme) => {
      const style = resolveStyle(
        input(CANDY, { studioScheme, systemScheme, candyLook: CANDY_DEFAULT_LOOK }),
      );
      expect(style.choice).toBe(CANDY);
      expect(style.layout).toBe('candy');
      expect(style.tone).toBe('light');
      expect(style.tokens).toBe(candyStyleTokens(CANDY_DEFAULT_LOOK));
      expect(style.tokens.style).toBe('candy');
      expect(style.tokens.scheme).toBe('light');
    },
  );

  it.each(SCHEME_GRID)(
    'Night bloom is dark under Studio %s on a %s phone',
    (studioScheme, systemScheme) => {
      const style = resolveStyle(
        input(CANDY, { studioScheme, systemScheme, candyLook: NIGHT_BLOOM }),
      );
      expect(style.tone).toBe('dark');
      expect(style.tokens.colours).toEqual(candyTokens(NIGHT_BLOOM));
    },
  );

  it.each(CANDY_PRESET_LOOKS)(
    "$name carries its look, its palette's variables, its corners and never the bundled Auto",
    (look) => {
      const style = resolveStyle(input(CANDY, { candyLook: look, studioScheme: 'dark' }));
      expect(style.candyLook).toBe(look);
      expect(style.candy).toEqual(candyVars(look));
      expect(style.tokens.colours).toEqual(candyTokens(look));
      expect(style.radii).toEqual(candyRadii(look));
      expect(style.type).toBe(styleType({ layout: 'candy' }));
      expect(style.type).not.toBe(styleType({ layout: 'studio' }));
      expect(style.mascot).toBe('none');
      for (const other of ['play', 'hud', 'arcade', 'playLook', 'hudLook', 'arcadeLook']) {
        expect(style).not.toHaveProperty(other);
      }
    },
  );

  it("rounds its corners by the look's Roundness (rs = round(r × 0.72))", () => {
    const style = resolveStyle(input(CANDY, { candyLook: ROUND }));
    expect(style.radii.card).toBe(29);
    expect(resolveStyle(input(CANDY)).radii.card).toBe(20);
  });

  it('paints Blush while the input carries no Candy look', () => {
    const style = resolveStyle(input(CANDY));
    expect(style.candyLook).toBe(CANDY_DEFAULT_LOOK);
    expect(style.tokens).toBe(candyStyleTokens(CANDY_DEFAULT_LOOK));
    expect(style.motion).toEqual({ loops: true, reason: null });
  });

  it('hands back the same tokens, corners and variables for the same look object', () => {
    const first = resolveStyle(input(CANDY, { candyLook: LILAC }));
    const second = resolveStyle(input(CANDY, { candyLook: LILAC, studioScheme: 'dark' }));
    expect(second.tokens).toBe(first.tokens);
    expect(second.radii).toBe(first.radii);
    expect(second.candy).toBe(first.candy);
  });

  it("never paints a theme over Candy, and paints Candy's look only for Candy", () => {
    const colours = playTokens(OBSIDIAN);
    const themePaint = {
      installId: INSTALL_ID,
      colours: { light: colours, dark: colours },
      tone: null,
      mascot: true,
    };
    const style = resolveStyle(input(CANDY, { themePaint }));
    expect(style.tokens).toBe(candyStyleTokens(CANDY_DEFAULT_LOOK));
    expect(style.mascot).toBe('none');
    for (const choice of ['studio', 'play', 'hud', 'arcade'] as const) {
      const other = resolveStyle(input(builtinChoice(choice), { candyLook: LILAC }));
      expect(other).not.toHaveProperty('candy');
      expect(other).not.toHaveProperty('candyLook');
    }
    expect(resolveStyle(input(THEME, { candyLook: LILAC }))).not.toHaveProperty('candyLook');
  });
});
