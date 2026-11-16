// What VoiceOver is told (rule 10; vitest runs no React Native renderer, so the decision is pure and
// the hook's wiring is read from its source): on iOS, once each time a region's words appear or
// change, never again while the same words stay, never a blank line; on Android never, because its
// live region speaks. An occasion makes the same words new; a status line's first words are read
// in order, not announced.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  NOTHING_HEARD,
  announceStep,
  sentences,
  type AnnounceInput,
  type Heard,
} from '../announce-model';

const WORDS = "Couldn't refresh, so this may be out of date.";
const OTHER = 'Checked just now.';
const HOOK = readFileSync(path.resolve(__dirname, '../use-announce.ts'), 'utf8');

const input = (change: Partial<AnnounceInput> = {}): AnnounceInput => ({
  platform: 'ios',
  words: WORDS,
  showing: true,
  quietAtFirst: false,
  ...change,
});

/** Runs the hook's steps in order, as its effect does, and returns what each said. */
function run(steps: readonly Partial<AnnounceInput>[], start: Heard = NOTHING_HEARD) {
  const said: (string | null)[] = [];
  steps.reduce((heard, step) => {
    const next = announceStep(input(step), heard);
    said.push(next.say);
    return next.heard;
  }, start);
  return said;
}

describe('on an iPhone', () => {
  it('says the words when they appear', () => {
    expect(run([{}])).toEqual([WORDS]);
  });

  it('says them once while they stay: a run with the same words says nothing', () => {
    expect(run([{}, {}, {}])).toEqual([WORDS, null, null]);
  });

  it('says them again when they change, and when they come back after going', () => {
    expect(run([{}, { words: OTHER }])).toEqual([WORDS, OTHER]);
    expect(run([{}, { showing: false }, {}])).toEqual([WORDS, null, WORDS]);
    expect(run([{}, { words: null }, {}])).toEqual([WORDS, null, WORDS]);
  });

  it('never says a blank line, or words that are not showing', () => {
    expect(run([{ words: '  ' }, { words: undefined }, { showing: false }])).toEqual([
      null,
      null,
      null,
    ]);
    expect(run([{ words: '  ' }, {}])).toEqual([null, WORDS]);
  });

  it('tells each occasion once, even with the same words', () => {
    const first = { id: 1 };
    const second = { id: 2 };
    expect(run([{ occasion: first }, { occasion: first }, { occasion: second }])).toEqual([
      WORDS,
      null,
      WORDS,
    ]);
  });

  it('keeps an occasion told across a gap: the same one coming back is not said again', () => {
    expect(run([{ occasion: 'a' }, { showing: false, occasion: 'a' }, { occasion: 'a' }])).toEqual([
      WORDS,
      null,
      null,
    ]);
    expect(
      run([
        { occasion: 'a', words: WORDS },
        { occasion: 'a', words: OTHER },
      ]),
    ).toEqual([WORDS, null]);
  });

  it('leaves a status line’s first words to VoiceOver, and says a later change', () => {
    expect(run([{ quietAtFirst: true }, {}, { words: OTHER }])).toEqual([null, null, OTHER]);
    expect(run([{ quietAtFirst: true, showing: false }, {}])).toEqual([null, WORDS]);
    expect(run([{ quietAtFirst: true, occasion: 'held' }, { occasion: 'new' }])).toEqual([
      null,
      WORDS,
    ]);
  });
});

describe('everywhere else', () => {
  it.each(['android', 'web', 'windows', 'macos'] as const)(
    'says nothing on %s: its live region, if any, speaks',
    (platform) => {
      expect(run([{ platform }, { platform, words: OTHER }, { platform, occasion: 1 }])).toEqual([
        null,
        null,
        null,
      ]);
    },
  );

  it('still keeps what was on screen, so moving between platforms cannot repeat a line', () => {
    const android = announceStep(input({ platform: 'android' }), NOTHING_HEARD);
    expect(android.heard).toEqual({ shown: WORDS, told: undefined });
  });
});

describe('sentences', () => {
  it('joins parts as sentences, a full stop added where one does not end', () => {
    expect(sentences('Something went wrong', "Couldn't reach the server.")).toBe(
      "Something went wrong. Couldn't reach the server.",
    );
    expect(sentences('Done!', 'Next?', 'Checking…')).toBe('Done! Next? Checking…');
    expect(sentences('  ', null, undefined, 'One')).toBe('One.');
    expect(sentences()).toBe('');
  });
});

describe('the hook', () => {
  it('runs the decision with Platform.OS after a change, and announces only what it says', () => {
    expect(HOOK).toContain('{ platform: Platform.OS, words, showing, occasion, quietAtFirst }');
    expect(HOOK).toContain(
      'if (step.say !== null) AccessibilityInfo.announceForAccessibility(step.say);',
    );
    expect(HOOK).toContain('}, [words, showing, occasion, changesOnly]);');
  });

  it('keeps what it heard between renders, and is quiet at first only for a status line', () => {
    expect(HOOK).toContain('const heard = useRef<Heard>(NOTHING_HEARD);');
    expect(HOOK).toContain('const quietAtFirst = first.current && changesOnly;');
    expect(HOOK).toContain('heard.current = step.heard;');
  });
});
