// The words a push carries for a question, made on the phone from its markdown the way the server
// makes them (inbound/question-text.ts). The expected words were produced by running the
// server's own rendering over these inputs: a plain question, spaces, emphasis, bold, struck and
// inline code, links and pictures, headings, quotes and bullets, a code fence, blank lines and
// CRLF, words with underscores and marks inside them, Unicode letters, the cut at 500 characters
// and at the end of what is read, and the server's own whitespace at the edges.

import { describe, expect, it } from 'vitest';

import { PUSH_ELLIPSIS } from '../config';
import { sameWords } from '../inbound/confirm-sender';
import { questionWords } from '../inbound/question-text';

const AS_THE_SERVER_RENDERS: readonly (readonly [string, string])[] = [
  ['Ship the Lisbon deck?', 'Ship the Lisbon deck?'],
  ['  Ship   the\tLisbon deck?  ', 'Ship the Lisbon deck?'],
  ['**Ship** the _Lisbon_ deck?', 'Ship the Lisbon deck?'],
  ['Use snake_case and __init__ here', 'Use snake_case and __init__ here'],
  ['Is a > b? Pick - or +', 'Is a > b? Pick - or +'],
  [
    '# Heading\n> quote line\n- item one\n* item two\n+ item three',
    'Heading\nquote line\nitem one\nitem two\nitem three',
  ],
  ['See [the plan](https://example.test/a_(b)) and ![chart](x.png)', 'See the plan and chart'],
  ['Run `npm test` then ~~ship~~ it', 'Run npm test then ship it'],
  ["```python\nprint('hi')\n```\nDone?", "print('hi')\n\nDone?"],
  ['Line one\n\n\n\nLine two\r\nLine three', 'Line one\n\nLine two\nLine three'],
  ['*a* *b* and *not closed', 'a b and *not closed'],
  [
    '\u00dcn\u00efc\u00f6d\u00e9 _w\u00f6rd_ and na\u00efve_snake',
    '\u00dcn\u00efc\u00f6d\u00e9 w\u00f6rd and na\u00efve_snake',
  ],
  ['x'.repeat(600), 'x'.repeat(499) + PUSH_ELLIPSIS],
  ['word '.repeat(120), 'word '.repeat(99) + 'word' + PUSH_ELLIPSIS],
  ['Short' + ' '.repeat(10) + '\n' + 'y'.repeat(4100), 'Short\n' + 'y'.repeat(493) + PUSH_ELLIPSIS],
  ['\u0085Python spaces\u001f', 'Python spaces'],
  ['\ufeffBOM kept', '\ufeffBOM kept'],
  ['Tabs\t\tand\u00a0nbsp', 'Tabs and\u00a0nbsp'],
  ['**bold with *italic* inside**', 'bold with italic inside'],
  ['_a_b_ and *x*y*', '_a_b_ and *x*y*'],
  ['Approve the payment?', 'Approve the payment?'],
];

describe("questionWords: as the server makes a push's words", () => {
  it.each(AS_THE_SERVER_RENDERS)('%j', (markdown, words) => {
    expect(questionWords(markdown)).toBe(words);
  });

  it('nothing left is none', () => {
    expect(questionWords('   \n\n ')).toBeNull();
    expect(questionWords('```\n```')).toBeNull();
  });
});

describe('sameWords: as written first, then as the server renders, never looser', () => {
  it('as written, or as rendered from the markdown', () => {
    expect(sameWords('Ship the Lisbon deck?', 'Ship the Lisbon deck?')).toBe(true);
    expect(
      sameWords('**Ship** the [Lisbon](https://example.test) deck?', 'Ship the Lisbon deck?'),
    ).toBe(true);
  });

  it('a character inside a word, or a mark the rendering keeps, is never dropped', () => {
    expect(sameWords('Use snake_case', 'Use snakecase')).toBe(false);
    expect(sameWords('Is a > b?', 'Is a b?')).toBe(false);
    expect(sameWords('Pick - or +', 'Pick or')).toBe(false);
    expect(sameWords('Ship the Lisbon deck?', 'Ship the Lisbon deck')).toBe(false);
  });

  it('no signed words match nothing', () => {
    expect(sameWords('', '')).toBe(false);
  });
});
