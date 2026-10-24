// HUD's Looks drawer model ('Automatos Command HUD.dc.html'): the sections in looks.json's order
// with the option selected, the looks row (presets, then the saved looks), the status line, the
// glow stopping at the vendored safeGlow (KS9), the switches' words, Reduce Motion holding MOTION
// off, RESET only when it changes something, and every change a new value (never a mutation).

import { describe, expect, it } from 'vitest';

import {
  HUD_ACCENTS,
  HUD_ACCENT_KEYS,
  HUD_FONT_KEYS,
  HUD_GROUNDS,
  HUD_GROUND_KEYS,
} from '../../tokens/hud-catalogue';
import { hudVars } from '../../tokens/hud';
import {
  HUD_SWITCH_KNOBS,
  drawerFace,
  drawerFrame,
  drawerLooks,
  flipSwitch,
  glowCap,
  hudDrawer,
  pickOption,
  slide,
  type DrawerSection,
} from '../drawer-model';
import {
  INITIAL_HUD_LOOKS,
  pickLook,
  resetLook,
  saveAsNew,
  setKnob,
  type HudLooks,
  type HudLooksChange,
} from '../hud-looks';
import { HUD_PRESET_LOOKS } from '../look-schema';

function looksOf(change: HudLooksChange): HudLooks {
  if (!change.ok) throw new Error(`refused: ${change.reason}`);
  return change.looks;
}

function selectedKeys<K extends string>(section: DrawerSection<K>): readonly K[] {
  return section.options.filter((option) => option.selected).map((option) => option.key);
}

const NOVA = pickLook(INITIAL_HUD_LOOKS, 'nova');

describe('the sections', () => {
  it('lists every option in looks.json order with the active look’s one selected', () => {
    const drawer = hudDrawer(INITIAL_HUD_LOOKS, false);
    expect(drawer.accent.options.map((o) => o.key)).toEqual(HUD_ACCENT_KEYS);
    expect(drawer.ground.options.map((o) => o.key)).toEqual(HUD_GROUND_KEYS);
    expect(drawer.font.options.map((o) => o.key)).toEqual(HUD_FONT_KEYS);
    expect(selectedKeys(drawer.accent)).toEqual(['arc']);
    expect(selectedKeys(drawer.ground)).toEqual(['void']);
    expect(selectedKeys(drawer.font)).toEqual(['raj']);
  });

  it('writes the headings and names as the drawing does', () => {
    const drawer = hudDrawer(INITIAL_HUD_LOOKS, false);
    expect(drawer.accent.title).toBe('ACCENT · ARC');
    expect(drawer.ground.title).toBe('BACKGROUND');
    expect(drawer.font.title).toBe('TYPE');
    expect(drawer.ground.options.map((o) => o.text)).toEqual(['VOID', 'CARBON', 'NAVY', 'EMBER']);
    expect(drawer.font.options.map((o) => o.text)).toEqual(['RAJDHANI', 'CHAKRA', 'MONO']);
  });

  it('paints each option from the catalogue and says it to VoiceOver', () => {
    const drawer = hudDrawer(INITIAL_HUD_LOOKS, false);
    const [arc, forge] = drawer.accent.options;
    expect(arc?.colour).toBe(HUD_ACCENTS.arc.hex);
    expect(arc?.label).toBe('Arc accent, selected');
    expect(forge?.label).toBe('Forge accent');
    expect(drawer.ground.options[2]?.colour).toBe(HUD_GROUNDS.navy.bg);
    expect(drawer.font.options.every((o) => o.colour === null)).toBe(true);
  });

  it('follows a pick: the accent’s heading names the new one', () => {
    const looks = pickOption(INITIAL_HUD_LOOKS, { knob: 'accent', value: 'forge' });
    const drawer = hudDrawer(looks, false);
    expect(drawer.accent.title).toBe('ACCENT · FORGE');
    expect(selectedKeys(drawer.accent)).toEqual(['forge']);
    expect(pickOption(looks, { knob: 'font', value: 'mono' }).active.font).toBe('mono');
    expect(pickOption(looks, { knob: 'ground', value: 'ember' }).active.ground).toBe('ember');
  });
});

describe('the looks row and the status line', () => {
  it('shows the five presets, then the saved looks, the active one selected', () => {
    const looks = looksOf(saveAsNew(setKnob(INITIAL_HUD_LOOKS, 'grid', 20)));
    const row = drawerLooks(looks);
    expect(row.map((item) => item.look.name)).toEqual([
      ...HUD_PRESET_LOOKS.map((look) => look.name),
      'MINE 1',
    ]);
    expect(row.filter((item) => item.selected).map((item) => item.look.id)).toEqual(['mine-1']);
    expect(row.filter((item) => item.own).map((item) => item.look.id)).toEqual(['mine-1']);
    expect(row.at(-1)?.label).toBe('MINE 1, selected');
  });

  it('draws each swatch in the look’s ground with its accent', () => {
    const forge = drawerLooks(INITIAL_HUD_LOOKS).find((item) => item.look.id === 'forge');
    expect(forge?.ground).toBe(HUD_GROUNDS.ember.bg);
    expect(forge?.accent).toBe(HUD_ACCENTS.forge.hex);
    expect(forge?.selected).toBe(false);
  });

  it('reads the look’s name, then marks it edited after a change', () => {
    expect(hudDrawer(INITIAL_HUD_LOOKS, false).status).toBe('ARC');
    const edited = slide(INITIAL_HUD_LOOKS, 'grid', 5);
    expect(hudDrawer(edited, false).status).toBe('ARC · EDITED');
  });
});

describe('the sliders', () => {
  it('runs the grid from 0 to 30 and clamps a reading to whole numbers in it', () => {
    const { grid } = hudDrawer(INITIAL_HUD_LOOKS, false);
    expect([grid.min, grid.max, grid.cap, grid.value]).toEqual([0, 30, 30, 14]);
    expect(slide(INITIAL_HUD_LOOKS, 'grid', 45).active.grid).toBe(30);
    expect(slide(INITIAL_HUD_LOOKS, 'grid', 7.6).active.grid).toBe(8);
    expect(grid.words(14)).toBe('14 of 30');
  });

  it('stops the glow at the vendored safeGlow for each preset (KS9)', () => {
    const caps = HUD_PRESET_LOOKS.map((look) => glowCap(look));
    expect(caps).toEqual([23, 27, 18, 29, 21]);
    const { glow } = hudDrawer(INITIAL_HUD_LOOKS, false);
    expect([glow.min, glow.max, glow.cap, glow.value]).toEqual([0, 40, 23, 22]);
  });

  it('shows NOVA at the glow HUD paints, one step under its look', () => {
    const { glow } = hudDrawer(NOVA, false);
    expect(NOVA.active.glow).toBe(30);
    expect(glow.cap).toBe(29);
    expect(glow.value).toBe(29);
    expect(glow.words(29)).toBe('29 percent, the most this look keeps readable');
  });

  it('never takes the glow past the cap, and keeps it whole', () => {
    expect(slide(INITIAL_HUD_LOOKS, 'glow', 40).active.glow).toBe(23);
    expect(slide(INITIAL_HUD_LOOKS, 'glow', 10.4).active.glow).toBe(10);
    expect(slide(INITIAL_HUD_LOOKS, 'glow', -3).active.glow).toBe(0);
    expect(hudDrawer(slide(INITIAL_HUD_LOOKS, 'glow', 0), false).glow.words(0)).toBe('Off');
  });
});

describe('the switches', () => {
  it('writes SCAN, AUTO and MOTION with their state', () => {
    const ghost = pickLook(INITIAL_HUD_LOOKS, 'ghost');
    const { switches } = hudDrawer(ghost, false);
    expect(switches.map((s) => s.knob)).toEqual(HUD_SWITCH_KNOBS);
    expect(switches.map((s) => s.text)).toEqual(['SCAN OFF', 'AUTO OFF', 'MOTION ON']);
    expect(switches.map((s) => s.on)).toEqual([false, false, true]);
    expect(switches.map((s) => s.label)).toEqual(['Scanlines', 'Auto', 'Motion']);
    expect(switches.some((s) => s.disabled)).toBe(false);
  });

  it('flips a switch on and off', () => {
    const off = flipSwitch(INITIAL_HUD_LOOKS, 'scan', false);
    expect(off.active.scan).toBe('off');
    expect(hudDrawer(off, false).switches[0]?.text).toBe('SCAN OFF');
    expect(flipSwitch(off, 'scan', false).active.scan).toBe('on');
    expect(flipSwitch(INITIAL_HUD_LOOKS, 'motion', false).active.motion).toBe('off');
  });

  it('holds MOTION off under Reduce Motion: it says why and cannot turn motion on', () => {
    const drawer = hudDrawer(INITIAL_HUD_LOOKS, true);
    const motion = drawer.switches.find((s) => s.knob === 'motion');
    expect(INITIAL_HUD_LOOKS.active.motion).toBe('on');
    expect(motion).toMatchObject({ text: 'MOTION OFF', on: false, disabled: true });
    expect(drawer.motionNote).toBe('MOTION OFF · REDUCE MOTION');
    const stillOff = flipSwitch(INITIAL_HUD_LOOKS, 'motion', false);
    expect(flipSwitch(stillOff, 'motion', true)).toBe(stillOff);
    expect(flipSwitch(INITIAL_HUD_LOOKS, 'scan', true).active.scan).toBe('off');
    expect(hudDrawer(INITIAL_HUD_LOOKS, false).motionNote).toBeNull();
  });
});

describe('reset and immutability', () => {
  it('offers RESET only when it would change the look', () => {
    expect(hudDrawer(INITIAL_HUD_LOOKS, false).canReset).toBe(false);
    const edited = pickOption(INITIAL_HUD_LOOKS, { knob: 'ground', value: 'navy' });
    expect(hudDrawer(edited, false).canReset).toBe(true);
    expect(hudDrawer(resetLook(edited), false).canReset).toBe(false);
  });

  it('returns the same looks when nothing changes and never mutates its input', () => {
    const before = JSON.stringify(INITIAL_HUD_LOOKS);
    expect(pickOption(INITIAL_HUD_LOOKS, { knob: 'accent', value: 'arc' })).toBe(INITIAL_HUD_LOOKS);
    expect(slide(INITIAL_HUD_LOOKS, 'grid', 14)).toBe(INITIAL_HUD_LOOKS);
    slide(INITIAL_HUD_LOOKS, 'glow', 5);
    flipSwitch(INITIAL_HUD_LOOKS, 'auto', false);
    expect(JSON.stringify(INITIAL_HUD_LOOKS)).toBe(before);
    expect(Object.isFrozen(hudDrawer(INITIAL_HUD_LOOKS, false))).toBe(true);
  });
});

describe('frames and faces', () => {
  const vars = hudVars(INITIAL_HUD_LOOKS.active);

  it('frames the selected option in 1.5 pt of the accent and the rest in 1 pt of the line', () => {
    expect(drawerFrame(true, vars)).toEqual({ borderWidth: 1.5, borderColor: vars.accent });
    expect(drawerFrame(false, vars)).toEqual({ borderWidth: 1, borderColor: vars.line });
  });

  it('sets each Type option in its own display face at the drawing’s size', () => {
    const faces = HUD_FONT_KEYS.map((font) => drawerFace(font, 15, 0.1));
    expect(new Set(faces.map((face) => face.fontFamily)).size).toBe(HUD_FONT_KEYS.length);
    expect(faces.every((face) => face.fontSize === 15)).toBe(true);
    expect(drawerFace('raj', 22, 0.2).letterSpacing).toBeCloseTo(4.4);
  });
});
