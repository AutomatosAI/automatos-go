// The Sheet with the keyboard up, read from source (vitest runs in node with no React renderer, and
// the Sheet loads React Native): its tallest and its bottom padding follow the keyboard's height
// (useKeyboardHeight: iOS's will-show / will-hide, Android's did-show / did-hide), through overlay.ts's sheetMaxHeight and
// sheetBottomPadding, which overlay.test.ts proves.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const UI = path.resolve(__dirname, '..');
const read = (file: string) => readFileSync(path.join(UI, file), 'utf8');

describe('the Sheet and the keyboard', () => {
  const sheet = read('Sheet.tsx');

  it('moves itself for the keyboard on both platforms: Android’s edge-to-edge window does not resize', () => {
    expect(sheet).toMatch(/behavior=\{KEYBOARD_AVOIDING_BEHAVIOUR\}/);
  });

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

  it('follows iOS’s will-show and will-hide, Android’s did-show and did-hide, and lets go of both', () => {
    expect(hook).toMatch(
      /const SHOW = Platform\.OS === 'ios' \? 'keyboardWillShow' : 'keyboardDidShow';/,
    );
    expect(hook).toMatch(
      /const HIDE = Platform\.OS === 'ios' \? 'keyboardWillHide' : 'keyboardDidHide';/,
    );
    expect(hook).toMatch(
      /Keyboard\.addListener\(SHOW, \(event\) => setHeight\(event\.endCoordinates\.height\)\)/,
    );
    expect(hook).toMatch(/Keyboard\.addListener\(HIDE, \(\) => setHeight\(0\)\)/);
    expect(hook).toMatch(/shown\.remove\(\);\s*hidden\.remove\(\);/);
  });

  it('starts from the keyboard already up at mount', () => {
    expect(hook).toMatch(
      /Keyboard\.isVisible\(\) \? \(Keyboard\.metrics\(\)\?\.height \?\? 0\) : 0/,
    );
  });
});

describe('KeyboardAvoidingView on Android', () => {
  const hook = read('use-keyboard-height.ts');
  const repo = path.resolve(UI, '../..');
  const sources = ['src', 'app']
    .flatMap((root) =>
      readdirSync(path.join(repo, root), { recursive: true, encoding: 'utf8' })
        .filter((file) => file.endsWith('.tsx') && !file.includes('__tests__'))
        .map((file) => path.join(root, file)),
    )
    .map((file) => ({ file, text: readFileSync(path.join(repo, file), 'utf8') }));

  it('pads on both platforms, from the one constant', () => {
    expect(hook).toMatch(/export const KEYBOARD_AVOIDING_BEHAVIOUR = 'padding';/);
  });

  it('has no KeyboardAvoidingView that moves on iOS only', () => {
    const iosOnly = sources
      .filter(({ text }) => /Platform\.OS === 'ios' \? 'padding' : undefined/.test(text))
      .map(({ file }) => file);
    expect(iosOnly).toEqual([]);
  });

  it('gives every KeyboardAvoidingView the shared behaviour', () => {
    const views = sources.flatMap(({ file, text }) =>
      (text.match(/<KeyboardAvoidingView\b[^>]*>/g) ?? []).map((tag) => ({ file, tag })),
    );
    expect(views.length).toBeGreaterThan(0);
    const others = views
      .filter(({ tag }) => !tag.includes('behavior={KEYBOARD_AVOIDING_BEHAVIOUR}'))
      .map(({ file }) => file);
    expect(others).toEqual([]);
  });
});
