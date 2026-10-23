// The GFM pieces models write that a plain reading loses (OT-C8 review, 23 Oct): a task item's box,
// ticked or not, kept on the item (ListView draws it as the marker), and '<br>', the only way to
// break a line inside a table cell, read as a line break while every other tag stays literal.

import { describe, expect, it } from 'vitest';

import { markdownBlocks, type ListBlock, type ParagraphBlock, type TableBlock } from '../blocks';
import { spansText, type InlineMark, type Span } from '../inline';

const text = (words: string, marks: InlineMark[] = []): Span => ({
  kind: 'text',
  text: words,
  marks,
  href: null,
});
const BREAK: Span = { kind: 'break' };
const para = (...spans: Span[]): ParagraphBlock => ({ kind: 'paragraph', spans });

function only<T>(markdown: string): T {
  const blocks = markdownBlocks(markdown);
  expect(blocks).toHaveLength(1);
  return blocks[0] as T;
}

describe('task items', () => {
  it('keep their words and whether the box is ticked; other items have no box', () => {
    const list = only<ListBlock>('- [ ] write the brief\n- [x] **send** it\n- plain');
    expect(list.items).toEqual([
      { blocks: [para(text('write the brief'))], checked: false },
      { blocks: [para(text('send', ['strong']), text(' it'))], checked: true },
      { blocks: [para(text('plain'))], checked: null },
    ]);
  });

  it('keep their boxes in a loose list (blank lines between items)', () => {
    const loose = only<ListBlock>('- [x] Created ticket #42\n\n- [ ] Email Maya');
    expect(
      loose.items.map((item) => [
        item.blocks.map((block) => (block.kind === 'paragraph' ? spansText(block.spans) : '')),
        item.checked,
      ]),
    ).toEqual([
      [['Created ticket #42'], true],
      [['Email Maya'], false],
    ]);
  });
});

describe('<br>', () => {
  it('is a line break in a table cell, written any way', () => {
    const table = only<TableBlock>('| Step | Notes |\n|---|---|\n| 1 | one<br>two<BR />three |');
    expect(table.rows[0][1]).toEqual([text('one'), BREAK, text('two'), BREAK, text('three')]);
    expect(markdownBlocks('a<br/>b')).toEqual([para(text('a'), BREAK, text('b'))]);
  });

  it('is the only tag read: any other stays literal, a <br> with attributes included', () => {
    expect(only<TableBlock>('| a |\n|---|\n| <b>x</b><br class="y"> |').rows[0][0]).toEqual([
      text('<b>x</b><br class="y">'),
    ]);
  });

  it('alone on a line is spacing, not words', () => {
    expect(markdownBlocks('above\n\n<br>\n\nbelow')).toEqual([
      para(text('above')),
      para(text('below')),
    ]);
  });
});
