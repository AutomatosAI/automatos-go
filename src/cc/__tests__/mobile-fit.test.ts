// The Command Centre on a 375 x 667 phone, read from source (vitest runs in node with no React
// renderer, and these files load React Native): the Questions list keeps the own-words field above
// the keyboard, and a tap on Answer with the keyboard up still answers.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '..', '..');
/** The code alone: comments stripped. */
const code = (file: string) =>
  readFileSync(path.resolve(SRC, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('the Questions tab and the keyboard', () => {
  const tab = code('cc/questions/QuestionsTab.tsx');

  it('adjusts its insets for the keyboard, as the sign-in screen does', () => {
    expect(tab).toMatch(/<FlatList[\s\S]*?\bautomaticallyAdjustKeyboardInsets\b[\s\S]*?\/>/);
    expect(code('auth/screens/SignInScreen.tsx')).toMatch(/automaticallyAdjustKeyboardInsets/);
  });

  it('lets a tap on Answer through while the keyboard is up', () => {
    expect(tab).toMatch(/keyboardShouldPersistTaps="handled"/);
  });
});
