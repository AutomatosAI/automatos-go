// Candy's edge screens and voice core (US-023l, D-ONE-VOICE, D-CAN-5; CANDY-LAYOUT §7, the kit's
// edges/asleep.tsx and not-found.tsx at 3920359d5). The pure parts: Candy's wordmark, greeting and
// 404 lines, the window's numbers and Check again's button. Read from source (vitest runs in node
// with no React renderer, and these files load React Native): each edge screen sits in Candy's
// window — the band across its top, Auto at 140 in the screen's own state (First open hello, Not
// running sleeping, Something went wrong oops, Lost lost) with his state word, the r corners and
// the pause control — and the voice core puts Candy's Auto inside Candy's orb, strokes the rings
// and the waveform in the card sets' gradient, and stills them on Candy's motion.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CANDY_EDGE_COPY } from '../../candy/strings';
import { EDGE_COPY } from '../../strings';
import { LOST_EDGE, brandWords, lostEdge } from '../edges';
import { EDGE_METRICS, checkAgainVariant } from '../metrics';

const STYLES = path.resolve(__dirname, '../..');
/** The code alone: comments stripped. */
const code = (file: string) =>
  readFileSync(path.join(STYLES, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe("Candy's edge words (candy/strings.ts)", () => {
  it("brands the line 'Automatos Candy', never Play's or Arcade's words", () => {
    const candy = brandWords('candy');
    expect(candy).toEqual({ name: 'Automatos', mark: 'Candy', label: 'Automatos Candy' });
    expect(candy).toBe(CANDY_EDGE_COPY.brand);
    expect(candy).not.toEqual(EDGE_COPY.brand.play);
    expect(candy).not.toEqual(EDGE_COPY.brand.arcade);
  });

  it("greets with Auto's hello and the kit's empty-thread line (chat/thread.tsx EMPTY_THREAD)", () => {
    expect(CANDY_EDGE_COPY.greeting).toEqual({
      title: "Hi, I'm Auto",
      line: 'Tell Auto what you need: a post, a report, a plan. He takes it from there.',
    });
  });

  it("says the kit's 404 lines (edges/not-found.tsx), with the shared number and way back", () => {
    expect(lostEdge('candy')).toEqual({
      number: LOST_EDGE.number,
      title: "This page isn't here",
      message: 'The link may be old, or the page may have moved. Let’s get you back.',
      back: LOST_EDGE.back,
    });
    expect(Object.isFrozen(lostEdge('candy'))).toBe(true);
    expect(lostEdge('studio')).toBe(LOST_EDGE);
  });

  it('draws Check again as the primary: the accent pill Candy dresses at 50', () => {
    expect(checkAgainVariant('candy')).toBe('primary');
  });

  it("lays the window out with the asleep window's band and Auto at 140", () => {
    expect(EDGE_METRICS.candy).toEqual({
      band: 150,
      auto: 140,
      pad: 20,
      gap: 18,
      wordGap: 6,
      brandGap: 8,
    });
  });
});

describe("Candy's edge window", () => {
  const window = code('edges/CandyEdgeWindow.tsx');

  it('is a win window with the r corners (nearestRadius) on the tinted shadow, clipped', () => {
    expect(window).toMatch(/const corners = \{ borderRadius: nearestRadius\(look\.roundness\) \};/);
    expect(window).toMatch(/styles\.window, corners, \{ backgroundColor: vars\.win \}, shadow\]/);
    expect(window).toMatch(/clip: \{ overflow: 'hidden' \}/);
  });

  it('puts the band alone across its top, Auto at 140 on it and his state word under him', () => {
    expect(window).toMatch(
      /<Band height=\{candy\.band\} curve=\{BAND_CURVE\.max\} page=\{false\} \/>/,
    );
    expect(window).toMatch(/<CandyAuto state=\{state\} size=\{candy\.auto\} \/>/);
    expect(window).toMatch(
      /statePill\(\{ glyph: stateGlyph\(state\), word: stateWord\(state\) \}\)/,
    );
    expect(window).toMatch(/accessibilityLabel=\{pill\.label\}/);
    expect(window).toMatch(/color: vars\.quiet/);
  });

  it('draws the pause control, filled, at its top end', () => {
    expect(window).toMatch(/<View style=\{styles\.pause\}>\s*<CandyPauseButton \/>/);
    expect(window).toMatch(/pause: \{ alignSelf: 'flex-end' \}/);
  });
});

describe('each edge screen in Candy', () => {
  it.each([
    ['First open', 'edges/FirstOpen.tsx', /<CandyEdgeWindow state="hello" centred>/],
    ['Not running', 'edges/parts.tsx', /<CandyEdgeWindow state=\{auto\}>/],
    ['Something went wrong', 'edges/SomethingWrong.tsx', /<CandyEdgeWindow state="oops">/],
    ['Lost', 'edges/Lost.tsx', /<CandyEdgeWindow state="lost" centred>/],
  ])('%s shows Auto in its own state in the window', (_, file, state) => {
    expect(code(file)).toMatch(state);
  });

  it("reaches Not running's window through EdgePanel's candy branch, Auto asleep", () => {
    expect(code('edges/parts.tsx')).toMatch(
      /if \(style\.layout === 'candy'\) return <CandyEdgeWindow state=\{auto\}>\{children\}<\/CandyEdgeWindow>;/,
    );
    expect(code('edges/NotRunning.tsx')).toMatch(/auto="sleeping"/);
  });

  it("greets with Candy's own words and stands the '404' alone on the page", () => {
    const firstOpen = code('edges/FirstOpen.tsx');
    expect(firstOpen).toMatch(/if \(layout === 'candy'\) return <CandyHello \/>;/);
    expect(firstOpen).toMatch(/\{greeting\.title\}/);
    expect(firstOpen).toMatch(/\{greeting\.line\}/);
    expect(code('edges/Lost.tsx')).toMatch(/new Set<Layout>\(\['arcade', 'candy'\]\)/);
  });

  it("sets the status word in Candy's label face, wrapping beside the brand", () => {
    const parts = code('edges/parts.tsx');
    expect(parts).toMatch(
      /const ownLabels = style\.layout === 'arcade' \|\| style\.layout === 'candy';/,
    );
    expect(parts).toMatch(
      /ownLabels \? style\.type\.label : style\.type\.mono\(brand\.statusSize\)/,
    );
  });
});

describe("the voice core's Auto in Candy", () => {
  const hudCore = code('hud/core/HudCore.tsx');

  it("draws Candy's orb with Candy's Auto in it, in place of the Mascot", () => {
    expect(hudCore).toMatch(
      /if \(voice\?\.candy\) return <CandyCore size=\{size\} state=\{stateOf\(mascotState\)\} \/>;/,
    );
    expect(hudCore).toMatch(/candyCorePlace\(size\)/);
    expect(hudCore).toMatch(/<Orb size=\{orb\.side\} room=\{orb\.side\} \/>/);
    expect(hudCore).toMatch(/<CandyAuto state=\{state\} size=\{auto\.side\} \/>/);
  });

  it("strokes the rings and the waveform in the dress's gradient", () => {
    expect(hudCore).toMatch(/<RingCore[\s\S]*?gradient=\{voice\?\.gradient\}[\s\S]*?\/>/);
    expect(hudCore).toMatch(
      /<Waveform colour=\{paint\.accent\} levels=\{levels\} gradient=\{voice\?\.gradient\} \/>/,
    );
    const rings = code('hud/core/RingCore.tsx');
    expect(rings).toMatch(
      /<SweepGradient c=\{vec\(centre, centre\)\} colors=\{\[\.\.\.sweep\]\} \/>/,
    );
    expect(rings).toMatch(/\[\.\.\.gradient, first\]/);
    expect(code('hud/core/WaveformView.tsx')).toMatch(
      /colour=\{run\?\.\[bar\.index\] \?\? colour\}/,
    );
  });

  it("stills the rings and the waveform on Candy's motion", () => {
    expect(code('hud/core/use-voice-core.ts')).toMatch(
      /const own = style\.layout === 'candy' \? candy\.moving : style\.motion\.loops;/,
    );
  });

  it('keeps the bare orb hidden from VoiceOver, its words only where they are given', () => {
    const orb = code('candy/parts/Orb.tsx');
    expect(orb).toMatch(
      /if \(figure === undefined \|\| caption === undefined\) \{\s*return \(\s*<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/,
    );
    expect(orb).toMatch(/<OrbWords figure=\{figure\} caption=\{caption\} side=\{side\} \/>/);
  });
});
