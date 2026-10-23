// Auto's answer lexed as it streams (lex.ts): for every prefix of a range of answers, streamed a
// character at a time and in uneven chunks, and of seeded random markdown (fences that stop being
// fences, numbers that become list items, HTML, definitions), the blocks equal markdownBlocks of
// the whole prefix; settled blocks keep their objects frame after frame; and what marked carries
// across blocks (a link reference definition, an <a> tag) sends the lex back to the whole text.

import { describe, expect, it } from 'vitest';

import { MAX_MARKDOWN_CHARS, markdownBlocks, type ParagraphBlock } from '../blocks';
import { lexMarkdown, type MarkdownLex } from '../lex';

const ANSWERS: readonly string[] = [
  [
    '## Plan\n\n**Two** docs need you:\n\n',
    '| Doc | Owner |\n|---|:-:|\n| `plan.md` | Gerard |\n| Brief | Dave<br>Maya |\n\n',
    '1. Read [it](/deliverables?deliverable=7)\n   - then ~~wait~~ *reply*\n\n',
    '> done\n> - and a list\n\n```js\nx()\n\ny()\n```\n\nAfter the code.\n',
  ].join(''),
  'Here:\n| a | b |\n|---|---|\n| 1 | 2 |\nTitle\n===\n\npara\n    lazy\n\n    code\n\n- a\n- b\n\n  cont\n\n---\nend  \nline',
  '- [x] Created ticket #42\n- [ ] Email Maya\n\n\n- b\n\n\n\npara\n\n* x\n  * y\n    * z\n\n1) one\n2) two\n',
  'Two tickets are blocked.\nHere is what I found:\n- one\n- two\n\nNext steps:\n- three\n',
  'A\r\nB with Windows\r\n\r\n- lines\r\n',
  '<div>\nhtml\n</div>\n\nwords <b>x</b> and https://automatos.app\n\n    indented\n',
  'See [the doc][ref] and [Open](https://example.com).\n\n[ref]: https://example.com/a\n\nMore.',
  'Open <a href="x">this\n\nhttps://automatos.app stays words after an open a tag\n\nand more',
  // a fence that interrupts a paragraph until its info string holds a backtick; a number that
  // becomes the list's next item after a blank line
  'Words\n```**[x] |`\n\n1. one\n\n2. two\n\n10) ten\n\npara\n<br>__`<div>`\n|---|',
];

/** Pieces of markdown that change what came before them as they complete. */
const PIECES: readonly string[] = [
  '- ',
  '* ',
  '+ ',
  '1. ',
  '2) ',
  '10',
  '3.',
  '\n',
  '\n\n',
  '\n\n\n',
  '    ',
  '  ',
  '\t',
  '> ',
  '```',
  '~~~',
  '|',
  '| a | b |',
  '|---|---|',
  '---',
  '===',
  '-',
  '=',
  '# ',
  'word',
  'two words',
  '**',
  '_',
  '*',
  '[a](/x)',
  '[r]',
  '[r]: /y',
  '<br>',
  '[ ] ',
  '[x] ',
  'https://a.b',
  '<div>',
  '</div>',
  '<a href="x">',
  '</a>',
  '<pre>',
  '~~',
  '`',
  '`c`',
  '&amp;',
  '\\',
  '![i](https://x.y/z.png)',
  '<!-- c -->',
  ':',
  '1',
  ' ',
  '\r\n',
  'Title\n',
];

/** A seeded generator (the same answers every run). */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

/** Streams `answer` in steps of the given sizes (cycled), checking every frame against a whole lex. */
function stream(answer: string, steps: readonly number[]): MarkdownLex | null {
  let lex: MarkdownLex | null = null;
  let end = 0;
  let step = 0;
  while (end < answer.length) {
    end = Math.min(answer.length, end + steps[step % steps.length]);
    step += 1;
    const prefix = answer.slice(0, end);
    lex = lexMarkdown(prefix, lex);
    expect(lex.blocks, JSON.stringify(prefix)).toEqual(markdownBlocks(prefix));
  }
  return lex;
}

describe('lexMarkdown', () => {
  it('equals a whole lex at every character of every answer', () => {
    for (const answer of ANSWERS) stream(answer, [1]);
  });

  it('equals a whole lex when the answer arrives in uneven chunks', () => {
    for (const answer of ANSWERS) {
      stream(answer, [3, 17, 1, 40, 7]);
      stream(answer, [12]);
    }
  });

  it('equals a whole lex for seeded random markdown, streamed in random chunks', () => {
    const random = seeded(42);
    const pick = (count: number) => Math.floor(random() * count);
    for (let answer = 0; answer < 300; answer += 1) {
      const pieces = Array.from({ length: 10 + pick(40) }, () => PIECES[pick(PIECES.length)]);
      stream(pieces.join(''), [1 + pick(8), 1 + pick(8), 1 + pick(8)]);
    }
  });

  it('keeps settled blocks as the same objects while the answer grows', () => {
    const first = lexMarkdown('One.\n\nTwo.\n\nThr');
    const next = lexMarkdown('One.\n\nTwo.\n\nThree is here.', first);
    expect(next.blocks).toHaveLength(3);
    expect(next.blocks[0]).toBe(first.blocks[0]);
    expect(next.blocks[1]).toBe(first.blocks[1]);
    expect((next.blocks[2] as ParagraphBlock).spans).toEqual([
      { kind: 'text', text: 'Three is here.', marks: [], href: null },
    ]);
    expect(next.settled?.text).toBe('One.\n\nTwo.\n\n');
  });

  it('lexes the whole text when it is not the last text grown', () => {
    const first = lexMarkdown('# Old\n\nwords\n\nmore');
    const other = lexMarkdown('Fresh start', first);
    expect(other.blocks).toEqual(markdownBlocks('Fresh start'));
    expect(other.blocks[0]).not.toBe(first.blocks[0]);
  });

  it('lexes the whole text once a link reference definition appears, or an <a> tag settles', () => {
    const defined = lexMarkdown('See [doc].\n\n[doc]: https://example.com\n\nMore');
    expect(defined.settled).toBeNull();
    expect(defined.blocks).toEqual(
      markdownBlocks('See [doc].\n\n[doc]: https://example.com\n\nMore'),
    );
    const tagged = lexMarkdown('Open <a href="x">this\n\nnext\n\nmore');
    expect(tagged.settled).toBeNull();
    expect(lexMarkdown('Plain one.\n\nPlain two.').settled).not.toBeNull();
  });

  it('reads nothing as nothing, and an answer past the size cap as plain paragraphs', () => {
    expect(lexMarkdown('  \n ').blocks).toEqual([]);
    expect(lexMarkdown(undefined as unknown as string).blocks).toEqual([]);
    const long = `**${'a'.repeat(MAX_MARKDOWN_CHARS)}**\n\nlast`;
    expect(lexMarkdown(long, lexMarkdown('**a')).blocks).toEqual(markdownBlocks(long));
  });

  it('lexes only the last block of a long streamed answer each frame, not the whole answer', () => {
    const answer = Array.from(
      { length: 120 },
      (_, index) =>
        `### Part ${index}\n\nSome **bold** words and a [link](/agents?agent=${index}).\n\n` +
        `| A | B |\n|---|---|\n| ${index} | x |\n\n- one\n- two\n\n`,
    ).join('');
    const STEP = 12;
    let lex: MarkdownLex | null = null;
    let lexed = 0;
    let whole = 0;
    for (let end = STEP; end <= answer.length + STEP; end += STEP) {
      const prefix = answer.slice(0, end);
      lexed += prefix.length - (lex?.settled?.text.length ?? 0);
      whole += prefix.length;
      lex = lexMarkdown(prefix, lex);
    }
    // 13k characters in 12-character frames: lexing whole is ~7.4M characters, this is ~35k
    expect(lexed * 100).toBeLessThan(whole);
    expect(lex?.blocks).toEqual(markdownBlocks(answer));
  });
});
