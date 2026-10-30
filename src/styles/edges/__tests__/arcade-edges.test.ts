// Arcade's edge screens and voice core, read from source (US-022i; vitest runs in node with no
// React renderer, and these files load React Native): each edge screen sits in an Arcade window
// with Auto's sprite at its head in its own state (First open hello, Not running sleeping,
// Something went wrong oops, Lost lost) and the state in words; the voice core puts the sprite on
// a disc filled with the window, in place of the Mascot, and its loops stop on Arcade's pause.
// The pure parts are edges.test.ts's, paint.test.ts's and the voice suites'.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const STYLES = path.resolve(__dirname, '../..');
/** The code alone: comments stripped. */
const code = (file: string) =>
  readFileSync(path.join(STYLES, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe("Arcade's edge window", () => {
  const window = code('edges/ArcadeEdgeWindow.tsx');

  it('is an ArcadeWindow with the sprite and its state word at its head', () => {
    expect(window).toMatch(/<ArcadeWindow\b[\s\S]*?<EdgeSprite state=\{state\} \/>/);
    expect(window).toMatch(/<PixelSprite state=\{state\} \/>/);
    expect(window).toMatch(/portraitWords\(state\)/);
    expect(window).toMatch(/accessibilityLabel=\{words\.label\}/);
  });
});

describe('each edge screen in Arcade', () => {
  it.each([
    ['First open', 'edges/FirstOpen.tsx', /<ArcadeEdgeWindow state="hello"/],
    ['Not running', 'edges/NotRunning.tsx', /auto="sleeping"/],
    ['Something went wrong', 'edges/SomethingWrong.tsx', /<ArcadeEdgeWindow state="oops"/],
    ['Lost', 'edges/Lost.tsx', /<ArcadeEdgeWindow state="lost"/],
  ])('%s shows Auto in its own state', (_, file, state) => {
    expect(code(file)).toMatch(state);
  });

  it("puts Not running's words in the window tabbed with its line", () => {
    expect(code('edges/parts.tsx')).toMatch(
      /layout === 'arcade'\) \{\s*return \(\s*<ArcadeEdgeWindow state=\{auto\} title=\{line\} titleLabel=\{label\}>/,
    );
  });

  it("brands the line with Arcade's own words and greets with its own", () => {
    expect(code('edges/parts.tsx')).toMatch(/const words = brandWords\(style\.layout\);/);
    expect(code('edges/FirstOpen.tsx')).toMatch(/\{EDGE_COPY\.arcade\.greeting\}/);
    expect(code('edges/Lost.tsx')).toMatch(/<LostWords words=\{lostEdge\(layout\)\} \/>/);
  });
});

describe("the voice core's Auto in Arcade", () => {
  const hudCore = code('hud/core/HudCore.tsx');

  it('draws the sprite on the filled disc in place of the Mascot', () => {
    expect(hudCore).toMatch(
      /if \(voice\?\.sprite\) return <CoreSprite size=\{size\} state=\{stateOf\(mascotState\)\} \/>;/,
    );
    expect(hudCore).toMatch(/<PixelSprite state=\{state\} view=\{place\.view\} \/>/);
    expect(hudCore).toMatch(/fill=\{voice\?\.coreFill\}/);
    expect(code('hud/core/RingCore.tsx')).toMatch(/r=\{specs\.pulse\.radius\} color=\{fill\}/);
  });

  it("stills the rings, the waveform and the cursor on Arcade's pause", () => {
    expect(code('hud/core/use-voice-core.ts')).toMatch(
      /const loops = style\.layout === 'arcade' \? moving : style\.motion\.loops;/,
    );
    for (const file of ['hud/core/RingCore.tsx', 'hud/core/WaveformView.tsx']) {
      expect(code(file)).toMatch(/const \{ loops \} = useVoiceCore\(\);/);
      expect(code(file)).not.toMatch(/motion\.loops/);
    }
  });
});
