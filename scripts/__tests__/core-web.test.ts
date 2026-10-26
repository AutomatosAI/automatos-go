// What src/core/web and src/core/frozen must never hold, read from the vendored and frozen
// files themselves with the TypeScript AST (comments and strings that mention a hook or
// applyCssVars do not count): the DOM-only applyCssVars (dropped from lib/look-kit/css.ts) and
// any React hook — no use* function declared or called, no import of react, react-dom or
// react-native.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { FROZEN_DIR } from '../sync-core/frozen';
import { listFiles } from '../sync-core/source';

const REPO = path.resolve(__dirname, '..', '..');
const WEB_DIR = 'src/core/web';
const HOOK_NAME = /^use[A-Z0-9]/;
const REACT_PACKAGE = /^react(-dom|-native)?(\/|$)/;

type Finding = { readonly file: string; readonly what: string };

function parse(file: string): ts.SourceFile {
  const text = fs.readFileSync(path.join(REPO, file), 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
}

function declaredName(node: ts.Node): string | undefined {
  const isDeclaration =
    ts.isFunctionDeclaration(node) ||
    ts.isVariableDeclaration(node) ||
    ts.isMethodDeclaration(node);
  return isDeclaration && node.name && ts.isIdentifier(node.name) ? node.name.text : undefined;
}

function calledName(node: ts.Node): string | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  return ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined;
}

function importedPackage(node: ts.Node): string | undefined {
  const isModuleStatement = ts.isImportDeclaration(node) || ts.isExportDeclaration(node);
  const spec = isModuleStatement ? node.moduleSpecifier : undefined;
  return spec && ts.isStringLiteralLike(spec) ? spec.text : undefined;
}

/** What the file must not hold, in source order. */
function findings(sf: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === 'applyCssVars') found.push('applyCssVars');
    const declared = declaredName(node);
    if (declared && HOOK_NAME.test(declared)) found.push(`declares ${declared}`);
    const called = calledName(node);
    if (called && HOOK_NAME.test(called)) found.push(`calls ${called}`);
    const imported = importedPackage(node);
    if (imported && REACT_PACKAGE.test(imported)) found.push(`imports ${imported}`);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function findingsIn(file: string): Finding[] {
  return findings(parse(file)).map((what) => ({ file, what }));
}

function declaredNames(file: string): string[] {
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    const name = declaredName(node);
    if (name) names.push(name);
    ts.forEachChild(node, visit);
  };
  visit(parse(`${WEB_DIR}/${file}`));
  return names;
}

const files = [...listFiles(REPO, WEB_DIR), ...listFiles(REPO, FROZEN_DIR)].filter((file) =>
  /\.tsx?$/.test(file),
);

describe('src/core/web and src/core/frozen, on the AST', () => {
  it('has vendored and frozen files to read (the check is not vacuous)', () => {
    expect(files).toContain(`${WEB_DIR}/lib/look-kit/css.ts`);
    expect(files).toContain(`${WEB_DIR}/hooks/use-board-event-stream.ts`);
    expect(files).toContain(`${FROZEN_DIR}/lib/mascot/reducer.ts`);
  });

  it('holds no applyCssVars and no React hook', () => {
    expect(files.flatMap(findingsIn)).toEqual([]);
  });

  it('keeps the pure parts the hooks were cut from', () => {
    expect(declaredNames('hooks/use-board-event-stream.ts')).toContain('parseSSEFrames');
    expect(declaredNames('lib/look-kit/css.ts')).toContain('lookToCssVars');
  });

  it('would catch a hook and applyCssVars written in code, not in a comment or a string', () => {
    const text = [
      '// useState and applyCssVars in a comment are fine',
      "import { useEffect } from 'react'",
      "const label = 'useEffect'",
      'export function useProbe() { useEffect(() => applyCssVars(label)) }',
    ].join('\n');
    const sf = ts.createSourceFile('probe.ts', text, ts.ScriptTarget.Latest, true);
    expect(findings(sf)).toEqual([
      'imports react',
      'declares useProbe',
      'calls useEffect',
      'applyCssVars',
    ]);
  });
});
