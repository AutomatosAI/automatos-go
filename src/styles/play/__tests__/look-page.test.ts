// Play's look page rules (US-017e; editor.ts and play-look-state.ts at the pin as references):
// every knob's options and names in the vendored catalogue's order, the glow's cap for every
// ground and accent, the naming of saved looks and copies, preset protection, deleting the active
// look (→ Ember), reset to the look it was picked from, the looks row, the sync line and the
// preview's chips. Never a mutation.

import { describe, expect, it } from 'vitest';

import {
  ACCENTS,
  ACCENT_KEYS,
  GROUNDS,
  GROUND_KEYS,
  LIGHTS,
  TYPE_STYLE_KEYS,
} from '../../../core/web/lib/looks/catalogue';
import { safeGlow } from '../../../core/web/lib/looks/engine';
import { AURORA, DAYLIGHT, EMBER, OBSIDIAN, PRESETS } from '../../../core/web/lib/looks/presets';
import { GLOW_MAX, type Look } from '../../../core/web/lib/looks/types';
import { FLIP_CROSSFADE_MS } from '../../provider/flip-plan';
import { LOOK_SYNC_COPY } from '../../strings';
import {
  canReset,
  clampGlow,
  copyName,
  deleteLook,
  duplicateLook,
  glowKnob,
  glowLabel,
  glowWords,
  isEdited,
  looksRow,
  newLookName,
  pickCrossfadeMs,
  pickLook,
  refusalCopy,
  renameLook,
  resetLook,
  saveAsNew,
  setValues,
  statusLine,
  syncLine,
  type PlayLooksChange,
} from '../look-page';
import { LOOK_PAGE, lookKnobs, optionFace, optionFrame, rowSwatch, sampleFace } from '../look-page/knobs';
import { SWATCH_EDGE, lightGlow } from '../../tokens/look-page-colours';
import { PREVIEW_CHIPS, PREVIEW_STATE } from '../look-page/preview';
import { MAX_SAVED_LOOKS } from '../looks-schemas';
import { INITIAL_PLAY_LOOKS, checkPlayLook, type PlayLooks } from '../play-looks';

function mine(n: number, values: Partial<Look> = {}): Look {
  return Object.freeze({ ...OBSIDIAN, id: `look-${n}`, name: `My look ${n}`, sub: 'Your look', ...values });
}

function looksOf(change: PlayLooksChange): PlayLooks {
  if (!change.ok) throw new Error(`refused: ${change.reason}`);
  return change.looks;
}

function reasonOf(change: PlayLooksChange): string {
  if (change.ok) throw new Error('changed');
  return change.reason;
}

const names = <K extends string>(section: { options: readonly { name: string; key: K }[] }) =>
  section.options.map((option) => option.name);

describe('the knobs', () => {
  const knobs = lookKnobs(EMBER);

  it('names every option as the vendored catalogue does, in its order', () => {
    expect(names(knobs.ground)).toEqual(['Graphite', 'Obsidian', 'Night', 'Paper']);
    expect(names(knobs.accent)).toEqual(['Molten', 'Cream', 'Mint', 'Gold', 'Periwinkle', 'Rose']);
    expect(names(knobs.font)).toEqual(['Editorial', 'Clean', 'Characterful', 'Playful']);
    expect(names(knobs.shell)).toEqual(['Bronze', 'Gold', 'Silver', 'Cobalt']);
    expect(names(knobs.light)).toEqual(['Mint', 'Amber', 'Ice', 'Rose']);
  });

  it('heads each section as the design does, the accent with the one picked', () => {
    expect(knobs.accent.title).toBe('Accent · Molten');
    expect(knobs.ground.title).toBe('Background');
    expect(knobs.font.title).toBe('Type');
    expect(knobs.shell.title).toBe("Auto's shell");
    expect(knobs.light.title).toBe("Auto's light · eyes + ring");
    expect(knobs.glow.title).toBe('Glow');
    expect(lookKnobs({ ...EMBER, accent: 'periwinkle' }).accent.title).toBe('Accent · Periwinkle');
  });

  it('marks the look’s own option selected, in words for VoiceOver', () => {
    const molten = knobs.accent.options[0];
    expect(molten.selected).toBe(true);
    expect(molten.label).toBe('Molten accent, selected');
    expect(knobs.accent.options[1].label).toBe('Cream accent');
    expect(knobs.ground.options.find((o) => o.selected)?.label).toBe('Graphite background, selected');
    expect(knobs.font.options.find((o) => o.selected)?.label).toBe('Editorial type, selected');
    expect(knobs.shell.options.find((o) => o.selected)?.label).toBe('Bronze shell, selected');
    expect(knobs.light.options.find((o) => o.selected)?.label).toBe('Mint light, selected');
    for (const section of [knobs.accent, knobs.ground, knobs.font, knobs.shell, knobs.light]) {
      expect(section.options.filter((option) => option.selected)).toHaveLength(1);
    }
  });

  it('says what each option changes and what it shows', () => {
    expect(knobs.accent.options.map((o) => o.values)).toEqual(ACCENT_KEYS.map((accent) => ({ accent })));
    expect(knobs.ground.options.map((o) => o.values)).toEqual(GROUND_KEYS.map((ground) => ({ ground })));
    expect(knobs.font.options.map((o) => o.values)).toEqual(TYPE_STYLE_KEYS.map((font) => ({ font })));
    expect(knobs.accent.options[0].colour).toBe(ACCENTS.molten.hex);
    expect(knobs.ground.options[3].colour).toBe(GROUNDS.paper.bg);
    expect(knobs.font.options.map((o) => o.colour)).toEqual([null, null, null, null]);
    expect(knobs.font.options.map((o) => o.detail)).toEqual([
      'Instrument Serif',
      'Geist',
      'Bricolage Grotesque',
      'Fredoka',
    ]);
  });

  it('sets each Type option and the row sample in its own face, never below 11', () => {
    expect(optionFace('serif').fontFamily).toBe('InstrumentSerif-Italic');
    expect(optionFace('serif').fontSize).toBeGreaterThanOrEqual(19);
    for (const font of TYPE_STYLE_KEYS) {
      expect(optionFace(font).fontSize).toBeGreaterThanOrEqual(11);
      expect(sampleFace(font).fontSize).toBe(34);
      expect(sampleFace(font).fontFamily).toBe(optionFace(font).fontFamily);
    }
    expect(new Set(TYPE_STYLE_KEYS.map((font) => optionFace(font).fontFamily)).size).toBe(4);
  });

  it('frames the selected option in the accent at 2 pt, the rest in the line at 1', () => {
    const vars = { accent: ACCENTS.molten.hex, groundLine: GROUNDS.graphite.line };
    expect(optionFrame(true, vars)).toEqual({ borderWidth: 2, borderColor: ACCENTS.molten.hex });
    expect(optionFrame(false, vars)).toEqual({ borderWidth: 1, borderColor: vars.groundLine });
  });

  it("keeps the design's sizes: 136 wide looks, 40 pt swatches, 48 / 46 / 44 / 46 high", () => {
    expect(LOOK_PAGE.row).toMatchObject({ width: 136, radius: 12, nameSize: 13, subSize: 12 });
    expect(LOOK_PAGE.swatch).toMatchObject({ size: 40, border: 2 });
    expect(LOOK_PAGE.swatch.size + 2 * LOOK_PAGE.swatch.ring).toBeGreaterThanOrEqual(LOOK_PAGE.target);
    expect([LOOK_PAGE.ground.height, LOOK_PAGE.font.height, LOOK_PAGE.finish.height]).toEqual([48, 46, 44]);
    expect(LOOK_PAGE.actions.height).toBe(46);
  });

  it("draws the swatches' edge and the lights' glow from the tokens", () => {
    expect(SWATCH_EDGE).toMatch(/^rgba\(128,128,128,0\.4\)$/);
    expect(lightGlow(LIGHTS.mint.hex, 8)).toBe(`0 0 8px ${LIGHTS.mint.hex}`);
  });

  it('draws a look in the row from its ground, accent and light', () => {
    expect(rowSwatch(DAYLIGHT)).toEqual({
      ground: GROUNDS.paper.bg,
      text: GROUNDS.paper.text,
      accent: ACCENTS.molten.hex,
      light: LIGHTS.mint.hex,
    });
  });
});

describe('the glow', () => {
  it('stops at the vendored safeGlow for every ground and accent', () => {
    for (const ground of GROUND_KEYS) {
      for (const accent of ACCENT_KEYS) {
        const knob = glowKnob({ ...EMBER, ground, accent, glow: GLOW_MAX });
        expect(knob.cap).toBe(safeGlow(ground, accent));
        expect(knob.cap).toBeLessThanOrEqual(GLOW_MAX);
        expect(knob.value).toBe(knob.cap);
        expect(knob).toMatchObject({ min: 0, max: GLOW_MAX });
      }
    }
  });

  it('reads Off at 0, else N%, and in words for VoiceOver', () => {
    expect(glowLabel(0)).toBe('Off');
    expect(glowLabel(24)).toBe('24%');
    expect(glowKnob(EMBER).label).toBe('24%');
    expect(glowKnob({ ...EMBER, glow: 0 }).label).toBe('Off');
    expect(glowWords(0, 30)).toBe('Off');
    expect(glowWords(12, 30)).toBe('12 percent');
    expect(glowWords(30, 30)).toBe('30 percent, the most this look keeps readable');
  });

  it('clamps a reading to a whole glow within the cap', () => {
    expect(clampGlow(12.6, 30)).toBe(13);
    expect(clampGlow(-4)).toBe(0);
    expect(clampGlow(99)).toBe(GLOW_MAX);
    expect(clampGlow(35, 20)).toBe(20);
    expect(clampGlow(Number.NaN)).toBe(0);
  });

  it('keeps a slider value within the look’s cap', () => {
    const paper = { ...INITIAL_PLAY_LOOKS, active: { ...DAYLIGHT, accent: 'cream' as const } };
    const cap = safeGlow('paper', 'cream');
    expect(setValues(paper, { glow: GLOW_MAX }).active.glow).toBe(cap);
    expect(setValues(INITIAL_PLAY_LOOKS, { glow: 7.4 }).active.glow).toBe(7);
  });
});

describe('knobs and picks', () => {
  it('changes the active look only, and nothing when nothing changes', () => {
    const next = setValues(INITIAL_PLAY_LOOKS, { accent: 'mint', shell: 'cobalt' });
    expect(next.active).toMatchObject({ id: 'ember', accent: 'mint', shell: 'cobalt' });
    expect(next.saved).toBe(INITIAL_PLAY_LOOKS.saved);
    expect(INITIAL_PLAY_LOOKS.active).toBe(EMBER);
    expect(setValues(INITIAL_PLAY_LOOKS, { accent: 'molten' })).toBe(INITIAL_PLAY_LOOKS);
  });

  it("says 'Ember', then 'Ember · edited' once a knob moves", () => {
    expect(statusLine(INITIAL_PLAY_LOOKS)).toBe('Ember');
    const edited = setValues(INITIAL_PLAY_LOOKS, { font: 'round' });
    expect(isEdited(edited.active, edited.saved)).toBe(true);
    expect(statusLine(edited)).toBe('Ember · edited');
  });

  it('picks a preset or a saved look unedited; an unknown id changes nothing', () => {
    const saved = { saved: [mine(1)], active: EMBER };
    expect(pickLook(saved, 'aurora').active).toBe(AURORA);
    expect(pickLook(saved, 'look-1').active).toBe(saved.saved[0]);
    expect(pickLook(saved, 'nope')).toBe(saved);
    const edited = setValues(INITIAL_PLAY_LOOKS, { glow: 3 });
    expect(pickLook(edited, 'ember').active).toBe(EMBER);
  });

  it('crossfades a pick as a flip does, at once under Reduce Motion', () => {
    expect(pickCrossfadeMs(false)).toBe(FLIP_CROSSFADE_MS);
    expect(pickCrossfadeMs(true)).toBe(0);
  });

  it('lists the five presets with their subs, then the saved looks', () => {
    const row = looksRow({ saved: [mine(1)], active: mine(1) });
    expect(row.map((item) => [item.look.name, item.look.sub])).toEqual([
      ['Ember', 'Warm, editorial'],
      ['Obsidian', 'Mono, minimal'],
      ['Aurora', 'Cool and glassy'],
      ['Workshop', 'The original'],
      ['Daylight', 'For daytime'],
      ['My look 1', 'Your look'],
    ]);
    expect(row.map((item) => item.own)).toEqual([false, false, false, false, false, true]);
    expect(row.filter((item) => item.selected).map((item) => item.look.id)).toEqual(['look-1']);
    expect(row[5].label).toBe('My look 1, Your look, selected');
    expect(row[0].label).toBe('Ember, Warm, editorial');
  });
});

describe('Save as new look', () => {
  it("saves the active values as 'look-N', 'My look N', 'Your look' and makes it the active look", () => {
    const edited = setValues(INITIAL_PLAY_LOOKS, { accent: 'rose' });
    const next = looksOf(saveAsNew(edited));
    expect(next.active).toMatchObject({ id: 'look-1', name: 'My look 1', sub: 'Your look', accent: 'rose' });
    expect(next.saved).toEqual([next.active]);
    expect(statusLine(next)).toBe('My look 1');
    expect(checkPlayLook(next.active)).not.toBeNull();
    expect(edited.saved).toEqual([]);
  });

  it('takes the lowest free id and the next free name', () => {
    const looks = { saved: [mine(1), mine(3, { name: 'My look 3' })], active: EMBER };
    expect(looksOf(saveAsNew(looks)).active).toMatchObject({ id: 'look-2', name: 'My look 4' });
    expect(newLookName([])).toBe('My look 1');
    expect(newLookName([mine(1, { name: 'My look 2' })])).toBe('My look 3');
  });

  it('refuses past the cap', () => {
    const full = { saved: Array.from({ length: MAX_SAVED_LOOKS }, (_, i) => mine(i + 1)), active: EMBER };
    expect(reasonOf(saveAsNew(full))).toBe('full');
  });
});

describe('rename', () => {
  const looks = { saved: [mine(1), mine(2)], active: mine(1) };

  it('renames a saved look, trimmed, and the active look with it', () => {
    const next = looksOf(renameLook(looks, 'look-1', '  Night shift  '));
    expect(next.saved[0].name).toBe('Night shift');
    expect(next.active.name).toBe('Night shift');
    expect(next.saved[1]).toBe(looks.saved[1]);
    expect(looks.saved[0].name).toBe('My look 1');
    expect(looksOf(renameLook(looks, 'look-2', 'Two')).active).toBe(looks.active);
  });

  it('takes 1 to 40 characters on one line', () => {
    expect(looksOf(renameLook(looks, 'look-1', 'x'.repeat(40))).saved[0].name).toHaveLength(40);
    expect(reasonOf(renameLook(looks, 'look-1', 'x'.repeat(41)))).toBe('name');
    expect(reasonOf(renameLook(looks, 'look-1', '   '))).toBe('name');
    expect(reasonOf(renameLook(looks, 'look-1', 'two\nlines'))).toBe('name');
  });

  it('never renames a preset, and says why', () => {
    expect(reasonOf(renameLook(looks, 'ember', 'Mine now'))).toBe('preset');
    expect(refusalCopy('preset')).toBe("A preset can't be changed. Save it as a new look instead.");
    expect(reasonOf(renameLook(looks, 'look-9', 'Gone'))).toBe('not-saved');
    for (const reason of ['preset', 'not-saved', 'full', 'name'] as const) {
      expect(refusalCopy(reason).length).toBeGreaterThan(0);
    }
  });
});

describe('duplicate', () => {
  it("copies a saved look as '<name> copy' under a fresh id and makes it the active look", () => {
    const looks = { saved: [mine(1)], active: EMBER };
    const next = looksOf(duplicateLook(looks, 'look-1'));
    expect(next.active).toMatchObject({ id: 'look-2', name: 'My look 1 copy', accent: OBSIDIAN.accent });
    expect(next.saved).toHaveLength(2);
    const again = looksOf(duplicateLook(next, 'look-1'));
    expect(again.active.name).toBe('My look 1 copy 2');
  });

  it('copies the active look as it is now, edits included', () => {
    const edited = setValues({ saved: [mine(1)], active: mine(1) }, { light: 'rose' });
    expect(looksOf(duplicateLook(edited, 'look-1')).active.light).toBe('rose');
  });

  it('keeps a long name within 40 characters', () => {
    expect(copyName('x'.repeat(40), []).length).toBeLessThanOrEqual(40);
    expect(copyName('Ember', [])).toBe('Ember copy');
  });

  it('never duplicates a preset from the sheet', () => {
    expect(reasonOf(duplicateLook(INITIAL_PLAY_LOOKS, 'ember'))).toBe('preset');
  });
});

describe('delete', () => {
  it('deletes a saved look; deleting the active one puts Play back on Ember', () => {
    const looks = { saved: [mine(1), mine(2)], active: mine(2) };
    const other = looksOf(deleteLook(looks, 'look-1'));
    expect(other.saved.map((look) => look.id)).toEqual(['look-2']);
    expect(other.active).toBe(looks.active);
    const active = looksOf(deleteLook(looks, 'look-2'));
    expect(active.active).toBe(EMBER);
    expect(looks.saved).toHaveLength(2);
  });

  it('never deletes a preset', () => {
    for (const preset of PRESETS) {
      expect(reasonOf(deleteLook(INITIAL_PLAY_LOOKS, preset.id))).toBe('preset');
    }
  });
});

describe('reset', () => {
  it('goes back to the look it was picked from', () => {
    const preset = setValues({ saved: [], active: AURORA }, { accent: 'gold', glow: 2 });
    expect(resetLook(preset).active).toBe(AURORA);
    const saved = setValues({ saved: [mine(1)], active: mine(1) }, { ground: 'paper' });
    expect(resetLook(saved).active).toBe(saved.saved[0]);
    expect(statusLine(resetLook(saved))).toBe('My look 1');
    expect(resetLook(INITIAL_PLAY_LOOKS)).toBe(INITIAL_PLAY_LOOKS);
  });

  it('has nothing to go back to for a look neither preset nor saved', () => {
    const stray = { saved: [], active: mine(7) };
    expect(canReset(stray)).toBe(false);
    expect(resetLook(stray)).toBe(stray);
    expect(canReset(INITIAL_PLAY_LOOKS)).toBe(true);
  });
});

describe('the sync line', () => {
  const localOnly = LOOK_SYNC_COPY.localOnly;

  it("says 'Kept on this phone only' with the reason while Play is not installed", () => {
    expect(syncLine({ synced: 'local-only' }, LOOK_SYNC_COPY.playNotInstalled, localOnly)).toEqual({
      title: 'Kept on this phone only',
      reason: LOOK_SYNC_COPY.playNotInstalled,
    });
  });

  it("says a failure's words alone, and nothing while in step", () => {
    expect(syncLine({ synced: 'pending' }, 'No connection.', localOnly)).toEqual({
      title: null,
      reason: 'No connection.',
    });
    expect(syncLine({ synced: 'server' }, null, localOnly)).toBeNull();
  });
});

describe('the preview', () => {
  it("draws Auto celebrating and the design's two done chips", () => {
    expect(PREVIEW_STATE).toBe('celebrate');
    expect(PREVIEW_CHIPS.map((chip) => `${chip.mark} ${chip.text}`)).toEqual([
      '✓ Searched the web · 5 results',
      '✓ Made a report',
    ]);
    expect(PREVIEW_CHIPS.every((chip) => chip.kind === 'done')).toBe(true);
    expect(PREVIEW_CHIPS[1].label).toBe('Done: Made a report');
  });
});
