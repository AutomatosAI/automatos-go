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

  it('gives a message box no home-indicator inset over the keyboard: it pads through useKeyboardSafeBottom', () => {
    expect(hook).toMatch(
      /return sheetBottomPadding\(own, insets\.bottom, useKeyboardHeight\(\)\);/,
    );
    const boxes = sources.filter(({ text }) => /<TextInput\b/.test(text));
    expect(boxes.length).toBeGreaterThan(0);
    const rawInset = boxes
      .filter(({ text }) => /insets\.bottom|useSafeAreaInsets\(/.test(text))
      .map(({ file }) => file);
    expect(rawInset).toEqual([]);
    const candy = sources.find(({ file }) => file.endsWith('CandyComposer.tsx'));
    expect(candy?.text).toMatch(/useKeyboardSafeBottom\(COMPOSER\.bottom\)/);
  });

  it('lifts every scroll view that leans on iOS’s keyboard inset over the keyboard on Android (#50)', () => {
    // every use of the prop, as JSX shorthand or ={true}, comments and the false form aside
    const uses = (text: string) =>
      text
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*)/.test(line))
        .join('\n')
        .match(/\bautomaticallyAdjustKeyboardInsets\b(?!=\{false\})/g)?.length ?? 0;
    const insetOnly = sources.filter(({ text }) => uses(text) > 0);
    expect(insetOnly.map(({ file }) => file).sort()).toEqual([
      'src/auth/screens/SignInScreen.tsx',
      'src/cc/questions/QuestionsTab.tsx',
      'src/connect/screens/ConnectScreen.tsx',
    ]);
    // a lift for each such scroll view in the file, not one for the file
    const unlifted = insetOnly
      .filter(({ text }) => (text.match(/<KeyboardLift>/g)?.length ?? 0) < uses(text))
      .map(({ file }) => file);
    expect(unlifted).toEqual([]);
  });
});

describe('KeyboardLift', () => {
  const lift = read('KeyboardLift.tsx');

  it('pads only on Android, by what the keyboard covers of it on screen', () => {
    expect(lift).toMatch(/const ANDROID = Platform\.OS === 'android';/);
    expect(lift).toMatch(/if \(!ANDROID\) return undefined;/);
    expect(lift).toMatch(/Keyboard\.addListener\('keyboardDidHide', \(\) => setLift\(0\)\)/);
  });

  it('measures from the screen’s top, as the keyboard’s screenY does: measure()’s pageY', () => {
    // measureInWindow's y counts from under the status bar on Android (found on the emulator)
    expect(lift).not.toMatch(/measureInWindow\(|StatusBar/);
    expect(lift).toMatch(/setLift\(keyboardOverlap\(pageY \+ height, keyboardTop\)\)/);
  });

  it('reads a keyboard already up at mount, and again on each layout while it is up', () => {
    expect(lift).toMatch(
      /Keyboard\.isVisible\(\) \? \(Keyboard\.metrics\(\)\?\.screenY \?\? null\) : null/,
    );
    expect(lift).toMatch(/if \(!ANDROID\) return undefined;\n\s+measure\(keyboardTopNow\(\)\);/);
    expect(lift).toMatch(/if \(ANDROID\) measure\(keyboardTopNow\(\)\);/);
    expect(lift).toMatch(/<View ref=\{view\} onLayout=\{onLayout\}/);
  });

  it('lets go of both listeners', () => {
    expect(lift).toMatch(/shown\.remove\(\);\s+hidden\.remove\(\);/);
  });
});
