// StateGlyph across every product file (docs/app-standard.md rules 1.4 and 10.6), read from each
// file's syntax tree: it is given a state and nothing else, so its glyph and colour come from the
// state tables (state-tokens.ts stateGlyphMark) and never from a colour a feature picks, it is
// never imported under another name, and it is hidden from VoiceOver and TalkBack, because the
// state's word beside it says the state.

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { productFiles, readRepoFile } from '../../release/__tests__/support/tree';
import type { StateGlyphProps } from '../StateGlyph';

const TAG = 'StateGlyph';
const FILE = 'src/ui/StateGlyph.tsx';

type Use = Readonly<{ file: string; line: number; props: readonly string[] }>;

function parse(file: string, source: string): ts.SourceFile {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function propNames(attributes: ts.JsxAttributes): string[] {
  return attributes.properties.map((each) =>
    ts.isJsxAttribute(each) ? each.name.getText() : '...spread',
  );
}

/** Every <StateGlyph …> a file draws, with the props it is given; and any import that renames it. */
function usesOf(file: string, source: string): { uses: Use[]; renamed: boolean } {
  const tree = parse(file, source);
  const uses: Use[] = [];
  let renamed = false;
  const visit = (node: ts.Node): void => {
    if (ts.isImportSpecifier(node) && node.propertyName?.getText() === TAG) renamed = true;
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      node.tagName.getText() === TAG
    ) {
      const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
      uses.push({ file, line, props: propNames(node.attributes) });
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return { uses, renamed };
}

const files = productFiles().filter((file) => file.endsWith('.tsx'));
const found = files.map((file) => ({ file, ...usesOf(file, readRepoFile(file)) }));
const uses = found.flatMap((each) => each.uses);

// The type is the first guard: a colour, or a colour's name where a state goes, does not compile.
// @ts-expect-error a colour is not a prop: the glyph's colour is the state's
const coloured: StateGlyphProps = { state: 'ready', role: 'accent' };
// @ts-expect-error a colour's name is not a state
const named: StateGlyphProps = { state: 'accent' };
const given: StateGlyphProps = { state: 'needs_you' };

describe('StateGlyph is given a state, never a colour', () => {
  it('takes a state alone by its type', () => {
    expect([coloured.state, named.state, given.state]).toEqual(['ready', 'accent', 'needs_you']);
  });

  it('finds every use: the board, the brief and Questions (StateMark), and the readiness list', () => {
    expect(uses.map((use) => use.file)).toEqual(
      expect.arrayContaining([
        'src/cc/status/StatusLine.tsx',
        'src/readiness/ReadinessSection.tsx',
      ]),
    );
  });

  it('is given only its state at every use', () => {
    const bad = uses
      .filter((use) => use.props.join() !== 'state')
      .map((use) => `${use.file}:${use.line} ${use.props.join(', ')}`);
    expect(bad).toEqual([]);
  });

  it('is never imported under another name', () => {
    expect(found.filter((each) => each.renamed).map((each) => each.file)).toEqual([]);
  });

  it('tells the walk a colour from a state', () => {
    const source = [
      'export const A = () => (',
      '  <>',
      '    <StateGlyph state="ready" />',
      '    <StateGlyph state={s} role="accent" />',
      '    <StateGlyph {...mark} />',
      '  </>',
      ');',
    ].join('\n');
    expect(usesOf('a.tsx', source).uses.map((use) => use.props.join())).toEqual([
      'state',
      'state,role',
      '...spread',
    ]);
    expect(usesOf('b.tsx', "import { StateGlyph as Mark } from '../ui';").renamed).toBe(true);
  });
});

describe('StateGlyph is hidden from the screen reader (rule 10.6)', () => {
  const source = readRepoFile(FILE);

  it('hides its glyph from VoiceOver and TalkBack', () => {
    expect(source).toMatch(
      /accessible=\{false\}\s+accessibilityElementsHidden\s+importantForAccessibility="no"/,
    );
  });

  it('draws the colour stateGlyphMark gives, from the dress and scheme on screen', () => {
    expect(source).toContain('const mark = stateGlyphMark(state, {');
    expect(source).toContain('style={{ color: colours[mark.token] }}');
    expect(source).toMatch(
      /export type StateGlyphProps = \{[^}]*readonly state: StatusState;\s*\};/,
    );
  });
});
