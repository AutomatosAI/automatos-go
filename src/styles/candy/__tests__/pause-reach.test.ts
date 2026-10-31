// Candy's pause control reaches every screen where Candy loops (US-023g, D-CAN-5, D-A11Y; WCAG
// 2.2.2), read from the product tree as the release audits read it (vitest runs in node with no
// React renderer, and these files load React Native), as Arcade's pause-reach test does. Every .tsx
// under src/styles and src/voice that mounts a moving Candy part — Auto not held still, the orb not
// held still, the writing dots, or the voice core's Candy Auto (a <CandyAuto in src/voice) — is
// listed with the screen that shows it and the file on that screen that draws CandyPauseButton; a
// moving file listed nowhere fails. US-023h listed the Chat view's, US-023i the Shelf's (Auto asleep
// on an empty shelf), US-023l the edge window's (its own) and the voice core's (Auto in the orb,
// the voice screen's); US-023m adds its own; the picker's Candy card moves nothing.

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
const CHAT_STAGE = 'src/styles/candy/home/ChatStage.tsx';
const CHAT_VIEW = 'src/styles/candy/home/ChatView.tsx';
const SHELF = 'src/styles/candy/home/ShelfView.tsx';
const EDGE = 'src/styles/edges/CandyEdgeWindow.tsx';
const VOICE = 'src/voice/screen/VoiceScreen.tsx';
const HUD_CORE = 'src/styles/hud/core/HudCore.tsx';

/**
 * Where a moving file shows: `mountedBy`, the components from its screen down to it (the screen
 * first; none when the file is the screen), and `host`, the file on that screen that draws
 * CandyPauseButton (the screen itself, or a component the screen renders).
 */
type Reach = { readonly host: string; readonly mountedBy: readonly string[] };

const REACH: Readonly<Record<string, Reach>> = Object.freeze({
  [TODAY]: { host: TODAY, mountedBy: [HOME] },
  // the Chat view: Auto on the stage, and the writing dots in the thread under it (US-023h)
  [CHAT_STAGE]: { host: CHAT_STAGE, mountedBy: [HOME] },
  [CHAT_VIEW]: { host: CHAT_STAGE, mountedBy: [HOME] },
  // the Shelf: Auto asleep on an empty shelf, the control in its header (US-023i)
  [SHELF]: { host: SHELF, mountedBy: [HOME] },
  // every edge screen's window: Auto on its band, the control at its top end (US-023l)
  [EDGE]: { host: EDGE, mountedBy: [] },
  // the voice screen: Auto in the orb, the control in the core's slot under its top bar (US-023l)
  [HUD_CORE]: { host: VOICE, mountedBy: [VOICE] },
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

  it("is on the Chat view's stage in its outline (it sits on the violet gradient), beside Auto", () => {
    const stage = codeOf(CHAT_STAGE);
    expect(stage).toMatch(/<CandyPauseButton variant="outline"\s*\/>/);
    expect(stage).toMatch(/<CandyAuto\b[\s\S]*<CandyPauseButton\b/);
    expect(codeOf(HOME)).toMatch(/<ChatStage\b[\s\S]*<ChatView\b/);
  });

  it("is in the Shelf's header, filled (it sits on the band), beside the menu circle", () => {
    const shelf = codeOf(SHELF);
    expect(shelf).toMatch(/function ShelfHeader\([\s\S]*?<CandyPauseButton\s*\/>[\s\S]*?\n\}/);
    expect(shelf).toMatch(/<ShelfHeader\b[\s\S]*<ShelfBody\b/);
  });

  it("is at the top end of every edge screen's window, filled (it sits on the band), over Auto", () => {
    const window = codeOf(EDGE);
    expect(window).toMatch(
      /<View style=\{styles\.pause\}>\s*<CandyPauseButton\s*\/>\s*<\/View>\s*<EdgeAuto\b/,
    );
    expect(window).toMatch(/<CandyAuto state=\{state\} size=\{candy\.auto\}\s*\/>/);
  });

  it("is on the voice screen in Candy alone, in the core's slot, never beside Arcade's", () => {
    const voice = codeOf(VOICE);
    expect(voice).toMatch(/controls=\{pauseControl\(model\.core\)\}/);
    expect(voice).toMatch(
      /if \(sprite\)\s*return <PauseButton\s*\/>;\s*return candy \? <CandyPauseButton\s*\/> : undefined;/,
    );
    expect(codeOf(HUD_CORE)).toMatch(/if \(voice\?\.candy\)\s*return <CandyCore\b/);
    expect(codeOf(HUD_CORE)).toMatch(/<Orb size=\{orb\.side\} room=\{orb\.side\}\s*\/>/);
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
