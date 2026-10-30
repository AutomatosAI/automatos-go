// Arcade's look rules (the design kit's spec.ts and look-editor.tsx as references): one knob
// changed only to one of its choices, the naming of saved looks ('mine-N', 'Save slot N', 'From
// <name>'), the 100-look cap, preset protection, rename, delete (the active one → Overworld), Reset
// to the palette's preset and the rules the look sync takes. Never a mutation.

import { describe, expect, it } from 'vitest';

import { LOOK_ID_PATTERN } from '../../../core/web/lib/look-kit/validate';
import {
  ARCADE_LOOK_RULES,
  ARCADE_THEME_ID,
  INITIAL_ARCADE_LOOKS,
  MAX_ARCADE_SAVED_LOOKS,
  deleteLook,
  freshArcadeLookId,
  isPresetId,
  pickLook,
  renameLook,
  resetLook,
  saveAsNew,
  setKnob,
  withValue,
  type ArcadeLooks,
  type ArcadeLooksChange,
} from '../arcade-looks';
import {
  ARCADE_DEFAULT_LOOK,
  ARCADE_PRESET_LOOKS,
  isArcadeLook,
  type ArcadeLook,
} from '../look-schema';

const OVERWORLD = ARCADE_DEFAULT_LOOK;
const NEON = ARCADE_PRESET_LOOKS[2] as ArcadeLook;

function looksOf(change: ArcadeLooksChange): ArcadeLooks {
  if (!change.ok) throw new Error(`refused: ${change.reason}`);
  return change.looks;
}

function savedLook(n: number, values: Partial<ArcadeLook> = {}): ArcadeLook {
  return { ...OVERWORLD, id: `mine-${n}`, name: `Save slot ${n}`, sub: 'From Overworld', ...values };
}

/** Overworld with the scanlines moved, saved once: Save slot 1 active. */
function withOneSaved(): ArcadeLooks {
  return looksOf(saveAsNew(setKnob(INITIAL_ARCADE_LOOKS, 'scanlines', 'strong')));
}

describe('withValue and setKnob', () => {
  it("takes a knob only to one of its choices, keeping the look's id (still the same look)", () => {
    const thin = withValue(OVERWORLD, 'windowStyle', 'thin');
    expect(thin).toEqual({ ...OVERWORLD, windowStyle: 'thin' });
    expect(withValue(OVERWORLD, 'palette', 'handheld').palette).toBe('handheld');
    expect(withValue(OVERWORLD, 'textSpeed', 'instant').textSpeed).toBe('instant');
    expect(withValue(OVERWORLD, 'pixelScale', '2').pixelScale).toBe('2');
  });

  it('refuses a value the knob does not offer by returning the look itself', () => {
    expect(withValue(OVERWORLD, 'palette', 'forest')).toBe(OVERWORLD);
    expect(withValue(OVERWORLD, 'scanlines', 'medium')).toBe(OVERWORLD);
    expect(withValue(OVERWORLD, 'pixelScale', '4')).toBe(OVERWORLD);
    expect(withValue(OVERWORLD, 'scanlines', 'soft')).toBe(OVERWORLD);
  });

  it('never mutates and always leaves a valid Arcade look', () => {
    const before = JSON.stringify(OVERWORLD);
    const next = withValue(withValue(OVERWORLD, 'palette', 'neon'), 'textSpeed', 'slow');
    expect(JSON.stringify(OVERWORLD)).toBe(before);
    expect(isArcadeLook(next)).toBe(true);
  });

  it('changes the active look only, and nothing for a refused value', () => {
    const looks = setKnob(INITIAL_ARCADE_LOOKS, 'palette', 'dungeon');
    expect(looks.active.palette).toBe('dungeon');
    expect(looks.saved).toBe(INITIAL_ARCADE_LOOKS.saved);
    expect(setKnob(INITIAL_ARCADE_LOOKS, 'palette', 'teal')).toBe(INITIAL_ARCADE_LOOKS);
  });
});

describe('saveAsNew (Save look)', () => {
  it("saves the active values as 'mine-1' / 'Save slot 1' / 'From Overworld', made active", () => {
    const looks = withOneSaved();
    expect(looks.saved).toEqual([savedLook(1, { scanlines: 'strong' })]);
    expect(looks.active).toBe(looks.saved[0]);
    expect(INITIAL_ARCADE_LOOKS.saved).toEqual([]);
  });

  it('names its line after the look it came from', () => {
    const fromNeon = looksOf(saveAsNew(pickLook(INITIAL_ARCADE_LOOKS, 'neon')));
    const named = { id: 'mine-1', name: 'Save slot 1', sub: 'From Neon Cabinet' };
    expect(fromNeon.active).toMatchObject(named);
    const fromSlot = looksOf(saveAsNew(fromNeon));
    expect(fromSlot.active).toMatchObject({ id: 'mine-2', sub: 'From Save slot 1' });
  });

  it('leaves the line empty when the name it came from is too long for one', () => {
    const named = looksOf(renameLook(withOneSaved(), 'mine-1', 'x'.repeat(40)));
    const next = looksOf(saveAsNew(named)).active;
    expect(next.sub).toBe('');
    expect(isArcadeLook(next)).toBe(true);
  });

  it("counts on from the saved looks (spec.ts freshNumber), skipping a 'mine-N' taken", () => {
    expect(looksOf(saveAsNew(withOneSaved())).active.id).toBe('mine-2');
    expect(freshArcadeLookId([savedLook(2)])).toBe('mine-3');
    expect(freshArcadeLookId([savedLook(5)])).toBe('mine-2');
    expect(freshArcadeLookId([])).toBe('mine-1');
  });

  it('makes ids the vendored LOOK_ID_PATTERN accepts and looks validateLook accepts', () => {
    const looks = looksOf(saveAsNew(withOneSaved()));
    for (const look of looks.saved) {
      expect(LOOK_ID_PATTERN.test(look.id)).toBe(true);
      expect(isArcadeLook(look)).toBe(true);
    }
  });

  it('saves no more than MAX_ARCADE_SAVED_LOOKS (100)', () => {
    expect(MAX_ARCADE_SAVED_LOOKS).toBe(100);
    const saved = Array.from({ length: MAX_ARCADE_SAVED_LOOKS }, (_, i) => savedLook(i + 1));
    expect(saveAsNew({ saved, active: OVERWORLD })).toEqual({ ok: false, reason: 'full' });
  });
});

describe('rename', () => {
  it('renames a saved look, trimmed, and the active look with it', () => {
    const looks = looksOf(renameLook(withOneSaved(), 'mine-1', '  Night shift  '));
    expect(looks.saved[0]?.name).toBe('Night shift');
    expect(looks.active.name).toBe('Night shift');
  });

  it('leaves the active look alone when another look is renamed', () => {
    const looks = pickLook(withOneSaved(), 'neon');
    expect(looksOf(renameLook(looks, 'mine-1', 'Desk')).active).toBe(looks.active);
  });

  it('takes 1 to 40 characters of one line of plain text (the vendored rule)', () => {
    const looks = withOneSaved();
    for (const name of ['', '   ', 'x'.repeat(41), 'two\nlines']) {
      expect(renameLook(looks, 'mine-1', name)).toEqual({ ok: false, reason: 'name' });
    }
  });

  it('refuses a preset and a look the phone has not saved', () => {
    const looks = withOneSaved();
    for (const preset of ARCADE_PRESET_LOOKS) {
      expect(renameLook(looks, preset.id, 'Mine')).toEqual({ ok: false, reason: 'preset' });
    }
    expect(renameLook(looks, 'mine-9', 'Mine')).toEqual({ ok: false, reason: 'not-saved' });
  });
});

describe('delete', () => {
  it('deletes a saved look; deleting the active look puts Arcade back on Overworld', () => {
    expect(looksOf(deleteLook(withOneSaved(), 'mine-1'))).toEqual({ saved: [], active: OVERWORLD });
  });

  it('keeps the active look when another look is deleted', () => {
    const two = looksOf(saveAsNew(withOneSaved()));
    const looks = looksOf(deleteLook(two, 'mine-1'));
    expect(looks.saved.map((look) => look.id)).toEqual(['mine-2']);
    expect(looks.active).toBe(two.active);
  });

  it('refuses a preset, even the active one, and a look the phone has not saved', () => {
    const onNeon = pickLook(withOneSaved(), 'neon');
    for (const preset of ARCADE_PRESET_LOOKS) {
      expect(deleteLook(onNeon, preset.id)).toEqual({ ok: false, reason: 'preset' });
    }
    expect(deleteLook(onNeon, 'mine-7')).toEqual({ ok: false, reason: 'not-saved' });
  });
});

describe('pick and reset', () => {
  it('picks a preset or a saved look as it was saved; an unknown id changes nothing', () => {
    const looks = withOneSaved();
    expect(pickLook(looks, 'neon').active).toBe(NEON);
    expect(pickLook(pickLook(looks, 'neon'), 'mine-1').active).toBe(looks.saved[0]);
    expect(pickLook(looks, 'nope')).toBe(looks);
  });

  it("resets to the active palette's preset as it ships (spec.ts resetOf)", () => {
    const edited = setKnob(setKnob(INITIAL_ARCADE_LOOKS, 'palette', 'neon'), 'textSpeed', 'slow');
    expect(resetLook(edited).active).toBe(NEON);
    const slot = setKnob(withOneSaved(), 'palette', 'handheld');
    const reset = resetLook(slot);
    expect(reset.active).toBe(ARCADE_PRESET_LOOKS[4]);
    expect(reset.saved).toBe(slot.saved);
  });

  it('is a no-op on an unedited preset', () => {
    expect(resetLook(INITIAL_ARCADE_LOOKS)).toBe(INITIAL_ARCADE_LOOKS);
  });
});

describe('the rules the look sync takes', () => {
  it("keeps Arcade's looks under 'automatos/arcade', Overworld by default", () => {
    expect(ARCADE_THEME_ID).toBe('automatos/arcade');
    expect(ARCADE_LOOK_RULES.themeId).toBe('automatos/arcade');
    expect(ARCADE_LOOK_RULES.defaultLook).toBe(OVERWORLD);
    expect(ARCADE_LOOK_RULES.isPreset('handheld')).toBe(true);
    expect(isPresetId('mine-1')).toBe(false);
    expect(ARCADE_LOOK_RULES.freshId([savedLook(1)])).toBe('mine-2');
  });

  it('checks a look with the vendored validateLook: an Arcade look, never a HUD or broken one', () => {
    expect(ARCADE_LOOK_RULES.check(NEON)).toEqual(NEON);
    expect(ARCADE_LOOK_RULES.check({ ...NEON, interface: 'command' })).toBeNull();
    expect(ARCADE_LOOK_RULES.check({ ...NEON, palette: 'forest' })).toBeNull();
    expect(ARCADE_LOOK_RULES.check('neon')).toBeNull();
  });
});
