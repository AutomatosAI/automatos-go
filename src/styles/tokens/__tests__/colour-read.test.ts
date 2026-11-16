// Reading a colour as React Native draws it (src/styles/tokens/colour-read.ts): every form a style
// or a theme may write blends correctly, held to the edge where a channel or an alpha runs past it,
// and every other string is null, never a throw and never a malformed hex.

import { describe, expect, it } from 'vitest';

import { blendOver, readColour } from '../colour-read';

const WHITE = '#FFFFFF';
const INK = '#1A1714';

describe('readColour', () => {
  it('reads every hex form, short and long, with and without an alpha', () => {
    expect(readColour('#1a1714')).toEqual({ hex: INK, alpha: 1 });
    expect(readColour('#fff')).toEqual({ hex: WHITE, alpha: 1 });
    expect(readColour('#fff0')).toEqual({ hex: WHITE, alpha: 0 });
    expect(readColour('#1A171480')).toEqual({ hex: INK, alpha: 0x80 / 255 });
  });

  it('reads rgb(), rgba(), hsl() and hsla(), spaces or none', () => {
    expect(readColour('rgb(26,23,20)')).toEqual({ hex: INK, alpha: 1 });
    expect(readColour('rgba( 26 , 23 , 20 , .5 )')).toEqual({ hex: INK, alpha: 0.5 });
    expect(readColour('hsl(0, 0%, 100%)')).toEqual({ hex: WHITE, alpha: 1 });
    expect(readColour('hsla(0,0%,100%,0.25)')).toEqual({ hex: WHITE, alpha: 0.25 });
    expect(readColour('transparent')?.alpha).toBe(0);
  });

  it('holds a channel past 255 and an alpha past 1 to the edge, as React Native does', () => {
    expect(readColour('rgba(300,23,20,7)')).toEqual({ hex: '#FF1714', alpha: 1 });
    expect(readColour('hsl(0,0%,250%)')).toEqual({ hex: WHITE, alpha: 1 });
  });

  it('is null for a name, another syntax and nonsense, never a throw', () => {
    for (const odd of [
      'red',
      '',
      'nonsense',
      '#12',
      '#ggg',
      'rgb(1,2)',
      'rgb(1.2.3,4,5)',
      'hwb(0 0% 0%)',
    ]) {
      expect(readColour(odd), odd).toBeNull();
    }
    expect(readColour(undefined as unknown as string)).toBeNull();
  });
});

describe('blendOver', () => {
  it('is a solid colour itself, and a see-through one over its ground', () => {
    expect(blendOver('rgb(26,23,20)', 'nonsense')).toBe(INK);
    expect(blendOver('rgba(26,23,20,0)', WHITE)).toBe(WHITE);
    expect(blendOver('transparent', INK)).toBe(INK);
    expect(blendOver('#1A171480', WHITE)).toBe('#8C8B89');
  });

  it('is null where the colour, or the ground it lets through, cannot be read or is not solid', () => {
    expect(blendOver('red', WHITE)).toBeNull();
    expect(blendOver('rgba(26,23,20,.5)', 'red')).toBeNull();
    expect(blendOver('rgba(26,23,20,.5)', '#FFFFFF80')).toBeNull();
  });
});
