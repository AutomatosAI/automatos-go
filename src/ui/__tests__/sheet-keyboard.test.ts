// The Sheet with the keyboard up, read from source (vitest runs in node with no React renderer, and
// the Sheet loads React Native): its tallest and its bottom padding follow the keyboard's height
// (useKeyboardHeight, from iOS's will-show / will-hide), through overlay.ts's sheetMaxHeight and
// sheetBottomPadding, which overlay.test.ts proves.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const UI = path.resolve(__dirname, '..');
const read = (file: string) => readFileSync(path.join(UI, file), 'utf8');

describe('the Sheet and the keyboard', () => {
  const sheet = read('Sheet.tsx');

  it('caps its height at the room the keyboard leaves under the safe area’s top', () => {
    expect(sheet).toMatch(/const keyboard = useKeyboardHeight\(\);/);
    expect(sheet).toMatch(/maxHeight: sheetMaxHeight\(windowHeight, keyboard, insets\.top\),/);
    expect(sheet).not.toMatch(/windowHeight \* SHEET_MAX_HEIGHT_RATIO/);
  });

  it('drops the home indicator’s inset from its padding while the keyboard is up', () => {
    expect(sheet).toMatch(
      /paddingBottom: sheetBottomPadding\(spacing\.space7, insets\.bottom, keyboard\),/,
    );
    expect(sheet).not.toMatch(/spacing\.space7 \+ insets\.bottom/);
  });
});

describe('useKeyboardHeight', () => {
  const hook = read('use-keyboard-height.ts');

  it('follows iOS’s will-show and will-hide, and lets go of both', () => {
    expect(hook).toMatch(
      /Keyboard\.addListener\('keyboardWillShow', \(event\) =>\s*setHeight\(event\.endCoordinates\.height\)/,
    );
    expect(hook).toMatch(/Keyboard\.addListener\('keyboardWillHide', \(\) => setHeight\(0\)\)/);
    expect(hook).toMatch(/shown\.remove\(\);\s*hidden\.remove\(\);/);
  });

  it('starts from the keyboard already up at mount', () => {
    expect(hook).toMatch(
      /Keyboard\.isVisible\(\) \? \(Keyboard\.metrics\(\)\?\.height \?\? 0\) : 0/,
    );
  });
});
