// HUD's core on a short phone, read from source (vitest runs in node with no React renderer, and
// these files load React Native): the transcript is a ScrollView that follows its end through
// transcriptAtEnd and opens a new turn at its end; the core, the chip with the voice's line and the
// transcript share one clipped middle, the core sized by coreSizeIn from what it measures, so the
// waveform and the buttons are never pushed off the screen. The pure parts are model.test.ts's.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const CORE = path.resolve(__dirname, '..');
/** The code alone: comments stripped. */
const code = (file: string) =>
  readFileSync(path.join(CORE, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('the transcript', () => {
  const transcript = code('Transcript.tsx');

  it('scrolls: a ScrollView, centred while it fits, with nothing clipped away', () => {
    expect(transcript).toMatch(/<ScrollView\b/);
    expect(transcript).toMatch(/content: \{ flexGrow: 1, justifyContent: 'center' \}/);
    expect(transcript).not.toMatch(/overflow: 'hidden'/);
    expect(transcript).not.toMatch(/transcriptAlign/);
  });

  it('scrolls to the end as words arrive, only while the person reads there', () => {
    expect(transcript).toMatch(/onContentSizeChange=\{follow\.toEnd\}/);
    expect(transcript).toMatch(/onLayout=\{follow\.toEnd\}/);
    expect(transcript).toMatch(/onScroll=\{follow\.onScroll\}/);
    expect(transcript).toMatch(/following\.current = transcriptAtEnd\(/);
    expect(transcript).toMatch(
      /if \(following\.current\) scroll\.current\?\.scrollToEnd\(\{ animated: false \}\);/,
    );
  });

  it('follows again when a new turn starts', () => {
    expect(transcript).toMatch(/const follow = useFollowEnd\(scroll, turn\.you\);/);
    expect(transcript).toMatch(/following\.current = true;\s*\}, \[turnKey\]\);/);
  });
});

describe('the column', () => {
  const hudCore = code('HudCore.tsx');

  it('puts the core, the chip, the line and the transcript in one clipped middle', () => {
    expect(hudCore).toMatch(/middle: \{ flex: 1, overflow: 'hidden' \}/);
    expect(hudCore).toMatch(
      /<View style=\{styles\.middle\} onLayout=\{core\.onMiddleLayout\}>\s*<Core size=\{core\.size\}[\s\S]*?<Transcript turn=\{turn\} \/>\s*<\/View>\s*<View style=\{\{ paddingHorizontal: HUD_CORE\.wave\.padX \}\}>/,
    );
  });

  it('measures the chip with the voice’s line, and sizes the core from the room left', () => {
    expect(hudCore).toMatch(
      /<View onLayout=\{core\.onWordsLayout\}>[\s\S]*?<StateChip[\s\S]*?\{parts\.line\}\s*<\/View>/,
    );
    expect(hudCore).toMatch(
      /middle && words \? coreSizeIn\(middle\.height - words\.height, height\) : coreSizeFor\(height\)/,
    );
  });
});
