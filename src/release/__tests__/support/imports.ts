// The packages a file imports, read from its syntax tree, for audit-imports.test.ts (rule 14.2): an
// import or export from a package, a type-only one included, an import type, a dynamic import, and
// a require, a require made by createRequire (named require…) or its resolve, with the package
// written as text. A file's own path, the repository's '@/' alias and Node's own modules are no
// package. Words inside a string or a comment, such as a sample a test parses, are no import, and
// neither is vi.mock, which stands in for a module without loading it. Test-only.

import { isBuiltin } from 'node:module';

import ts from 'typescript';

/** One package a file reaches for, at the line it does. */
export type FoundImport = Readonly<{
  line: number;
  /** As written: 'expo/config-plugins'. */
  specifier: string;
  /** The package it is in: 'expo'; '@scope/name' for a scoped one. */
  name: string;
}>;

/** A require made by createRequire is named for it: requireFromRoot. */
const REQUIRE = /^require(?:[A-Z]\w*)?$/;
/** Vitest's ways to load the real module, not a stand-in. */
const VITEST_LOADS = new Set(['vi.importActual', 'vi.importMock']);
/** The repository's own alias for src/ (tsconfig.json paths, vitest.config.ts). */
const REPO_ALIAS = '@/';

function parse(file: string, source: string): ts.SourceFile {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
}

/** The package a specifier names, or null for a path, the repository's alias or Node's own. */
export function packageOf(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null;
  if (specifier.startsWith(REPO_ALIAS) || isBuiltin(specifier)) return null;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function literalText(node: ts.Node | undefined): string | null {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

/** True for a call that loads or locates a module: import(), require…(), its resolve, vi's. */
function loadsModule(call: ts.CallExpression): boolean {
  const callee = call.expression;
  if (callee.kind === ts.SyntaxKind.ImportKeyword) return true;
  if (ts.isIdentifier(callee)) return REQUIRE.test(callee.text);
  if (!ts.isPropertyAccessExpression(callee)) return false;
  const owner = callee.expression;
  if (callee.name.text === 'resolve' && ts.isIdentifier(owner)) return REQUIRE.test(owner.text);
  return VITEST_LOADS.has(callee.getText());
}

/** The specifier a node names as text, when it is an import of any kind. */
function specifierOf(node: ts.Node): string | null {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    return literalText(node.moduleSpecifier);
  }
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    return literalText(node.moduleReference.expression);
  }
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
    return literalText(node.argument.literal);
  }
  if (ts.isCallExpression(node) && loadsModule(node)) return literalText(node.arguments[0]);
  return null;
}

/** Every package a file imports, in the order it is written. */
export function packagesImportedBy(file: string, source: string): FoundImport[] {
  const tree = parse(file, source);
  const found: FoundImport[] = [];
  const visit = (node: ts.Node): void => {
    const specifier = specifierOf(node);
    const name = specifier === null ? null : packageOf(specifier);
    if (specifier !== null && name !== null) {
      const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
      found.push(Object.freeze({ line, specifier, name }));
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}
