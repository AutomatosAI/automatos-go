import { describe, expect, it } from 'vitest';

import { contrastRatio } from '../../../core/web/lib/look-kit/contrast';
import { ACCENTS, ERROR_COLOUR } from '../../../core/web/lib/looks/catalogue';
import { PRESETS } from '../../../core/web/lib/looks/presets';
import {
  HUD_STYLES,
  PLAY_STYLES,
  STUDIO_DARK,
  STUDIO_LIGHT,
  STUDIO_STYLES,
} from '../../dress/__tests__/fixtures';
import { HUD_PRESET_LOOKS } from '../../hud/look-schema';
import type { StyleMotion } from '../../provider/resolve';
import { pickerState, type PickerInput } from '../../registry/picker';
import { FOLLOW_STUDIO, builtinChoice, themeChoice } from '../../registry/style-id';
import { MIN_TEXT_SIZE } from '../../type';
import { hudVars } from '../../tokens/hud';
import { HUD_FIXED, HUD_LOOK_CATALOGUE } from '../../tokens/hud-catalogue';
import { playVars } from '../../tokens/play';
import {
  CARD_RING,
  PREVIEW,
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
  it('are Studio, Play and HUD in order with their names and taglines', () => {
    expect(cardsFor().map(({ id, name, tagline }) => ({ id, name, tagline }))).toEqual([
      { id: 'studio', name: 'Studio', tagline: 'Cream paper or Studio Dark' },
      { id: 'play', name: 'Play', tagline: 'Auto and the Ember look' },
      { id: 'hud', name: 'HUD', tagline: 'Voice first, glow and grid' },
    ]);
  });

  it("name each card '<Style> style' and leave the selected state to accessibilityState", () => {
    const cards = cardsFor({ choice: builtinChoice('play') });
    expect(cards.map((c) => c.accessibilityLabel)).toEqual([
      'Studio style',
      'Play style',
      'HUD style',
    ]);
    expect(cards.map((c) => c.selected)).toEqual([false, true, false]);
    expect(cards.map((c) => c.accessibilityHint)).toEqual([
      'Paints Automatos Go in Studio',
      'Paints Automatos Go in Play',
      'Paints Automatos Go in HUD',
    ]);
  });

  it("put the word 'Selected' on the chosen card only (never colour alone)", () => {
    expect(cardsFor({ choice: builtinChoice('hud') }).map((c) => c.selectedWord)).toEqual([
      null,
      null,
      'Selected',
    ]);
  });

  it('give Studio Light / Dark / System and the others no scheme', () => {
    const [studio, play, hud] = cardsFor({ studioScheme: 'dark' });
    expect(studio.schemes.map(({ value, label, selected }) => [value, label, selected])).toEqual([
      ['light', 'Light', false],
      ['dark', 'Dark', true],
      ['system', 'System', false],
    ]);
    expect(studio.schemeGroup).toBe('Studio appearance');
    expect(play.schemes).toEqual([]);
    expect(hud.schemes).toEqual([]);
  });

  it("link Play to 'Make it yours →' and HUD to 'Looks →', and Studio to none", () => {
    const [studio, play, hud] = cardsFor();
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
  });

  it('list installed themes under Studio only when the server offers them', () => {
    expect(cardsFor({ installedThemes: [HARBOUR] })[0].themes).toEqual([]);
    const offered = cardsFor({
      installedThemes: [HARBOUR],
      canMobileTheme: true,
      choice: themeChoice('inst-harbour'),
    });
    const [studio, play, hud] = offered;
    expect(
      studio.themes.map(({ title, selected, selectedWord }) => [title, selected, selectedWord]),
    ).toEqual([['Harbour · 1.1.0', true, 'Selected']]);
    expect(studio.selectedWord).toBeNull();
    expect(play.themes).toEqual([]);
    expect(hud.themes).toEqual([]);
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
    for (const style of [...STUDIO_STYLES, ...PLAY_STYLES, ...HUD_STYLES]) {
      const ring = selectedPaint(style).ring;
      expect(cardFrame(true, style)).toEqual({ borderWidth: 2, margin: 0, colour: ring });
    }
  });

  it('keeps the others the same size with a 1 pt border and a 1 pt margin', () => {
    for (const style of [STUDIO_LIGHT, PLAY_STYLES[0], HUD_STYLES[0]]) {
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

  it("keep Studio Light and Dark (and an installed theme) on Studio's accent", () => {
    for (const style of STUDIO_STYLES) {
      const { accent } = style.tokens.colours;
      expect(selectedPaint(style)).toEqual({ ring: accent, word: accent });
    }
    expect(selectedPaint(STUDIO_DARK).ring).not.toBe(selectedPaint(STUDIO_LIGHT).ring);
  });

  it("read 'Selected' at AA on the card under every style and preset", () => {
    for (const style of [...STUDIO_STYLES, ...PLAY_STYLES, ...HUD_STYLES]) {
      const ratio = contrastRatio(selectedPaint(style).word, style.tokens.colours.card);
      expect(
        ratio,
        `${style.layout} ${style.playLook?.id ?? style.hudLook?.id ?? style.tone}`,
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

  it("word Play's tool chip and HUD's chip as the real screens do", () => {
    expect(playToolLine()).toBe('✓ Searched the web · 3 results');
    expect(hudChipWords()).toBe('READY WHEN YOU ARE');
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
