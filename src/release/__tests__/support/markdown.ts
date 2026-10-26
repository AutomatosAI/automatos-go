// Markdown as the release audits read docs/release/ (test-only): the '## ' sections of a document
// and its pipe tables, each row keyed by the header's cells. Enough for the store-form documents,
// not a general Markdown parser: no escaped pipes, no tables inside lists. A row whose cell count
// differs from its header's throws, so a broken table fails the audit instead of passing it.

export type MarkdownRow = Readonly<Record<string, string>>;

export type MarkdownTable = Readonly<{
  header: readonly string[];
  rows: readonly MarkdownRow[];
}>;

const TABLE_LINE = /^\s*\|.*\|\s*$/;
const DIVIDER_CELL = /^:?-{3,}:?$/;
const SECTION_HEADING = /^## /m;

/** One table line's cells, trimmed, without the outer pipes. */
export function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** Runs of consecutive table lines, each run one candidate table. */
function tableBlocks(lines: readonly string[]): string[][] {
  return lines.reduce<string[][]>((blocks, line, index) => {
    if (!TABLE_LINE.test(line)) return blocks;
    const continues = index > 0 && TABLE_LINE.test(lines[index - 1]);
    if (!continues) return [...blocks, [line]];
    const last = blocks[blocks.length - 1];
    return [...blocks.slice(0, -1), [...last, line]];
  }, []);
}

function isDivider(line: string | undefined): boolean {
  return line !== undefined && tableCells(line).every((cell) => DIVIDER_CELL.test(cell));
}

function rowOf(header: readonly string[], line: string): MarkdownRow {
  const cells = tableCells(line);
  if (cells.length !== header.length) {
    throw new Error(`table row has ${cells.length} cells, its header ${header.length}: ${line}`);
  }
  return Object.freeze(Object.fromEntries(header.map((name, index) => [name, cells[index]])));
}

/** Every pipe table in the text, in order: a header line, a divider line, then its rows. */
export function markdownTables(text: string): MarkdownTable[] {
  return tableBlocks(text.split('\n'))
    .filter((block) => block.length >= 2 && isDivider(block[1]))
    .map(([headerLine, , ...rowLines]) => {
      const header = tableCells(headerLine);
      return Object.freeze({ header, rows: rowLines.map((line) => rowOf(header, line)) });
    });
}

/** The one table whose header has every named column; throws unless exactly one has. */
export function tableWithColumns(text: string, columns: readonly string[]): MarkdownTable {
  const found = markdownTables(text).filter((table) =>
    columns.every((column) => table.header.includes(column)),
  );
  if (found.length !== 1) {
    throw new Error(`expected one table with columns ${columns.join(', ')}; found ${found.length}`);
  }
  return found[0];
}

/** The text under each '## ' heading (to the next one), by the heading's words. */
export function markdownSections(text: string): ReadonlyMap<string, string> {
  const parts = text.split(SECTION_HEADING).slice(1);
  return new Map(
    parts.map((part) => {
      const newline = part.indexOf('\n');
      const title = (newline === -1 ? part : part.slice(0, newline)).trim();
      return [title, newline === -1 ? '' : part.slice(newline + 1)] as const;
    }),
  );
}

/** The section whose heading starts with the given words; throws when there is none. */
export function sectionStartingWith(text: string, words: string): string {
  const match = [...markdownSections(text)].find(([title]) => title.startsWith(words));
  if (!match) throw new Error(`no '## ${words}…' section`);
  return match[1];
}
