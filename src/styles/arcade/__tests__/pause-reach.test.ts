// Arcade's pause control reaches every screen where Arcade loops (P001A-RVW-1, D-ARC-5, D-A11Y;
// WCAG 2.2.2), read from the product tree as the release audits read it (vitest runs in node with
// no React renderer, and these files load React Native). Every .tsx under src/styles and src/voice
// that mounts a moving Arcade part — Auto's sprite not held still, a live ▶ / ▼ cursor, the
// typewriter, or the voice core's sprite — is listed with the screen that shows it and the file on
// that screen that draws PauseButton; a moving file listed nowhere fails. The picker's Arcade card,
// which draws no control, moves nothing.

import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { codeOf } from '../../../release/__tests__/support/code';
import { isProductFile, walkFiles } from '../../../release/__tests__/support/tree';

/** What makes a file move Arcade: each loops on Arcade's clock while Arcade is not paused. */
const MOVING: readonly RegExp[] = [
  /<PixelSprite\b(?![^>]*\bstill\b)[^>]*>/,
  /\buseCursorOn\((?!false\))/,
  /\buseTypewriter\(/,
  /<CoreSprite\b/,
];

const HOME = 'src/styles/homes/ArcadeHome.tsx';
const STATUS_BAR = 'src/styles/arcade/parts/StatusBar.tsx';
const OPTIONS = 'src/styles/arcade/look-page/ArcadeLookPage.tsx';
const OPTIONS_WINDOW = 'src/styles/arcade/look-page/OptionsWindow.tsx';
const EDGE = 'src/styles/edges/ArcadeEdgeWindow.tsx';
const VOICE = 'src/voice/screen/VoiceScreen.tsx';
const HUD_CORE = 'src/styles/hud/core/HudCore.tsx';
const PICKER_CARD = 'src/styles/picker/previews/ArcadePreview.tsx';

/**
 * Where a moving file shows: `mountedBy`, the components from its screen down to it (the screen
 * first; none when the file is the screen), and `host`, the file on that screen that draws
 * PauseButton (the screen itself, or a component the screen renders).
 */
type Reach = { readonly host: string; readonly mountedBy: readonly string[] };

const REACH: Readonly<Record<string, Reach>> = Object.freeze({
  'src/styles/arcade/parts/DialogueWindow.tsx': { host: STATUS_BAR, mountedBy: [HOME] },
  'src/styles/arcade/home/QuestsView.tsx': { host: STATUS_BAR, mountedBy: [HOME] },
  'src/styles/arcade/home/InventoryView.tsx': { host: STATUS_BAR, mountedBy: [HOME] },
  [EDGE]: { host: EDGE, mountedBy: [] },
  'src/styles/arcade/look-page/OptionsPreview.tsx': { host: OPTIONS, mountedBy: [OPTIONS] },
  'src/styles/arcade/look-page/KnobRows.tsx': {
    host: OPTIONS,
    mountedBy: [OPTIONS, OPTIONS_WINDOW],
  },
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

describe("Arcade's pause control reaches every loop (WCAG 2.2.2)", () => {
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
    expect(codeOf(reach.host)).toMatch(/<PauseButton\b/);
    if (reach.host !== screen) {
      expect(codeOf(screen)).toMatch(renders(reach.host));
      expect(codeOf(screen)).not.toMatch(/pause=\{false\}/);
    }
  });
});

describe('where the control sits', () => {
  it("is on the home's status bar unless a caller turns it off", () => {
    expect(codeOf(STATUS_BAR)).toMatch(/pause = true/);
    expect(codeOf(STATUS_BAR)).toMatch(/pause \? <PauseButton\s*\/> : null/);
  });

  it('is on the voice screen in Arcade alone, in a slot the core draws under its top bar', () => {
    expect(codeOf(VOICE)).toMatch(
      /controls=\{model\.core\.sprite \? <PauseButton\s*\/> : undefined\}/,
    );
    expect(codeOf(HUD_CORE)).toMatch(/readonly controls\?: ReactNode;/);
    expect(codeOf(HUD_CORE)).toMatch(/<HudTopBar\b[\s\S]*?\/>\s*\{props\.controls \?/);
    expect(codeOf('src/styles/homes/HudHome.tsx')).not.toMatch(/controls=/);
  });

  it("is inside Options' StyleScope, so it reads the one stored pause", () => {
    const page = codeOf(OPTIONS);
    expect(page).toMatch(/function Heading\(\)[\s\S]*?<PauseButton\s*\/>[\s\S]*?\n\}/);
    expect(page).toMatch(/<StyleScope\b[\s\S]*<Heading\s*\/>[\s\S]*<\/StyleScope>/);
  });

  it("holds the picker's Arcade card still: no live cursor where no control sits", () => {
    const card = codeOf(PICKER_CARD);
    expect(card).not.toMatch(/\buseCursorOn\(/);
    expect(card).not.toMatch(/\buseArcadeMotion\(/);
    expect(card).toMatch(/<PixelSprite state="idle" still\s*\/>/);
    expect(card).toMatch(/<StatusBar counters=\{arcade\.counters\} pause=\{false\}\s*\/>/);
  });
});
