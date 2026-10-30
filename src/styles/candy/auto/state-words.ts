// Auto's state as Candy's state pill says it (PRD-001 §4.6.2, D-A11Y, KA3-VENDOR-PIN): always a
// glyph and a word, never colour alone ('● Listening'). Pure: no React, React Native, Expo or Skia.
//
// Source: AutomatosAI/automatos-design-kit themes/candy/src/art/state-words.ts at 3920359d5
// (3920359d5350960471aca1b7111f6243be537cc0), sha256
// e10b5863a292fa5638a932a8a4d96d60405b0c27647c57cdec0c320baab7c4df. Copied; only the import
// (MascotName from the app's frozen mascot types) and the layout (semicolons) are the repo's.

import type { MascotName } from '../../../core/frozen/lib/mascot/types';

/**
 * Auto's state as Candy's state pill says it: always a glyph and a word, never colour alone ("● Listening"). A
 * screen reader hears the word alone (the glyph is decoration); the live caption, the longer "what he is doing",
 * is @automatos/mascot's captionFor. Pure.
 */

const WORDS: Readonly<Record<MascotName, string>> = {
  hello: 'Hello',
  idle: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  working: 'Working',
  searching: 'Searching',
  reading: 'Reading',
  celebrate: 'Done',
  oops: 'Oops',
  sleeping: 'Asleep',
  lost: 'Lost',
  loading: 'Loading',
};

/** The pill's glyph: a filled dot while he is on it, a ring at rest, a tick when done, a cross when it went wrong. */
const GLYPHS: Readonly<Record<MascotName, string>> = {
  hello: '●',
  idle: '○',
  listening: '●',
  thinking: '●',
  working: '●',
  searching: '●',
  reading: '●',
  celebrate: '✓',
  oops: '✕',
  sleeping: '○',
  lost: '○',
  loading: '●',
};

export function stateWord(state: MascotName): string {
  return WORDS[state];
}

export function stateGlyph(state: MascotName): string {
  return GLYPHS[state];
}
