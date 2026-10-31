// Candy's pause control reaches every screen where Candy loops (US-023g, D-CAN-5, D-A11Y; WCAG
// 2.2.2), read from the product tree as the release audits read it (vitest runs in node with no
// React renderer, and these files load React Native), as Arcade's pause-reach test does. Every .tsx
// under src/styles and src/voice that mounts a moving Candy part — Auto not held still, the orb not
// held still, the writing dots, or the voice core's Candy Auto (a <CandyAuto in src/voice) — is
// listed with the screen that shows it and the file on that screen that draws CandyPauseButton; a
// moving file listed nowhere fails. US-023h, US-023l and US-023m add their entries; the picker's
// Candy card moves nothing.

import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { codeOf } from '../../../release/__tests__/support/code';
import { isProductFile, walkFiles } from '../../../release/__tests__/support/tree';

/** What makes a file move Candy: each loops on Candy's one clock while Candy is not paused. */
const MOVING: readonly RegExp[] = [
  /<CandyAuto\b(?![^>]*\bstill\b)[^>]*>/,
  /<Orb\b(?![^>]*\bstill\b)[^>]*>/,
  /<WritingChip\b/,
];

const HOME = 'src/styles/homes/CandyHome.tsx';
const TODAY = 'src/styles/candy/home/TodayView.tsx';

/**
 * Where a moving file shows: `mountedBy`, the components from its screen down to it (the screen
 * first; none when the file is the screen), and `host`, the file on that screen that draws
 * CandyPauseButton (the screen itself, or a component the screen renders).
 */
type Reach = { readonly host: string; readonly mountedBy: readonly string[] };

const REACH: Readonly<Record<string, Reach>> = Object.freeze({
  [TODAY]: { host: TODAY, mountedBy: [HOME] },
});

const componentOf = (file: string) => path.posix.basename(file, '.tsx');
const renders = (file: string) => new RegExp(`<${componentOf(file)}\\b`);

function movingFiles(): string[] {
  return [...walkFiles('src/styles'), ...walkFiles('src/voice')]
    .filter((file) => file.endsWith('.tsx') && isProductFile(file))
    .filter((file) => {
      const code = codeOf(file);
      return MOVING.some((pattern) => pattern.test(code));
    });
}

describe("Candy's pause control reaches every loop (WCAG 2.2.2)", () => {
  const moving = movingFiles();

  it('finds the moving parts it knows, and each is listed with its screen', () => {
    expect(moving.length).toBeGreaterThan(0);
    expect(moving.filter((file) => !(file in REACH))).toEqual([]);
    expect(Object.keys(REACH).filter((file) => !moving.includes(file))).toEqual([]);
  });

  it.each(Object.entries(REACH))('%s is mounted down from its screen', (file, reach) => {
    const chain = [...reach.mountedBy, file];
    chain.slice(1).forEach((child, index) => {
      expect(codeOf(chain[index] as string)).toMatch(renders(child));
    });
  });

  it.each(Object.entries(REACH))("%s's screen draws the pause control", (file, reach) => {
    const screen = reach.mountedBy[0] ?? file;
    expect(codeOf(reach.host)).toMatch(/<CandyPauseButton\b/);
    if (reach.host !== screen) {
      expect(codeOf(screen)).toMatch(renders(reach.host));
      expect(codeOf(screen)).not.toMatch(/pause=\{false\}/);
    }
  });
});

describe('where the control sits', () => {
  it("is in Today's header, filled (it sits on the band), beside Auto and the orb it stills", () => {
    const today = codeOf(TODAY);
    expect(today).toMatch(/function TodayHeader\([\s\S]*?<CandyPauseButton\s*\/>[\s\S]*?\n\}/);
    expect(today).toMatch(/function TodayHeader\([\s\S]*?<CandyAuto\b[\s\S]*?\n\}/);
    expect(today).toMatch(/<TodayHeader\b[\s\S]*<Orb\b/);
  });

  it('is never needed by a part that is held still, so the patterns skip `still`', () => {
    expect(MOVING.some((pattern) => pattern.test('<CandyAuto state="idle" size={56} still />'))).toBe(
      false,
    );
    expect(MOVING.some((pattern) => pattern.test('<Orb figure="3" caption="need you" still />'))).toBe(
      false,
    );
    expect(MOVING.some((pattern) => pattern.test('<CandyAuto state={state} size={56} />'))).toBe(true);
  });
});
