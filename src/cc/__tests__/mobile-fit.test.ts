// The Command Centre on a 375 x 667 phone, read from source (vitest runs in node with no React
// renderer, and these files load React Native): the Questions list keeps the own-words field above
// the keyboard, and a tap on Answer with the keyboard up still answers; the filter pills' rows give
// their slop room to reach 44 pt; an always-on band line is 44 tall.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MIN_TOUCH, hitSlopFor } from '../../ui/paint';
import { PILL_HEIGHT } from '../../ui/variants';
import { ALWAYS_ON_BAND } from '../calendar/chrome';

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

describe('the filter pills (Board, Deliverables)', () => {
  it.each(['cc/board/FilterPills.tsx', 'cc/deliverables/TypePills.tsx'])(
    '%s pads its row to the pills’ 44 pt touch and takes the padding back',
    (file) => {
      const row = code(file);
      expect(row).toMatch(/const room = touchRoom\(useDress\(\)\.pill\.minHeight\);/);
      expect(row).toMatch(/style=\{\{ marginVertical: room\.marginVertical \}\}/);
      expect(row).toMatch(
        /contentContainerStyle=\{\{[\s\S]*?paddingVertical: room\.paddingVertical,/,
      );
    },
  );

  it('a 28 pt Studio pill and its slop fit the padded row exactly', () => {
    const slop = hitSlopFor(PILL_HEIGHT).top;
    expect(PILL_HEIGHT + 2 * slop).toBe(MIN_TOUCH);
  });
});

describe('the always-on band', () => {
  const day = code('cc/calendar/DayView.tsx');

  it('draws each line at least 44 tall, and the 24/7 mark as tall beside the first', () => {
    expect(ALWAYS_ON_BAND.lineMinHeight).toBe(MIN_TOUCH);
    expect(day).toMatch(
      /minHeight: ALWAYS_ON_BAND\.lineMinHeight,\s*opacity: pausedOpacity\(line\.paused\)/,
    );
    expect(day).toMatch(
      /<View style=\{\[styles\.mark, \{ minHeight: ALWAYS_ON_BAND\.lineMinHeight \}\]\}>\s*<Text/,
    );
  });
});
