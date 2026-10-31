// Make it sweet, its pure rules (US-023m; the kit's look-presets.tsx, look-transfer.tsx and
// look-preview.tsx at 3920359d5 as references): the three presets, then the saved looks, the one
// Candy paints checked (a preset stays checked while it is edited), what VoiceOver hears for each,
// what Save look and Reset say ('Saved as My look 2.', 'Back to Blush.') or why the phone saved no
// more, the sheet's words, the preview's sample cards, and the page's sizes (44 pt touches, nothing
// under Candy's 12). Never a mutation.

import { describe, expect, it } from 'vitest';

import { refusalCopy } from '../../../play/look-page';
import { PLAY_LOOK_COPY } from '../../../strings';
import { MIN_TOUCH } from '../../../../ui/paint';
import {
  INITIAL_CANDY_LOOKS,
  MAX_CANDY_SAVED_LOOKS,
  pickLook,
  saveAsNew,
  setKnob,
  type CandyLooks,
  type CandyLooksChange,
} from '../../candy-looks';
import { CANDY_DEFAULT_LOOK, CANDY_PRESET_LOOKS } from '../../look-schema';
import { CANDY_TODAY_COPY } from '../../strings';
import {
  CANDY_SHEET_COPY,
  CELEBRATE_MS,
  NOT_KEPT,
  PREVIEW_CARDS,
  SWEET_PAGE,
  presetItems,
  resetSaid,
  savedItems,
  savedSaid,
} from '../sweet';

function saved(looks: CandyLooks): CandyLooks {
  const change = saveAsNew(looks);
  if (!change.ok) throw new Error('the phone saved the look');
  return change.looks;
}

const checked = (items: readonly { selected: boolean; look: { id: string } }[]) =>
  items.filter((item) => item.selected).map((item) => item.look.id);

describe('the presets and the saved looks', () => {
  it('lists the three presets in the catalogue order, Blush checked on a new phone', () => {
    const items = presetItems(INITIAL_CANDY_LOOKS);
    expect(items.map((item) => item.look.id)).toEqual(['blush', 'lilac', 'nightbloom']);
    expect(items.map((item) => item.look)).toEqual(CANDY_PRESET_LOOKS);
    expect(checked(items)).toEqual(['blush']);
    expect(savedItems(INITIAL_CANDY_LOOKS)).toEqual([]);
  });

  it('names each for VoiceOver by its name and line', () => {
    expect(presetItems(INITIAL_CANDY_LOOKS).map((item) => item.label)).toEqual([
      'Blush, Pink on white, mixed cards',
      'Lilac, Violet into blue, airy',
      'Night bloom, Neon pinks after dark',
    ]);
  });

  it('keeps a preset checked while it is edited (the look keeps its id)', () => {
    const edited = setKnob(pickLook(INITIAL_CANDY_LOOKS, 'lilac'), 'gradient', 'soft');
    expect(checked(presetItems(edited))).toEqual(['lilac']);
  });

  it('lists the saved looks after the presets, the one on checked and no preset with it', () => {
    const one = saved(INITIAL_CANDY_LOOKS);
    const two = saved(pickLook(one, 'nightbloom'));
    expect(savedItems(two).map((item) => item.look.name)).toEqual(['My look 1', 'My look 2']);
    expect(savedItems(two).map((item) => item.label)).toEqual([
      'My look 1, From Blush',
      'My look 2, From Night bloom',
    ]);
    expect(checked(savedItems(two))).toEqual(['mine-2']);
    expect(checked(presetItems(two))).toEqual([]);
    expect(checked(savedItems(pickLook(two, 'mine-1')))).toEqual(['mine-1']);
  });

  it('builds frozen lists and changes no looks', () => {
    const looks = saved(INITIAL_CANDY_LOOKS);
    const before = JSON.stringify(looks);
    expect(Object.isFrozen(presetItems(looks))).toBe(true);
    expect(Object.isFrozen(savedItems(looks)[0])).toBe(true);
    expect(JSON.stringify(looks)).toBe(before);
  });
});

describe('what Save look and Reset say', () => {
  it("says 'Saved as My look N.' after Save look", () => {
    expect(savedSaid(saveAsNew(INITIAL_CANDY_LOOKS))).toEqual({
      kind: 'done',
      text: 'Saved as My look 1.',
    });
  });

  it('says why a full phone saved no more, as an alert', () => {
    const full: CandyLooksChange = { ok: false, reason: 'full' };
    expect(savedSaid(full)).toEqual({ kind: 'failed', text: refusalCopy('full') });
    const many = Array.from({ length: MAX_CANDY_SAVED_LOOKS }, (_, i) => ({
      ...CANDY_DEFAULT_LOOK,
      id: `mine-${i + 1}`,
    }));
    expect(savedSaid(saveAsNew({ saved: many, active: CANDY_DEFAULT_LOOK })).kind).toBe('failed');
  });

  it("says 'Back to <the palette's preset>.' after Reset", () => {
    const edited = setKnob(INITIAL_CANDY_LOOKS, 'palette', 'nightbloom');
    expect(resetSaid(edited)).toEqual({ kind: 'done', text: 'Back to Night bloom.' });
    expect(resetSaid(INITIAL_CANDY_LOOKS).text).toBe('Back to Blush.');
  });

  it("says a change the phone couldn't keep in Play's words", () => {
    expect(NOT_KEPT).toEqual({ kind: 'failed', text: PLAY_LOOK_COPY.notKept });
  });

  it("celebrates a save for the kit's 2.4 s", () => {
    expect(CELEBRATE_MS).toBe(2400);
  });
});

describe("the sheet's words", () => {
  it('says Candy is back to Blush when the look on was deleted', () => {
    expect(CANDY_SHEET_COPY.deleted('My look 1', CANDY_SHEET_COPY.backTo)).toBe(
      'Deleted My look 1. Candy is back to Blush.',
    );
    expect(CANDY_SHEET_COPY.deleted('My look 1', null)).toBe('Deleted My look 1.');
    expect(CANDY_SHEET_COPY.sheet).toBe(PLAY_LOOK_COPY.sheet);
    expect(CANDY_SHEET_COPY.refusal('preset')).toBe(refusalCopy('preset'));
  });
});

describe('the preview', () => {
  it("shows three of Today's cards, one per gradient, in Today's words", () => {
    expect(PREVIEW_CARDS.map((card) => card.set)).toEqual([1, 2, 3]);
    expect(PREVIEW_CARDS.map((card) => card.label)).toEqual([
      CANDY_TODAY_COPY.stats.working,
      CANDY_TODAY_COPY.stats.needs,
      CANDY_TODAY_COPY.stats.queue,
    ]);
  });

  it('draws Auto at 84, as the kit’s preview does', () => {
    expect(SWEET_PAGE.preview.auto).toBe(84);
  });
});

describe("the page's sizes", () => {
  it("draws the palette's swatches 38 across inside a 44 pt touch", () => {
    expect(SWEET_PAGE.swatch.size).toBe(38);
    expect(SWEET_PAGE.swatch.size + SWEET_PAGE.swatch.ring * 2).toBeLessThanOrEqual(MIN_TOUCH);
  });
});
