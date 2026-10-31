// kinds.ts (US-023h): a Deliverable's square wears its kind's card gradient, over the kit's
// KIND_SETS with the app's type names spelt the kit's way, for the Chat view's rows and the
// Shelf's tiles.

import { describe, expect, it } from 'vitest';

import { KNOWN_TYPES } from '../../../cc/deliverables/types';
import { KIND_SETS } from '../../tokens/candy-catalogue';
import { KIT_KIND_NAMES, deliverableSetOf } from '../kinds';
import { kindSetOf } from '../sets';

describe('deliverableSetOf', () => {
  it('puts report and slide in the first set, document and spreadsheet the second, image and blog post the third', () => {
    expect(['report', 'slide'].map(deliverableSetOf)).toEqual([1, 1]);
    expect(['document', 'spreadsheet'].map(deliverableSetOf)).toEqual([2, 2]);
    expect(['image', 'blog_post'].map(deliverableSetOf)).toEqual([3, 3]);
  });

  it("maps the app's 'slide' and 'blog_post' onto the kit's 'slides' and 'blog'", () => {
    expect(KIT_KIND_NAMES.get('slide')).toBe('slides');
    expect(KIT_KIND_NAMES.get('blog_post')).toBe('blog');
    expect(deliverableSetOf('slide')).toBe(KIND_SETS.slides);
    expect(deliverableSetOf('blog_post')).toBe(KIND_SETS.blog);
  });

  it('takes the kit’s own names as they are, as kindSetOf does', () => {
    Object.keys(KIND_SETS).forEach((kind) =>
      expect(deliverableSetOf(kind), kind).toBe(kindSetOf(kind)),
    );
  });

  it('gives a kind the kit has no set for, and none at all, the first set', () => {
    expect(['code', 'video', 'audio', 'archive', 'slide_deck'].map(deliverableSetOf)).toEqual([
      1, 1, 1, 1, 1,
    ]);
    expect([null, undefined, '', '  '].map(deliverableSetOf)).toEqual([1, 1, 1, 1]);
  });

  it('reads a type in any case, with spaces around it', () => {
    expect(deliverableSetOf(' Spreadsheet ')).toBe(2);
    expect(deliverableSetOf('BLOG_POST')).toBe(3);
  });

  it("covers every type the app's Deliverables know, and a chat's three kinds", () => {
    KNOWN_TYPES.forEach((type) => expect([1, 2, 3], type).toContain(deliverableSetOf(type)));
    expect(['document', 'image', 'video'].map(deliverableSetOf)).toEqual([2, 3, 1]);
  });
});
