// Arcade's Options page, its pure rules (US-022j; the design kit's spec.ts KNOBS, look-controls.tsx,
// look-editor.tsx and look-transfer.tsx at 034fa629c as references): the five knob rows in the
// schema's order with the kit's labels and choice words, one choice chosen per row, the save slots
// (the presets, then the person's looks), the line under the heading while the looks stay on the
// phone, what SAVE LOOK and RESET say, and the sheet's words. Never a mutation.

import { describe, expect, it } from 'vitest';

import {
  INITIAL_ARCADE_LOOKS,
  MAX_ARCADE_SAVED_LOOKS,
  saveAsNew,
  setKnob,
  type ArcadeLooks,
  type ArcadeLooksChange,
} from '../../arcade-looks';
import {
  ARCADE_DEFAULT_LOOK,
  ARCADE_KNOBS,
  ARCADE_LOOK_SCHEMA,
  ARCADE_PRESET_LOOKS,
  type ArcadeLook,
} from '../../look-schema';
import { syncLine } from '../../../play/look-page';
import { lookSyncNotice, type LookSyncStatus } from '../../../play/look-sync';
import { LOOK_SYNC_COPY } from '../../../strings';
import { NOT_INSTALLED_COPY } from '../../../sync/look-themes';
import { MIN_TEXT_SIZE } from '../../../type';
import { ARCADE_BODY_MIN } from '../../../typeface/arcade-type';
import {
  ARCADE_SHEET_COPY,
  NOT_KEPT,
  OPTIONS_PAGE,
  choiceWord,
  optionRows,
  optionsLead,
  resetSaid,
  saveSlots,
  savedSaid,
} from '../options';

const DUNGEON = ARCADE_PRESET_LOOKS[1] as ArcadeLook;

function looksOf(change: ArcadeLooksChange): ArcadeLooks {
  if (!change.ok) throw new Error(`refused: ${change.reason}`);
  return change.looks;
}

/** spec.ts KNOBS at the pin: each knob's label and its choices' words, in order. */
const KIT_KNOBS = [
  ['Palette', ['Overworld', 'Dungeon', 'Neon Cabinet', 'Night City', 'Handheld']],
  ['Scanlines', ['Off', 'Soft', 'Strong']],
  ['Pixel scale', ['2×', '3×']],
  ['Window', ['Classic double', 'Thin']],
  ['Text speed', ['Instant', 'Normal', 'Slow']],
];

describe("Options' knob rows", () => {
  it("are the schema's five knobs in its order, with the kit's labels and choice words", () => {
    const rows = optionRows(ARCADE_DEFAULT_LOOK);
    expect(rows.map((row) => row.knob)).toEqual([...ARCADE_KNOBS]);
    expect(rows.map((row) => [row.title, row.choices.map((c) => c.word)])).toEqual(KIT_KNOBS);
  });

  it("offer exactly the schema's choices for each knob", () => {
    for (const row of optionRows(ARCADE_DEFAULT_LOOK)) {
      const values = row.choices.map((choice) => choice.value);
      expect(values).toEqual([...ARCADE_LOOK_SCHEMA.knobs[row.knob].choices]);
    }
  });

  it("choose the look's own value in every row, and only it", () => {
    for (const look of ARCADE_PRESET_LOOKS) {
      for (const row of optionRows(look)) {
        const chosen = row.choices.filter((choice) => choice.selected).map((c) => c.value);
        expect(chosen).toEqual([look[row.knob]]);
      }
    }
  });

  it('follow a knob changed on the active look', () => {
    const looks = setKnob(INITIAL_ARCADE_LOOKS, 'textSpeed', 'slow');
    const speed = optionRows(looks.active).find((row) => row.knob === 'textSpeed');
    expect(speed?.choices.filter((c) => c.selected).map((c) => c.word)).toEqual(['Slow']);
  });

  it("say a sign's words to VoiceOver ('2 times'), every other choice its word", () => {
    const rows = optionRows(ARCADE_DEFAULT_LOOK);
    const scale = rows.find((row) => row.knob === 'pixelScale');
    expect(scale?.choices.map((c) => c.label)).toEqual(['2 times', '3 times']);
    const window = rows.find((row) => row.knob === 'windowStyle');
    expect(window?.choices.map((c) => c.label)).toEqual(['Classic double', 'Thin']);
  });

  it('word an unknown value as itself, never blank', () => {
    expect(choiceWord('palette', 'synthwave')).toBe('synthwave');
    expect(choiceWord('scanlines', 'heavy')).toBe('heavy');
  });

  it('are frozen', () => {
    const rows = optionRows(ARCADE_DEFAULT_LOOK);
    expect(Object.isFrozen(rows)).toBe(true);
    expect(rows.every((row) => Object.isFrozen(row) && Object.isFrozen(row.choices))).toBe(true);
  });
});

describe("Options' save slots", () => {
  it('are the five presets in order, then the saved looks', () => {
    const looks = looksOf(saveAsNew(INITIAL_ARCADE_LOOKS));
    const slots = saveSlots(looks);
    expect(slots.map((slot) => slot.look.id)).toEqual([
      'overworld',
      'dungeon',
      'neon',
      'nightcity',
      'handheld',
      'mine-1',
    ]);
    expect(slots.map((slot) => slot.own)).toEqual([false, false, false, false, false, true]);
  });

  it('select the active look only, and say it to VoiceOver', () => {
    const slots = saveSlots(INITIAL_ARCADE_LOOKS);
    expect(slots.filter((slot) => slot.selected).map((slot) => slot.look.id)).toEqual([
      'overworld',
    ]);
    expect(slots[0]?.label).toBe('Overworld, Night forest, grass-green accent, selected');
    expect(slots[1]?.label).toBe('Dungeon, Stone and purple, torch-orange accent');
  });

  it('leave an empty line out of what VoiceOver hears', () => {
    const looks = looksOf(saveAsNew(INITIAL_ARCADE_LOOKS));
    const own: ArcadeLook = { ...looks.active, sub: '' };
    const slots = saveSlots({ saved: [own], active: own });
    expect(slots[5]?.label).toBe('Save slot 1, selected');
  });

  it('keep a preset selected while its knobs are edited (the look is still that preset)', () => {
    const looks = setKnob(INITIAL_ARCADE_LOOKS, 'scanlines', 'off');
    expect(saveSlots(looks)[0]?.selected).toBe(true);
  });

  it('never offer a preset to rename or delete', () => {
    expect(saveSlots(INITIAL_ARCADE_LOOKS).every((slot) => !slot.own)).toBe(true);
  });
});

describe('what Options says', () => {
  it("says 'Saved per person, per workspace.' unless the looks stay on this phone", () => {
    expect(optionsLead({ synced: 'server' })).toBe('Saved per person, per workspace.');
    expect(optionsLead({ synced: 'pending' })).toBe('Saved per person, per workspace.');
    expect(optionsLead({ synced: 'local-only' })).toBeNull();
  });

  it("says the looks stay on this phone while the server says Arcade isn't installed", () => {
    const status = { synced: 'local-only', failure: null } as LookSyncStatus;
    const notice = lookSyncNotice(status, NOT_INSTALLED_COPY.arcade);
    expect(syncLine(status, notice, LOOK_SYNC_COPY.localOnly)).toEqual({
      title: 'Kept on this phone only',
      reason: "Arcade isn't installed in this workspace, so your looks stay on this phone.",
    });
    const synced = { synced: 'server', failure: null } as LookSyncStatus;
    const quiet = lookSyncNotice(synced, NOT_INSTALLED_COPY.arcade);
    expect(syncLine(synced, quiet, LOOK_SYNC_COPY.localOnly)).toBeNull();
  });

  it('says what SAVE LOOK saved, or why the phone saved no more', () => {
    expect(savedSaid(saveAsNew(INITIAL_ARCADE_LOOKS))).toEqual({
      kind: 'done',
      text: 'Saved Save slot 1.',
    });
    const full: ArcadeLooks = {
      saved: Array.from({ length: MAX_ARCADE_SAVED_LOOKS }, (_, index) => ({
        ...ARCADE_DEFAULT_LOOK,
        id: `mine-${index + 1}`,
        name: `Save slot ${index + 1}`,
      })),
      active: ARCADE_DEFAULT_LOOK,
    };
    const refused = savedSaid(saveAsNew(full));
    expect(refused.kind).toBe('failed');
    expect(refused.text).toMatch(/no room for another look/);
  });

  it("says RESET goes back to the active palette's preset", () => {
    const edited = setKnob({ ...INITIAL_ARCADE_LOOKS, active: DUNGEON }, 'windowStyle', 'thin');
    expect(resetSaid(edited)).toEqual({ kind: 'done', text: 'Back to Dungeon.' });
    expect(resetSaid(INITIAL_ARCADE_LOOKS).text).toBe('Back to Overworld.');
  });

  it('says a change the phone could not keep lasts until the app closes', () => {
    expect(NOT_KEPT.kind).toBe('failed');
    expect(NOT_KEPT.text).toMatch(/until Automatos Go closes/);
  });

  it("words the sheet's delete as Arcade's, back to Overworld", () => {
    expect(ARCADE_SHEET_COPY.backTo).toBe('Overworld');
    expect(ARCADE_SHEET_COPY.deleted('Save slot 2', null)).toBe('Deleted Save slot 2.');
    expect(ARCADE_SHEET_COPY.deleted('Save slot 2', 'Overworld')).toBe(
      'Deleted Save slot 2. Arcade is back to Overworld.',
    );
  });

  it('carries no pointer to making an account and nothing about plans', () => {
    const words = JSON.stringify([
      optionRows(ARCADE_DEFAULT_LOOK),
      saveSlots(INITIAL_ARCADE_LOOKS),
      optionsLead({ synced: 'server' }),
    ]);
    expect(words).not.toMatch(/sign up|create an account|no account|plan|credit|price/i);
  });
});

describe("Options' sizes", () => {
  it('set running text at Arcade’s body floor and nothing under 11 pt', () => {
    const sizes = [
      OPTIONS_PAGE.choice.size,
      OPTIONS_PAGE.slot.nameSize,
      OPTIONS_PAGE.slot.subSize,
      OPTIONS_PAGE.noticeSize,
    ];
    for (const size of sizes) {
      expect(size).toBeGreaterThanOrEqual(ARCADE_BODY_MIN);
      expect(size).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
    }
  });
});
