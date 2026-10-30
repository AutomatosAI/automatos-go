// Candy's look rules (the design kit's spec.ts as the reference): a choice knob changed only to one
// of its choices, Glow clamped and rounded through the schema (clampKnob), the Roundness slider's
// position as its key (sliderKey), the naming of saved looks ('mine-N', 'My look N', 'From
// <name>'), the 100-look cap, preset protection, rename, delete (the active one → Blush), Reset to
// the palette's preset and the rules the look sync takes. Never a mutation.

import { describe, expect, it } from 'vitest';

import { LOOK_ID_PATTERN } from '../../../core/web/lib/look-kit/validate';
import {
  CANDY_LOOK_RULES,
  CANDY_THEME_ID,
  INITIAL_CANDY_LOOKS,
  MAX_CANDY_SAVED_LOOKS,
  clampKnob,
  deleteLook,
  freshCandyLookId,
  isPresetId,
  pickLook,
  renameLook,
  resetLook,
  saveAsNew,
  setKnob,
  setNumber,
  sliderKey,
  withValue,
  type CandyLooks,
  type CandyLooksChange,
} from '../candy-looks';
import {
  CANDY_DEFAULT_LOOK,
  CANDY_PRESET_LOOKS,
  isCandyLook,
  type CandyLook,
} from '../look-schema';

const BLUSH = CANDY_DEFAULT_LOOK;
const LILAC = CANDY_PRESET_LOOKS[1] as CandyLook;
const NIGHT_BLOOM = CANDY_PRESET_LOOKS[2] as CandyLook;

function looksOf(change: CandyLooksChange): CandyLooks {
  if (!change.ok) throw new Error(`refused: ${change.reason}`);
  return change.looks;
}

function savedLook(n: number, values: Partial<CandyLook> = {}): CandyLook {
  return { ...BLUSH, id: `mine-${n}`, name: `My look ${n}`, sub: 'From Blush', ...values };
}

/** Blush with the gradient moved, saved once: My look 1 active. */
function withOneSaved(): CandyLooks {
  return looksOf(saveAsNew(setKnob(INITIAL_CANDY_LOOKS, 'gradient', 'vivid')));
}

describe('withValue and setKnob (the choice knobs)', () => {
  it("takes a knob only to one of its choices, keeping the look's id (still the same look)", () => {
    expect(withValue(BLUSH, 'cards', 'single')).toEqual({ ...BLUSH, cards: 'single' });
    expect(withValue(BLUSH, 'palette', 'nightbloom').palette).toBe('nightbloom');
    expect(withValue(BLUSH, 'gradient', 'soft').gradient).toBe('soft');
    expect(withValue(BLUSH, 'roundness', '40').roundness).toBe('40');
    expect(withValue(BLUSH, 'motion', 'paused').motion).toBe('paused');
  });

  it('refuses a value the knob does not offer by returning the look itself', () => {
    expect(withValue(BLUSH, 'palette', 'mint')).toBe(BLUSH);
    expect(withValue(BLUSH, 'roundness', '12')).toBe(BLUSH);
    expect(withValue(BLUSH, 'roundness', '41')).toBe(BLUSH);
    expect(withValue(BLUSH, 'roundness', '28.5')).toBe(BLUSH);
    expect(withValue(BLUSH, 'motion', 'off')).toBe(BLUSH);
    expect(withValue(BLUSH, 'gradient', 'rich')).toBe(BLUSH);
  });

  it('never mutates and always leaves a valid Candy look', () => {
    const before = JSON.stringify(BLUSH);
    const next = withValue(withValue(BLUSH, 'palette', 'lilac'), 'roundness', '16');
    expect(JSON.stringify(BLUSH)).toBe(before);
    expect(isCandyLook(next)).toBe(true);
  });

  it('changes the active look only, and nothing for a refused value', () => {
    const looks = setKnob(INITIAL_CANDY_LOOKS, 'palette', 'lilac');
    expect(looks.active.palette).toBe('lilac');
    expect(looks.saved).toBe(INITIAL_CANDY_LOOKS.saved);
    expect(setKnob(INITIAL_CANDY_LOOKS, 'palette', 'mint')).toBe(INITIAL_CANDY_LOOKS);
  });
});

describe('setNumber (Glow) and the Roundness slider', () => {
  it("clamps and rounds Glow to the schema's 0–10 (spec.ts clampKnob)", () => {
    expect(setNumber(INITIAL_CANDY_LOOKS, 'glow', 12).active.glow).toBe(10);
    expect(setNumber(INITIAL_CANDY_LOOKS, 'glow', -3).active.glow).toBe(0);
    expect(setNumber(INITIAL_CANDY_LOOKS, 'glow', 2.6).active.glow).toBe(3);
    expect(setNumber(INITIAL_CANDY_LOOKS, 'glow', 9).active.glow).toBe(9);
    expect(clampKnob('glow', Number.NaN)).toBe(6);
    expect(clampKnob('glow', Number.POSITIVE_INFINITY)).toBe(6);
  });

  it('changes nothing when the clamped value is the one painted', () => {
    expect(setNumber(INITIAL_CANDY_LOOKS, 'glow', 6.2)).toBe(INITIAL_CANDY_LOOKS);
    const bright = setNumber(INITIAL_CANDY_LOOKS, 'glow', 10);
    expect(setNumber(bright, 'glow', 44)).toBe(bright);
  });

  it('keeps every value it sets a valid Candy look, never a mutation', () => {
    const before = JSON.stringify(INITIAL_CANDY_LOOKS);
    for (const value of [-1, 0, 4.5, 10, 99]) {
      expect(isCandyLook(setNumber(INITIAL_CANDY_LOOKS, 'glow', value).active)).toBe(true);
    }
    expect(JSON.stringify(INITIAL_CANDY_LOOKS)).toBe(before);
  });

  it("writes the Roundness slider's position as its key, clamped 12 → '16' and 44 → '40' (spec.ts sliderKey)", () => {
    expect(sliderKey(12)).toBe('16');
    expect(sliderKey(44)).toBe('40');
    expect(sliderKey(27.6)).toBe('28');
    expect(sliderKey(Number.NaN)).toBe('28');
    expect(setKnob(INITIAL_CANDY_LOOKS, 'roundness', sliderKey(12)).active.roundness).toBe('16');
    expect(setKnob(INITIAL_CANDY_LOOKS, 'roundness', sliderKey(44)).active.roundness).toBe('40');
  });
});

describe('saveAsNew (Save look)', () => {
  it("saves the active values as 'mine-1' / 'My look 1' / 'From Blush', made active", () => {
    const looks = withOneSaved();
    expect(looks.saved).toEqual([savedLook(1, { gradient: 'vivid' })]);
    expect(looks.active).toBe(looks.saved[0]);
    expect(INITIAL_CANDY_LOOKS.saved).toEqual([]);
  });

  it('names its line after the look it came from', () => {
    const fromNight = looksOf(saveAsNew(pickLook(INITIAL_CANDY_LOOKS, 'nightbloom')));
    const named = { id: 'mine-1', name: 'My look 1', sub: 'From Night bloom' };
    expect(fromNight.active).toMatchObject(named);
    const fromMine = looksOf(saveAsNew(fromNight));
    expect(fromMine.active).toMatchObject({ id: 'mine-2', sub: 'From My look 1' });
  });

  it('leaves the line empty when the name it came from is too long for one', () => {
    const named = looksOf(renameLook(withOneSaved(), 'mine-1', 'x'.repeat(40)));
    const next = looksOf(saveAsNew(named)).active;
    expect(next.sub).toBe('');
    expect(isCandyLook(next)).toBe(true);
  });

  it("counts on from the saved looks (spec.ts freshNumber), skipping a 'mine-N' taken", () => {
    expect(looksOf(saveAsNew(withOneSaved())).active.id).toBe('mine-2');
    expect(freshCandyLookId([savedLook(2)])).toBe('mine-3');
    expect(freshCandyLookId([savedLook(5)])).toBe('mine-2');
    expect(freshCandyLookId([])).toBe('mine-1');
  });

  it('makes ids the vendored LOOK_ID_PATTERN accepts and looks validateLook accepts', () => {
    const looks = looksOf(saveAsNew(withOneSaved()));
    for (const look of looks.saved) {
      expect(LOOK_ID_PATTERN.test(look.id)).toBe(true);
      expect(isCandyLook(look)).toBe(true);
    }
  });

  it('saves no more than MAX_CANDY_SAVED_LOOKS (100)', () => {
    expect(MAX_CANDY_SAVED_LOOKS).toBe(100);
    const saved = Array.from({ length: MAX_CANDY_SAVED_LOOKS }, (_, i) => savedLook(i + 1));
    expect(saveAsNew({ saved, active: BLUSH })).toEqual({ ok: false, reason: 'full' });
  });
});

describe('rename and delete', () => {
  it('renames a saved look, trimmed, and the active look with it', () => {
    const looks = looksOf(renameLook(withOneSaved(), 'mine-1', '  Sugar rush  '));
    expect(looks.saved[0]?.name).toBe('Sugar rush');
    expect(looks.active.name).toBe('Sugar rush');
  });

  it('takes 1 to 40 characters of one line of plain text (the vendored rule)', () => {
    const looks = withOneSaved();
    for (const name of ['', '   ', 'x'.repeat(41), 'two\nlines']) {
      expect(renameLook(looks, 'mine-1', name)).toEqual({ ok: false, reason: 'name' });
    }
  });

  it('refuses a preset and a look the phone has not saved', () => {
    const looks = pickLook(withOneSaved(), 'lilac');
    for (const preset of CANDY_PRESET_LOOKS) {
      expect(renameLook(looks, preset.id, 'Mine')).toEqual({ ok: false, reason: 'preset' });
      expect(deleteLook(looks, preset.id)).toEqual({ ok: false, reason: 'preset' });
    }
    expect(renameLook(looks, 'mine-9', 'Mine')).toEqual({ ok: false, reason: 'not-saved' });
    expect(deleteLook(looks, 'mine-7')).toEqual({ ok: false, reason: 'not-saved' });
  });

  it('deletes a saved look; deleting the active look puts Candy back on Blush', () => {
    expect(looksOf(deleteLook(withOneSaved(), 'mine-1'))).toEqual({ saved: [], active: BLUSH });
    const two = looksOf(saveAsNew(withOneSaved()));
    const looks = looksOf(deleteLook(two, 'mine-1'));
    expect(looks.saved.map((look) => look.id)).toEqual(['mine-2']);
    expect(looks.active).toBe(two.active);
  });
});

describe('pick and reset', () => {
  it('picks a preset or a saved look as it was saved; an unknown id changes nothing', () => {
    const looks = withOneSaved();
    expect(pickLook(looks, 'lilac').active).toBe(LILAC);
    expect(pickLook(pickLook(looks, 'lilac'), 'mine-1').active).toBe(looks.saved[0]);
    expect(pickLook(looks, 'nope')).toBe(looks);
  });

  it("resets to the active palette's preset as it ships (spec.ts resetOf)", () => {
    const onNight = setKnob(INITIAL_CANDY_LOOKS, 'palette', 'nightbloom');
    const edited = setNumber(setKnob(onNight, 'roundness', '40'), 'glow', 1);
    expect(resetLook(edited).active).toBe(NIGHT_BLOOM);
    const mine = setKnob(withOneSaved(), 'palette', 'lilac');
    const reset = resetLook(mine);
    expect(reset.active).toBe(LILAC);
    expect(reset.saved).toBe(mine.saved);
  });

  it('is a no-op on an unedited preset', () => {
    expect(resetLook(INITIAL_CANDY_LOOKS)).toBe(INITIAL_CANDY_LOOKS);
  });
});

describe('the rules the look sync takes', () => {
  it("keeps Candy's looks under 'automatos/candy', Blush by default", () => {
    expect(CANDY_THEME_ID).toBe('automatos/candy');
    expect(CANDY_LOOK_RULES.themeId).toBe('automatos/candy');
    expect(CANDY_LOOK_RULES.defaultLook).toBe(BLUSH);
    expect(CANDY_LOOK_RULES.isPreset('nightbloom')).toBe(true);
    expect(isPresetId('mine-1')).toBe(false);
    expect(CANDY_LOOK_RULES.freshId([savedLook(1)])).toBe('mine-2');
  });

  it('checks a look with the vendored validateLook: a Candy look, never an Arcade or broken one', () => {
    expect(CANDY_LOOK_RULES.check(LILAC)).toEqual(LILAC);
    expect(CANDY_LOOK_RULES.check({ ...LILAC, interface: 'arcade' })).toBeNull();
    expect(CANDY_LOOK_RULES.check({ ...LILAC, roundness: '41' })).toBeNull();
    expect(CANDY_LOOK_RULES.check({ ...LILAC, glow: 6.5 })).toBeNull();
    expect(CANDY_LOOK_RULES.check('lilac')).toBeNull();
  });
});
