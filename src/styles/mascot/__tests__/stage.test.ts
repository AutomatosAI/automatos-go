// What Auto's stage shows for the resolved style (stage.ts): nothing where the style has no mascot;
// the bundled Auto in Play and HUD (Play's shell, the sleeping dim on top); stills under Reduce
// Motion, HUD's motion 'off', on Android and after a failed clip; an installed theme's own files;
// the ring's colour and pulse; VoiceOver's name.

import { describe, expect, it } from 'vitest';

import { SHELLS } from '../../../core/web/lib/looks/catalogue';
import { DAYLIGHT, EMBER, OBSIDIAN } from '../../../core/web/lib/looks/presets';
import type { Look } from '../../../core/web/lib/looks/types';
import { captionFor } from '../../../core/web/lib/mascot/media';
import { ringColour } from '../../../core/web/lib/mascot/ring';
import { MASCOT_STATES, type MascotName } from '../../../core/web/lib/mascot/types';
import { HUD_DEFAULT_LOOK, HUD_PRESET_LOOKS, type HudLook } from '../../hud/look-schema';
import { resolveStyle, type StyleInput, type ThemePaint } from '../../provider/resolve';
import { builtinChoice, themeChoice, type StyleChoice } from '../../registry/style-id';
import type { ThemeMascot } from '../../themes/types';
import { playTokens } from '../../tokens/play';
import type { BundledMascot } from '../bundled';
import type { ThemeMascotMedia } from '../media';
import { hudRingPalette, studioRingPalette } from '../ring-palette';
import { cssFilterToColorMatrix } from '../shell-matrix';
import {
  SLEEP_DIM,
  mascotFilter,
  mascotLabel,
  mascotStage,
  playsClip,
  skiaMedia,
  themeMascotFor,
  themeMascotOf,
  type MascotStageInput,
} from '../stage';

const table = (base: number) =>
  Object.fromEntries(MASCOT_STATES.map((state, i) => [state, base + i])) as Record<
    MascotName,
    number
  >;
const IOS: BundledMascot = { clips: table(100), stills: table(200) };
const ANDROID: BundledMascot = { clips: null, stills: table(200) };
const clipOf = (state: MascotName) => 100 + MASCOT_STATES.indexOf(state);
const stillOf = (state: MascotName) => 200 + MASCOT_STATES.indexOf(state);

const INSTALL_ID = '3f2b6c1e-9d4a-4b7e-8c21-5a6f0e9d1b42';
const THEME = themeChoice(INSTALL_ID);
const GOLD: Look = Object.freeze({ ...EMBER, shell: 'gold' });
const GHOST = HUD_PRESET_LOOKS.find((look) => look.id === 'ghost') as HudLook;
const HUD_STILL: HudLook = Object.freeze({ ...HUD_DEFAULT_LOOK, motion: 'off' });
const FILES = '/api/themes/files/abc/assets/mascot';

const THEME_MASCOT: ThemeMascot = Object.freeze({
  mode: 'clips',
  states: [
    { name: 'idle', clip: `${FILES}/idle.mp4`, still: `${FILES}/idle.png` },
    { name: 'oops', clip: null, still: `${FILES}/oops.png` },
  ],
});

function painting(overrides: Partial<ThemePaint> = {}): ThemePaint {
  return Object.freeze({
    installId: INSTALL_ID,
    colours: Object.freeze({ light: playTokens(DAYLIGHT), dark: playTokens(OBSIDIAN) }),
    tone: null,
    mascot: true,
    mascotFiles: THEME_MASCOT,
    ...overrides,
  });
}

function style(choice: StyleChoice, overrides: Partial<StyleInput> = {}) {
  return resolveStyle({
    choice,
    studioScheme: 'light',
    systemScheme: 'light',
    playLook: EMBER,
    hudLook: HUD_DEFAULT_LOOK,
    themePaint: null,
    reduceMotion: false,
    ...overrides,
  });
}

const PLAY = style(builtinChoice('play'));

function stageInput(overrides: Partial<MascotStageInput> = {}): MascotStageInput {
  return {
    style: PLAY,
    platform: 'ios',
    clipFailed: false,
    theme: null,
    bundled: IOS,
    tintedClips: true,
    ...overrides,
  };
}

describe('where Auto shows', () => {
  it('Studio without a theme mascot shows none', () => {
    expect(mascotStage(stageInput({ style: style(builtinChoice('studio')) }), 'idle')).toBeNull();
  });

  it("HUD with the look's auto off shows none", () => {
    const hud = style(builtinChoice('hud'), { hudLook: GHOST });
    expect(GHOST.auto).toBe('off');
    expect(mascotStage(stageInput({ style: hud }), 'idle')).toBeNull();
  });

  it('a theme that brings Auto but has no copies on hand shows none', () => {
    const themed = style(THEME, { themePaint: painting() });
    expect(themed.mascot).toBe('theme');
    expect(mascotStage(stageInput({ style: themed, theme: null }), 'idle')).toBeNull();
  });
});

describe('the bundled Auto', () => {
  it.each(MASCOT_STATES.filter((s) => s !== 'sleeping'))(
    "Play's Bronze shell on iOS plays %s's clip untinted, the ring in the look's colour",
    (state) => {
      const stage = mascotStage(stageInput(), state);
      expect(stage).toEqual({
        media: { kind: 'clip', clip: clipOf(state), still: stillOf(state) },
        ring: ringColour(state, EMBER),
        pulse: true,
        stills: false,
      });
    },
  );

  it('sleeping is dimmed on top of the shell: the clip goes through Skia', () => {
    const stage = mascotStage(stageInput(), 'sleeping');
    expect(stage?.media).toEqual({
      kind: 'tinted-clip',
      clip: clipOf('sleeping'),
      still: stillOf('sleeping'),
      matrix: cssFilterToColorMatrix(SLEEP_DIM),
    });
    expect(stage?.stills).toBe(false);
  });

  it("a tinted shell plays the clip through the shell's matrix", () => {
    const gold = style(builtinChoice('play'), { playLook: GOLD });
    const stage = mascotStage(stageInput({ style: gold }), 'thinking');
    expect(stage?.media).toEqual({
      kind: 'tinted-clip',
      clip: clipOf('thinking'),
      still: stillOf('thinking'),
      matrix: cssFilterToColorMatrix(SHELLS.gold.filter),
    });
    expect(stage?.ring).toBe(ringColour('thinking', GOLD));
  });

  it('KS11 off: a tinted shell shows the tinted still', () => {
    const gold = style(builtinChoice('play'), { playLook: GOLD });
    const stage = mascotStage(stageInput({ style: gold, tintedClips: false }), 'idle');
    expect(stage?.media.kind).toBe('tinted-still');
    expect(stage?.stills).toBe(true);
  });

  it('HUD paints its ring in the look and plays the untinted clip', () => {
    const hud = style(builtinChoice('hud'));
    const stage = mascotStage(stageInput({ style: hud }), 'working');
    expect(stage?.media.kind).toBe('clip');
    expect(stage?.ring).toBe(hudRingPalette(HUD_DEFAULT_LOOK).accent);
  });
});

describe('stills', () => {
  it('Reduce Motion: the still, a still ring', () => {
    const still = style(builtinChoice('play'), { reduceMotion: true });
    const stage = mascotStage(stageInput({ style: still }), 'idle');
    expect(stage).toMatchObject({
      media: { kind: 'still', still: stillOf('idle') },
      pulse: false,
      stills: true,
    });
  });

  it("HUD's motion off stops his loop as well", () => {
    const hud = style(builtinChoice('hud'), { hudLook: HUD_STILL });
    const stage = mascotStage(stageInput({ style: hud }), 'idle');
    expect(stage).toMatchObject({ media: { kind: 'still' }, pulse: false, stills: true });
  });

  it('Android has no clips: the still, while the ring still pulses', () => {
    const stage = mascotStage(stageInput({ platform: 'android', bundled: ANDROID }), 'idle');
    expect(stage).toMatchObject({ media: { kind: 'still' }, pulse: true, stills: true });
  });

  it('a clip that failed: stills from then on', () => {
    const stage = mascotStage(stageInput({ clipFailed: true }), 'idle');
    expect(stage).toMatchObject({ media: { kind: 'still' }, stills: true });
  });

  it("a tinted clip that failed: the shell's still, and stills from then on", () => {
    const gold = style(builtinChoice('play'), { playLook: GOLD });
    const stage = mascotStage(stageInput({ style: gold, clipFailed: true }), 'thinking');
    expect(stage?.media).toEqual({
      kind: 'tinted-still',
      still: stillOf('thinking'),
      matrix: cssFilterToColorMatrix(SHELLS.gold.filter),
    });
    expect(stage?.stills).toBe(true);
  });

  it('sleeping after a failed clip: the dimmed still', () => {
    const stage = mascotStage(stageInput({ clipFailed: true }), 'sleeping');
    expect(stage?.media).toEqual({
      kind: 'tinted-still',
      still: stillOf('sleeping'),
      matrix: cssFilterToColorMatrix(SLEEP_DIM),
    });
    expect(stage?.stills).toBe(true);
  });
});

describe("an installed theme's Auto", () => {
  const themed = style(THEME, { themePaint: painting() });
  const copies: ThemeMascotMedia = {
    mode: 'clips',
    states: { idle: { clip: 'file:///cache/idle.mp4', still: 'file:///cache/idle.png' } },
  };

  it('plays its own clip untinted, the ring in ink and orange', () => {
    const stage = mascotStage(stageInput({ style: themed, theme: copies }), 'idle');
    expect(stage).toEqual({
      media: { kind: 'clip', clip: 'file:///cache/idle.mp4', still: 'file:///cache/idle.png' },
      ring: studioRingPalette(themed.tokens.colours).light,
      pulse: true,
      stills: false,
    });
  });

  it('a state whose copy is not on the phone keeps the bundled Auto', () => {
    const stage = mascotStage(stageInput({ style: themed, theme: copies }), 'thinking');
    expect(stage?.media).toEqual({
      kind: 'clip',
      clip: clipOf('thinking'),
      still: stillOf('thinking'),
    });
  });

  it('themeMascotOf: the painting on screen only', () => {
    expect(themeMascotOf(THEME, painting())).toBe(THEME_MASCOT);
    expect(themeMascotOf(THEME, painting({ installId: 'another' }))).toBeNull();
    expect(themeMascotOf(THEME, painting({ mascotFiles: null }))).toBeNull();
    expect(themeMascotOf(THEME, null)).toBeNull();
    expect(themeMascotOf(builtinChoice('studio'), painting())).toBeNull();
  });

  it('themeMascotFor: one state looked up at a time', () => {
    expect(themeMascotFor(THEME_MASCOT, 'oops')).toEqual({
      mode: 'clips',
      states: [THEME_MASCOT.states[1]],
    });
    expect(themeMascotFor(THEME_MASCOT, 'thinking')?.states).toEqual([]);
    expect(themeMascotFor(null, 'idle')).toBeNull();
  });
});

describe('mascotFilter', () => {
  const gold = style(builtinChoice('play'), { playLook: GOLD });

  it("Play's shell; sleeping adds the dim after it", () => {
    expect(mascotFilter(PLAY, 'idle')).toBe('none');
    expect(mascotFilter(PLAY, 'sleeping')).toBe(SLEEP_DIM);
    expect(mascotFilter(gold, 'idle')).toBe(SHELLS.gold.filter);
    expect(mascotFilter(gold, 'sleeping')).toBe(`${SHELLS.gold.filter} ${SLEEP_DIM}`);
  });

  it('HUD has no shell; it dims for sleep as Mascot.dc.html does', () => {
    const hud = style(builtinChoice('hud'));
    expect(mascotFilter(hud, 'idle')).toBe('none');
    expect(mascotFilter(hud, 'sleeping')).toBe(SLEEP_DIM);
    expect(SLEEP_DIM).toBe('brightness(.55) saturate(.6)');
  });
});

describe('what Skia draws', () => {
  const identity = cssFilterToColorMatrix('none');
  const matrix = cssFilterToColorMatrix(SLEEP_DIM);

  it('every kind but the plain clip, the still always with its matrix', () => {
    expect(skiaMedia({ kind: 'still', still: 1 })).toEqual({
      still: 1,
      matrix: identity,
      clip: null,
    });
    expect(skiaMedia({ kind: 'tinted-still', still: 1, matrix })).toEqual({
      still: 1,
      matrix,
      clip: null,
    });
    expect(skiaMedia({ kind: 'tinted-clip', clip: 2, still: 1, matrix })).toEqual({
      still: 1,
      matrix,
      clip: 2,
    });
  });

  it('playsClip: the two clip kinds', () => {
    expect(playsClip({ kind: 'clip', clip: 2, still: 1 })).toBe(true);
    expect(playsClip({ kind: 'tinted-clip', clip: 2, still: 1, matrix })).toBe(true);
    expect(playsClip({ kind: 'still', still: 1 })).toBe(false);
    expect(playsClip({ kind: 'none' })).toBe(false);
  });
});

describe("VoiceOver's name", () => {
  it.each(MASCOT_STATES)("%s: 'Auto, ' and the vendored caption", (state) => {
    expect(mascotLabel(state)).toBe(`Auto, ${captionFor(state)}`);
  });

  it('idle reads as the web says it', () => {
    expect(mascotLabel('idle')).toBe('Auto, Ready when you are');
  });
});
