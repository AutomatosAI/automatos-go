// HUD's look rules (editor.ts and the HUD drawing's save as references): the status line, edited,
// clamping a knob, the naming of saved looks, preset protection, rename, delete (the active one
// → ARC) and reset to the look it was picked from. Never a mutation.

import { describe, expect, it } from 'vitest';

import { LOOK_ID_PATTERN } from '../../../core/web/lib/look-kit/validate';
import {
  INITIAL_HUD_LOOKS,
  MAX_HUD_SAVED_LOOKS,
  deleteLook,
  isEdited,
  pickLook,
  renameLook,
  resetLook,
  saveAsNew,
  setKnob,
  statusLine,
  withValue,
  type HudLooks,
  type HudLooksChange,
} from '../hud-looks';
import { HUD_DEFAULT_LOOK, HUD_PRESET_LOOKS, isHudLook, type HudLook } from '../look-schema';

const ARC = HUD_DEFAULT_LOOK;

function looksOf(change: HudLooksChange): HudLooks {
  if (!change.ok) throw new Error(`refused: ${change.reason}`);
  return change.looks;
}

function savedLook(n: number, values: Partial<HudLook> = {}): HudLook {
  return { ...ARC, id: `mine-${n}`, name: `MINE ${n}`, ...values };
}

/** ARC with the grid moved, saved once: MINE 1 active. */
function withOneSaved(): HudLooks {
  return looksOf(saveAsNew(setKnob(INITIAL_HUD_LOOKS, 'grid', 20)));
}

describe('the status line and edited', () => {
  it("reads 'ARC', then 'ARC · EDITED' once a knob moves", () => {
    expect(statusLine(ARC, [])).toBe('ARC');
    const edited = withValue(ARC, 'accent', 'gold');
    expect(isEdited(edited, [])).toBe(true);
    expect(statusLine(edited, [])).toBe('ARC · EDITED');
  });

  it('is no longer edited once the values match the preset again', () => {
    const back = withValue(withValue(ARC, 'glow', 30), 'glow', 22);
    expect(isEdited(back, [])).toBe(false);
  });

  it("reads a saved look's name, and its name · EDITED after a change", () => {
    const looks = withOneSaved();
    expect(statusLine(looks.active, looks.saved)).toBe('MINE 1');
    expect(statusLine(withValue(looks.active, 'scan', 'off'), looks.saved)).toBe('MINE 1 · EDITED');
  });
});

describe('withValue', () => {
  it('rounds number knobs to whole numbers and clamps them to their range', () => {
    expect(withValue(ARC, 'grid', 12.6).grid).toBe(13);
    expect(withValue(ARC, 'grid', 99).grid).toBe(30);
    expect(withValue(ARC, 'grid', -4).grid).toBe(0);
    expect(withValue(ARC, 'glow', 41).glow).toBe(40);
    expect(withValue(ARC, 'glow', 39.6).glow).toBe(40);
  });

  it('takes choice knobs only to one of their choices', () => {
    expect(withValue(ARC, 'ground', 'navy').ground).toBe('navy');
    expect(withValue(ARC, 'motion', 'off').motion).toBe('off');
    expect(withValue(ARC, 'ground', 'teal')).toBe(ARC);
    expect(withValue(ARC, 'scan', 'yes')).toBe(ARC);
    expect(withValue(ARC, 'font', 3)).toBe(ARC);
  });

  it('refuses a value of the wrong kind, and NaN or Infinity, by returning the look itself', () => {
    expect(withValue(ARC, 'grid', '20')).toBe(ARC);
    expect(withValue(ARC, 'glow', Number.NaN)).toBe(ARC);
    expect(withValue(ARC, 'glow', Number.POSITIVE_INFINITY)).toBe(ARC);
    expect(withValue(ARC, 'glow', 22)).toBe(ARC);
  });

  it('never mutates and always leaves a valid HUD look', () => {
    const before = JSON.stringify(ARC);
    const next = withValue(withValue(ARC, 'grid', 100), 'accent', 'nova');
    expect(JSON.stringify(ARC)).toBe(before);
    expect(next).not.toBe(ARC);
    expect(isHudLook(next)).toBe(true);
  });
});

describe('saveAsNew', () => {
  it("saves the active values as 'mine-1' / 'MINE 1' and makes it the active look", () => {
    const looks = withOneSaved();
    expect(looks.saved).toEqual([savedLook(1, { grid: 20 })]);
    expect(looks.active).toBe(looks.saved[0]);
    expect(isEdited(looks.active, looks.saved)).toBe(false);
    expect(INITIAL_HUD_LOOKS.saved).toEqual([]);
  });

  it('takes the lowest free N, by id and by name', () => {
    const second = looksOf(saveAsNew(withOneSaved()));
    expect(second.active.id).toBe('mine-2');
    expect(looksOf(saveAsNew({ saved: [savedLook(2)], active: ARC })).active.id).toBe('mine-1');
    const renamedTwo = savedLook(1, { name: 'MINE 2' });
    const next = looksOf(saveAsNew({ saved: [renamedTwo], active: ARC })).active;
    expect([next.id, next.name]).toEqual(['mine-3', 'MINE 3']);
  });

  it('makes ids the vendored LOOK_ID_PATTERN accepts and looks validateLook accepts', () => {
    const looks = looksOf(saveAsNew(withOneSaved()));
    for (const look of looks.saved) {
      expect(LOOK_ID_PATTERN.test(look.id)).toBe(true);
      expect(isHudLook(look)).toBe(true);
    }
  });

  it('saves no more than MAX_HUD_SAVED_LOOKS', () => {
    const saved = Array.from({ length: MAX_HUD_SAVED_LOOKS }, (_, i) => savedLook(i + 1));
    expect(saveAsNew({ saved, active: ARC })).toEqual({ ok: false, reason: 'full' });
    expect(looksOf(saveAsNew({ saved: saved.slice(1), active: ARC })).active.id).toBe('mine-1');
  });
});

describe('rename', () => {
  it('renames a saved look, trimmed, and the active look with it', () => {
    const looks = looksOf(renameLook(withOneSaved(), 'mine-1', '  NIGHT SHIFT  '));
    expect(looks.saved[0]?.name).toBe('NIGHT SHIFT');
    expect(looks.active.name).toBe('NIGHT SHIFT');
    expect(statusLine(looks.active, looks.saved)).toBe('NIGHT SHIFT');
  });

  it('leaves the active look alone when another look is renamed', () => {
    const looks = pickLook(withOneSaved(), 'nova');
    const renamed = looksOf(renameLook(looks, 'mine-1', 'DESK'));
    expect(renamed.active).toBe(looks.active);
  });

  it('takes 1 to 40 characters of one line of plain text (the vendored rule)', () => {
    const looks = withOneSaved();
    expect(looksOf(renameLook(looks, 'mine-1', 'x'.repeat(40))).saved[0]?.name).toHaveLength(40);
    for (const name of ['', '   ', 'x'.repeat(41), 'two\nlines', 'hid​den']) {
      expect(renameLook(looks, 'mine-1', name)).toEqual({ ok: false, reason: 'name' });
    }
  });

  it('refuses a preset and a look the phone has not saved', () => {
    const looks = withOneSaved();
    for (const preset of HUD_PRESET_LOOKS) {
      expect(renameLook(looks, preset.id, 'MINE')).toEqual({ ok: false, reason: 'preset' });
    }
    expect(renameLook(looks, 'mine-9', 'MINE')).toEqual({ ok: false, reason: 'not-saved' });
  });
});

describe('delete', () => {
  it('deletes a saved look; deleting the active look puts HUD back on ARC', () => {
    const looks = deleteLook(withOneSaved(), 'mine-1');
    expect(looksOf(looks)).toEqual({ saved: [], active: ARC });
  });

  it('keeps the active look when another look is deleted', () => {
    const two = looksOf(saveAsNew(withOneSaved()));
    const looks = looksOf(deleteLook(two, 'mine-1'));
    expect(looks.saved.map((look) => look.id)).toEqual(['mine-2']);
    expect(looks.active).toBe(two.active);
  });

  it('refuses a preset, even the active one, and a look the phone has not saved', () => {
    const onNova = pickLook(withOneSaved(), 'nova');
    for (const preset of HUD_PRESET_LOOKS) {
      expect(deleteLook(onNova, preset.id)).toEqual({ ok: false, reason: 'preset' });
    }
    expect(deleteLook(onNova, 'mine-7')).toEqual({ ok: false, reason: 'not-saved' });
  });
});

describe('pick and reset', () => {
  it('picks a preset or a saved look unedited; an unknown id changes nothing', () => {
    const looks = withOneSaved();
    expect(pickLook(looks, 'signal').active).toBe(HUD_PRESET_LOOKS[4]);
    expect(pickLook(pickLook(looks, 'signal'), 'mine-1').active).toBe(looks.saved[0]);
    expect(pickLook(looks, 'nope')).toBe(looks);
  });

  it('resets an edited preset to the preset', () => {
    const edited = setKnob(pickLook(INITIAL_HUD_LOOKS, 'ghost'), 'accent', 'gold');
    expect(resetLook(edited).active).toBe(HUD_PRESET_LOOKS[2]);
  });

  it('resets an edited saved look to the look as it was saved', () => {
    const looks = withOneSaved();
    const edited = setKnob(setKnob(looks, 'glow', 5), 'font', 'mono');
    expect(statusLine(edited.active, edited.saved)).toBe('MINE 1 · EDITED');
    expect(resetLook(edited).active).toBe(looks.saved[0]);
  });

  it('resets to ARC when the look it was picked from is gone, and is a no-op when unedited', () => {
    const orphan: HudLooks = { saved: [], active: savedLook(4, { accent: 'gold' }) };
    expect(resetLook(orphan).active).toBe(ARC);
    expect(resetLook(INITIAL_HUD_LOOKS)).toBe(INITIAL_HUD_LOOKS);
  });

  it('setKnob changes nothing for a value the knob refuses', () => {
    expect(setKnob(INITIAL_HUD_LOOKS, 'accent', 'teal')).toBe(INITIAL_HUD_LOOKS);
  });
});
