// What a product file renders and where each rendered name comes from, read from its syntax tree,
// for the surface audit (surfaces.test.ts): the JSX tags it draws and the components it hands over
// as props (ListHeaderComponent={X}), the file a value import resolves to, through a folder's
// index.ts and its re-exports, and the files that import a module. Relative specifiers only: a
// package is never a product file. Test-only (it lives under __tests__/ and never reaches the
// bundle).

import { existsSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { readRepoFile, repoRoot } from './tree';

const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'] as const;
const MAX_HOPS = 8;
const trees = new Map<string, ts.SourceFile>();

/** One repo file's syntax tree (.tsx parsed as TSX), parsed once. */
export function treeOf(file: string): ts.SourceFile {
  const cached = trees.get(file);
  if (cached) return cached;
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(file, readRepoFile(file), ts.ScriptTarget.Latest, true, kind);
  trees.set(file, tree);
  return tree;
}

function eachNode(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => eachNode(child, visit));
}

function renderedName(node: ts.Node): string | null {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    return node.tagName.getText();
  }
  // a component handed over as a prop: ListHeaderComponent={PlayThreadCaption}
  if (ts.isJsxAttribute(node) && node.initializer && ts.isJsxExpression(node.initializer)) {
    const value = node.initializer.expression;
    if (value && ts.isIdentifier(value) && /^[A-Z]/.test(value.text)) return value.text;
  }
  return null;
}

/** Every name the file renders: its JSX tags and the components it passes as props. */
export function renderedNames(file: string): Set<string> {
  const names = new Set<string>();
  eachNode(treeOf(file), (node) => {
    const name = renderedName(node);
    if (name !== null) names.add(name);
  });
  return names;
}

/** The repo file a relative module specifier names from `file`, or null (a package). */
export function resolveModule(file: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = path.posix.join(path.posix.dirname(file), specifier);
  const found = EXTENSIONS.map((extension) => `${base}${extension}`).find((candidate) =>
    existsSync(path.join(repoRoot(), candidate)),
  );
  return found ?? null;
}

function specifierOf(node: ts.ImportDeclaration | ts.ExportDeclaration): string | null {
  const module = node.moduleSpecifier;
  return module && ts.isStringLiteral(module) ? module.text : null;
}

/** The module a file's value import of `name` comes from (never `import type`), or null. */
function importedFrom(file: string, name: string): string | null {
  const imports = treeOf(file).statements.filter(ts.isImportDeclaration);
  const source = imports.find((node) => {
    const clause = node.importClause;
    if (!clause || clause.isTypeOnly) return false;
    if (clause.name?.text === name) return true;
    const bindings = clause.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) return false;
    return bindings.elements.some((each) => each.name.text === name && !each.isTypeOnly);
  });
  const specifier = source ? specifierOf(source) : null;
  return specifier ? resolveModule(file, specifier) : null;
}

/** The names a file declares at its top level: functions, classes and variables. */
function declaredNames(file: string): string[] {
  return treeOf(file).statements.flatMap((statement) => {
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      return statement.name ? [statement.name.text] : [];
    }
    if (!ts.isVariableStatement(statement)) return [];
    return statement.declarationList.declarations.flatMap((each) =>
      ts.isIdentifier(each.name) ? [each.name.text] : [],
    );
  });
}

function declares(file: string, name: string): boolean {
  return declaredNames(file).includes(name);
}

/** The modules a re-export of `name` in `file` points at, with the name there. */
function reExportsOf(file: string, name: string): { module: string; name: string }[] {
  return treeOf(file)
    .statements.filter(ts.isExportDeclaration)
    .flatMap((node) => {
      const specifier = specifierOf(node);
      const module = specifier ? resolveModule(file, specifier) : null;
      if (!module || node.isTypeOnly) return [];
      const clause = node.exportClause;
      if (!clause) return [{ module, name }]; // export * from './x'
      if (!ts.isNamedExports(clause)) return [];
      const each = clause.elements.find((element) => element.name.text === name);
      return each ? [{ module, name: each.propertyName?.text ?? name }] : [];
    });
}

function follow(file: string, name: string, hops: number): string | null {
  if (declares(file, name)) return file;
  if (hops >= MAX_HOPS) return null;
  for (const next of reExportsOf(file, name)) {
    const found = follow(next.module, next.name, hops + 1);
    if (found) return found;
  }
  return null;
}

/** The file that declares what `file` calls `name`: itself, or its import followed through barrels. */
export function definingFile(file: string, name: string): string | null {
  if (declares(file, name)) return file;
  const module = importedFrom(file, name);
  return module ? follow(module, name, 0) : null;
}

/** True when `file` renders a name that another file, `target`, declares. */
export function rendersFrom(file: string, target: string): boolean {
  if (file === target) return false;
  return [...renderedNames(file)].some((name) => definingFile(file, name) === target);
}

/** The value-imported names of a file. */
function importedNames(file: string): string[] {
  return treeOf(file)
    .statements.filter(ts.isImportDeclaration)
    .flatMap((node) => {
      const clause = node.importClause;
      if (!clause || clause.isTypeOnly) return [];
      const bindings = clause.namedBindings;
      const named = bindings && ts.isNamedImports(bindings) ? bindings.elements : [];
      const values = named.filter((each) => !each.isTypeOnly).map((each) => each.name.text);
      return clause.name ? [clause.name.text, ...values] : values;
    });
}

/**
 * The files among `files` with a value import of something `target` declares. Only a file whose
 * text names the target's module or one of its names is parsed: an import of it must say one.
 */
export function importersOf(target: string, files: readonly string[]): string[] {
  const stem = path.posix.basename(target).replace(/\.tsx?$/, '');
  const words = [stem, ...declaredNames(target)];
  return files.filter((file) => {
    if (file === target) return false;
    const text = readRepoFile(file);
    if (!words.some((word) => text.includes(word))) return false;
    return importedNames(file).some((name) => definingFile(file, name) === target);
  });
}

/**
 * True when every JSX element that renders `name` in `file` has it as its container's first
 * child: the caption opens its row, before anything else in it.
 */
export function rendersFirst(file: string, name: string): boolean {
  const places: boolean[] = [];
  eachNode(treeOf(file), (node) => {
    if (!ts.isJsxElement(node)) return;
    const children = node.children.filter((child) => !ts.isJsxText(child) || child.text.trim());
    children.forEach((child, index) => {
      const tag = ts.isJsxSelfClosingElement(child) ? child.tagName.getText() : null;
      if (tag === name) places.push(index === 0);
    });
  });
  return places.length > 0 && places.every(Boolean);
}
