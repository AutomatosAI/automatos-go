// Which card gradient a thing wears in Candy (sets.ts, the kit's src/ui/sets.ts at 3920359d5):
// screen order cycles 1, 2, 3, a Deliverable takes its kind's (the app's 'slide' and 'blog_post'
// too), and an avatar shows a name's first letter.

import { describe, expect, it } from 'vitest';

import { cardSetOf, initialOf, kindSetOf } from '../sets';

describe('cardSetOf', () => {
  it('cycles through the three gradients in screen order', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(cardSetOf)).toEqual([1, 2, 3, 1, 2, 3, 1]);
  });

  it('keeps a negative index in the cycle', () => {
    expect([-1, -2, -3].map(cardSetOf)).toEqual([3, 2, 1]);
  });
});

describe('kindSetOf', () => {
  it('gives report and slides the first, document and spreadsheet the second, image and blog the third', () => {
    expect(['report', 'slides', 'slide'].map(kindSetOf)).toEqual([1, 1, 1]);
    expect(['document', 'spreadsheet'].map(kindSetOf)).toEqual([2, 2]);
    expect(['image', 'blog', 'blog_post'].map(kindSetOf)).toEqual([3, 3, 3]);
  });

  it('reads a kind in any case, and gives any other kind the first', () => {
    expect(kindSetOf('Spreadsheet')).toBe(2);
    expect(kindSetOf('video')).toBe(1);
    expect(kindSetOf('toString')).toBe(1);
    expect(kindSetOf(null)).toBe(1);
    expect(kindSetOf(undefined)).toBe(1);
  });
});

describe('initialOf', () => {
  it("upper-cases a name's first letter or digit", () => {
    expect(initialOf('researcher')).toBe('R');
    expect(initialOf('  émile')).toBe('É');
    expect(initialOf('42 things')).toBe('4');
    expect(initialOf('— writer')).toBe('W');
  });

  it("is '?' for a name with none", () => {
    expect(initialOf('')).toBe('?');
    expect(initialOf('  ')).toBe('?');
    expect(initialOf(null)).toBe('?');
    expect(initialOf('!!')).toBe('?');
  });
});
