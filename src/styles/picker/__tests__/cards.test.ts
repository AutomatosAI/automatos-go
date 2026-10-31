import { describe, expect, it } from 'vitest';

import { contrastRatio } from '../../../core/web/lib/look-kit/contrast';
import { ACCENTS, ERROR_COLOUR } from '../../../core/frozen/lib/looks/catalogue';
import { PRESETS } from '../../../core/frozen/lib/looks/presets';
import {
  ARCADE_STYLES,
  CANDY_STYLES,
  HUD_STYLES,
  PLAY_STYLES,
  STUDIO_DARK,
  STUDIO_LIGHT,
  STUDIO_STYLES,
} from '../../dress/__tests__/fixtures';
import { ARCADE_PRESET_LOOKS } from '../../arcade/look-schema';
import { HUD_PRESET_LOOKS } from '../../hud/look-schema';
import type { StyleMotion } from '../../provider/resolve';
import { pickerState, type PickerInput } from '../../registry/picker';
import { FOLLOW_STUDIO, builtinChoice, themeChoice } from '../../registry/style-id';
import { MIN_TEXT_SIZE } from '../../type';
import { ARCADE_BODY_MIN } from '../../typeface/arcade-type';
import { arcadeVars } from '../../tokens/arcade';
import { hudVars } from '../../tokens/hud';
import { HUD_FIXED, HUD_LOOK_CATALOGUE } from '../../tokens/hud-catalogue';
import { playVars } from '../../tokens/play';
import {
  CARD_RING,
  PREVIEW,
  arcadePreviewWords,
  cardFrame,
  hudChipWords,
  pickerCards,
  playToolLine,
  previewAnimates,
  selectedPaint,
} from '../cards';
import {
  autoStandIn,
  autoStandInPaint,
  playGlowStops,
  ringStandIn,
  ringStandInPaint,
} from '../stand-ins';

const HARBOUR = { installId: 'inst-harbour', name: 'Harbour', version: '1.1.0' };

function cardsFor(overrides: Partial<PickerInput> = {}) {
  return pickerCards(
    pickerState({
      choice: builtinChoice('studio'),
      studioScheme: 'system',
      installedThemes: [],
      canMobileTheme: false,
      ...overrides,
    }),
  );
}

describe('the picker cards', () => {
  it('are Studio, Play, HUD, Arcade and Candy in order with their names and taglines', () => {
    expect(cardsFor().map(({ id, name, tagline }) => ({ id, name, tagline }))).toEqual([
      { id: 'studio', name: 'Studio', tagline: 'Cream paper or Studio Dark' },
      { id: 'play', name: 'Play', tagline: 'Auto and the Ember look' },
      { id: 'hud', name: 'HUD', tagline: 'Voice first, glow and grid' },
      {
        id: 'arcade',
        name: 'Arcade',
        tagline: 'Your agents as a party, Auto in the dialogue box',
      },
      { id: 'candy', name: 'Candy', tagline: 'Bright, glossy and round' },
    ]);
  });

  it("name each card '<Style> style' and leave the selected state to accessibilityState", () => {
    const cards = cardsFor({ choice: builtinChoice('play') });
    expect(cards.map((c) => c.accessibilityLabel)).toEqual([
      'Studio style',
      'Play style',
      'HUD style',
      'Arcade style',
      'Candy style',
    ]);
    expect(cards.map((c) => c.selected)).toEqual([false, true, false, false, false]);
    expect(cards.map((c) => c.accessibilityHint)).toEqual([
      'Paints Automatos Go in Studio',
      'Paints Automatos Go in Play',
      'Paints Automatos Go in HUD',
      'Paints Automatos Go in Arcade',
      'Paints Automatos Go in Candy',
    ]);
  });

  it("put the word 'Selected' on the chosen card only (never colour alone)", () => {
    expect(cardsFor({ choice: builtinChoice('hud') }).map((c) => c.selectedWord)).toEqual([
      null,
      null,
      'Selected',
      null,
      null,
    ]);
    expect(cardsFor({ choice: builtinChoice('arcade') }).map((c) => c.selectedWord)).toEqual([
      null,
      null,
      null,
      'Selected',
      null,
    ]);
    expect(cardsFor({ choice: builtinChoice('candy') }).map((c) => c.selectedWord)).toEqual([
      null,
      null,
      null,
      null,
      'Selected',
    ]);
  });

  it('give Studio Light / Dark / System and the others no scheme', () => {
    const [studio, play, hud, arcade, candy] = cardsFor({ studioScheme: 'dark' });
    expect(studio.schemes.map(({ value, label, selected }) => [value, label, selected])).toEqual([
      ['light', 'Light', false],
      ['dark', 'Dark', true],
      ['system', 'System', false],
    ]);
    expect(studio.schemeGroup).toBe('Studio appearance');
    expect(play.schemes).toEqual([]);
    expect(hud.schemes).toEqual([]);
    expect(arcade.schemes).toEqual([]);
    expect(candy.schemes).toEqual([]);
  });

  it("link Play to 'Make it yours →', HUD to 'Looks →', Arcade to 'Options →', Candy to 'Make it sweet →' and Studio to none", () => {
    const [studio, play, hud, arcade, candy] = cardsFor();
    expect(studio.lookLink).toBeNull();
    expect(play.lookLink).toEqual({
      label: 'Make it yours →',
      accessibilityLabel: 'Make it yours',
      accessibilityHint: "Opens Play's looks",
      href: '/settings/look/play',
    });
    expect(hud.lookLink).toEqual({
      label: 'Looks →',
      accessibilityLabel: 'Looks',
      accessibilityHint: "Opens HUD's looks",
      href: '/settings/look/hud',
    });
    expect(arcade.lookLink).toEqual({
      label: 'Options →',
      accessibilityLabel: 'Options',
      accessibilityHint: "Opens Arcade's looks",
      href: '/settings/look/arcade',
    });
    expect(candy.lookLink).toEqual({
      label: 'Make it sweet →',
      accessibilityLabel: 'Make it sweet',
      accessibilityHint: "Opens Candy's looks",
      href: '/settings/look/candy',
    });
  });

  it('list installed themes under Studio only when the server offers them', () => {
    expect(cardsFor({ installedThemes: [HARBOUR] })[0].themes).toEqual([]);
    const offered = cardsFor({
      installedThemes: [HARBOUR],
      canMobileTheme: true,
      choice: themeChoice('inst-harbour'),
    });
    const [studio, play, hud, arcade, candy] = offered;
    expect(
      studio.themes.map(({ title, selected, selectedWord }) => [title, selected, selectedWord]),
    ).toEqual([['Harbour · 1.1.0', true, 'Selected']]);
    expect(studio.selectedWord).toBeNull();
    expect(play.themes).toEqual([]);
    expect(hud.themes).toEqual([]);
    expect(arcade.themes).toEqual([]);
    expect(candy.themes).toEqual([]);
  });

  it('carry no pointer to making an account and nothing about plans', () => {
    const words = JSON.stringify(cardsFor({ installedThemes: [HARBOUR], canMobileTheme: true }));
    expect(words).not.toMatch(/sign up|create an account|no account|plan|credit|price/i);
  });

  it('are frozen', () => {
    const cards = cardsFor();
    expect(Object.isFrozen(cards)).toBe(true);
    expect(cards.every((c) => Object.isFrozen(c) && Object.isFrozen(c.themes))).toBe(true);
  });
});

describe("the card's frame", () => {
  it("rings the chosen card 2 pt in its style's accent", () => {
    for (const style of [
      ...STUDIO_STYLES,
      ...PLAY_STYLES,
      ...HUD_STYLES,
      ...ARCADE_STYLES,
      ...CANDY_STYLES,
    ]) {
      const ring = selectedPaint(style).ring;
      expect(cardFrame(true, style)).toEqual({ borderWidth: 2, margin: 0, colour: ring });
    }
  });

  it('keeps the others the same size with a 1 pt border and a 1 pt margin', () => {
    for (const style of [
      STUDIO_LIGHT,
      PLAY_STYLES[0],
      HUD_STYLES[0],
      ARCADE_STYLES[0],
      CANDY_STYLES[0],
    ]) {
      const idle = cardFrame(false, style);
      expect(idle).toEqual({ borderWidth: 1, margin: 1, colour: style.tokens.colours.border });
      expect(idle.borderWidth + idle.margin).toBe(CARD_RING.selected);
    }
  });
});

describe("the chosen card's ring and 'Selected' (never the error colour)", () => {
  /** WCAG AA for the 'Selected' word (mono 11 pt and up: normal text). */
  const AA = 4.5;

  it("ring Play in its look's accent and word it in the accent's text, under every preset", () => {
    expect(PLAY_STYLES.length).toBeGreaterThanOrEqual(PRESETS.length);
    for (const style of PLAY_STYLES) {
      const { playLook, play, tokens } = style;
      if (!playLook || !play) throw new Error('a Play style carries its look and variables');
      const paint = selectedPaint(style);
      expect(paint.ring).toBe(ACCENTS[playLook.accent].hex);
      expect(paint.ring).toBe(play.accent);
      expect(paint.ring).not.toBe(ERROR_COLOUR);
      expect(paint.ring).not.toBe(tokens.colours.accent);
      expect(paint.word).toBe(play.accentText);
    }
  });

  it("ring HUD in its look's accent and word it in that accent, under every preset", () => {
    for (const style of HUD_STYLES) {
      const { hudLook, hud, tokens } = style;
      if (!hudLook || !hud) throw new Error('a HUD style carries its look and variables');
      const paint = selectedPaint(style);
      expect(paint.ring).toBe(HUD_LOOK_CATALOGUE.accents[hudLook.accent].hex);
      expect(paint.ring).toBe(hud.accent);
      expect(paint.ring).not.toBe(HUD_FIXED.error);
      expect(paint.ring).not.toBe(tokens.colours.accent);
      expect(paint.word).toBe(hud.accent);
    }
  });

  it("ring Arcade in its palette's accent and word it in that accent, under every preset", () => {
    expect(ARCADE_STYLES.length).toBeGreaterThanOrEqual(ARCADE_PRESET_LOOKS.length);
    for (const style of ARCADE_STYLES) {
      const { arcadeLook, arcade } = style;
      if (!arcadeLook || !arcade) throw new Error('an Arcade style carries its look and variables');
      const paint = selectedPaint(style);
      expect(paint.ring).toBe(arcadeVars(arcadeLook).ac);
      expect(paint.ring).toBe(arcade.ac);
      expect(paint.ring).not.toBe(arcade.hp);
      expect(paint.word).toBe(arcade.ac);
    }
  });

  it("keep Studio Light and Dark (and an installed theme) on Studio's accent", () => {
    for (const style of STUDIO_STYLES) {
      const { accent } = style.tokens.colours;
      expect(selectedPaint(style)).toEqual({ ring: accent, word: accent });
    }
    expect(selectedPaint(STUDIO_DARK).ring).not.toBe(selectedPaint(STUDIO_LIGHT).ring);
  });

  it("read 'Selected' at AA on the card under every style and preset", () => {
    for (const style of [
      ...STUDIO_STYLES,
      ...PLAY_STYLES,
      ...HUD_STYLES,
      ...ARCADE_STYLES,
      ...CANDY_STYLES,
    ]) {
      const ratio = contrastRatio(selectedPaint(style).word, style.tokens.colours.card);
      const look =
        style.playLook?.id ?? style.hudLook?.id ?? style.arcadeLook?.id ?? style.candyLook?.id;
      expect(
        ratio,
        `${style.layout} ${look ?? style.tone}`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });
});

describe('preview motion', () => {
  const looping: StyleMotion = { loops: true, reason: null };
  const reduced: StyleMotion = { loops: false, reason: 'reduce-motion' };
  const lookOff: StyleMotion = { loops: false, reason: 'look' };

  it('moves only while the screen is focused and the style may loop', () => {
    expect(previewAnimates(true, looping)).toBe(true);
    expect(previewAnimates(false, looping)).toBe(false);
    expect(previewAnimates(true, reduced)).toBe(false);
    expect(previewAnimates(true, lookOff)).toBe(false);
  });
});

describe('the previews', () => {
  it("draw Auto at 84 and HUD's core at 120", () => {
    expect(PREVIEW.autoSize).toBe(84);
    expect(PREVIEW.ringCore).toBe(120);
  });

  it('say nothing under 11 pt', () => {
    expect(PREVIEW.toolLineSize).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
    expect(PREVIEW.chip.size).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
  });

  it("word Play's tool chip, HUD's chip and Arcade's dialogue as the real screens do", () => {
    expect(playToolLine()).toBe('✓ Searched the web · 3 results');
    expect(hudChipWords()).toBe('READY WHEN YOU ARE');
    expect(arcadePreviewWords()).toEqual({ state: 'IDLE', line: 'Your move.' });
  });

  it("show Arcade's counters as a home does: ! and QUEST, no XP (D-ARC-6)", () => {
    expect(PREVIEW.arcade.counters).toEqual({ xp: null, needs: 2, quest: 3 });
  });

  it("set Arcade's line at its body floor", () => {
    expect(PREVIEW.arcade.lineSize).toBeGreaterThanOrEqual(ARCADE_BODY_MIN);
  });

  it('pulse on one 2.4 s loop: Ember 1 → 1.06, the HUD disc 0.96 ↔ 1.04', () => {
    expect(PREVIEW.pulseMs).toBe(2400);
    expect(PREVIEW.playPulse).toEqual({ from: 1, to: 1.06 });
    expect(PREVIEW.hudPulse).toEqual({ from: 0.96, to: 1.04 });
  });
});

describe('the stand-ins', () => {
  it('size Auto as Mascot.dc.html does: box 0.9s, ring 0.8s x 0.18s, figure 0.62s x 0.74s', () => {
    const auto = autoStandIn(100);
    expect(auto.box).toEqual({ width: 90, height: 100 });
    expect(auto.ring).toEqual({ width: 80, height: 18, stroke: 2 });
    expect(auto.body.width).toBeCloseTo(62);
    expect(auto.body.height).toBeCloseTo(74);
    expect(auto.body.bottom).toBeCloseTo(13);
  });

  it("paint Auto's ring in his light at rest under every Play preset", () => {
    for (const look of PRESETS) {
      const vars = playVars(look);
      const paint = autoStandInPaint(look, vars);
      expect(paint.ring.toLowerCase()).toBe(vars.autoLight.toLowerCase());
      expect(paint.ringGlow).toMatch(/^rgba\(\d+,\d+,\d+,0\.35\)$/);
      expect(paint.eye).toBe(vars.autoLight);
      const [from, to] = playGlowStops(vars);
      expect(from).toMatch(/,0\)$/);
      expect(to).toBe(vars.glow);
    }
  });

  it("size HUD's rings from core(): the dashed ring at 22 %, the disc at 30 %", () => {
    const core = ringStandIn(120);
    expect(core.outer).toBe(120);
    expect(core.dashed).toBeCloseTo(67.2);
    expect(core.disc).toBeCloseTo(48);
  });

  it("paint HUD's rings in each preset's accent", () => {
    for (const preset of HUD_PRESET_LOOKS) {
      const vars = hudVars(preset);
      const paint = ringStandInPaint(vars);
      expect(paint.outer).toMatch(/,0\.22\)$/);
      expect(paint.dashed).toMatch(/,0\.4\)$/);
      expect(paint.disc).toMatch(/,0\.28\)$/);
    }
  });
});

describe("the 'Same as Studio' row on Studio's card (US-016i)", () => {
  it("carries the 'Selected' word only while the phone follows Studio", () => {
    const [studio, play] = cardsFor({ choice: FOLLOW_STUDIO, followed: builtinChoice('hud') });
    expect(studio.follow).toMatchObject({
      title: 'Same as Studio',
      summary: 'Now HUD',
      selected: true,
      selectedWord: 'Selected',
      accessibilityHint: 'Automatos Go follows the theme you use in Studio',
    });
    expect(play.follow).toBeNull();
    expect(cardsFor({ choice: builtinChoice('studio') })[0].follow?.selectedWord).toBeNull();
  });

  it('sits with the installed theme rows it comes before', () => {
    const [studio] = cardsFor({
      choice: themeChoice('inst-harbour'),
      installedThemes: [HARBOUR],
      canMobileTheme: true,
    });
    expect(studio.follow?.selected).toBe(false);
    expect(studio.themes.map((row) => row.selectedWord)).toEqual(['Selected']);
  });
});
