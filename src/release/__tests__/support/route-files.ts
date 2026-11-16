// What a thin route file is (the app standard's rule 4.4: a file under app/ mounts a screen that
// lives under src/ and holds nothing else), read from its syntax tree. Thin means:
//   - its statements are imports and one default-exported function, nothing else at the top level;
//   - it imports only from src/ and, from expo-router, only the route's params and Redirect, so no
//     React, no React Native and no styles;
//   - the function takes nothing, may name what it reads from the params (const), and returns one
//     element with no children: a screen imported from src/, or expo-router's Redirect;
//   - no hook is called but the router's useLocalSearchParams, and no function is written inside.
// Test-only (it lives under __tests__/ and never reaches the bundle).

import ts from 'typescript';

const ROUTER = 'expo-router';
const ROUTER_NAMES: readonly string[] = ['useLocalSearchParams', 'Redirect'];
const PARAMS_HOOK = 'useLocalSearchParams';
const REDIRECT = 'Redirect';
const HOOK = /^use[A-Z]/;
const FROM_SRC = /^(\.\.\/)+src\//;

/** The value names a route imports, each with the module it comes from. */
type Imports = ReadonlyMap<string, string>;

function treeOf(fileName: string, text: string): ts.SourceFile {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function moduleOf(node: ts.ImportDeclaration): string {
  return (node.moduleSpecifier as ts.StringLiteral).text;
}

function importedNames(node: ts.ImportDeclaration): readonly string[] {
  const clause = node.importClause;
  if (!clause) return [];
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamespaceImport(bindings)) return [`* as ${bindings.name.text}`];
  const named = bindings && ts.isNamedImports(bindings) ? bindings.elements : [];
  const names = named.map((each) => each.name.text);
  return clause.name ? [clause.name.text, ...names] : names;
}

function importFaults(node: ts.ImportDeclaration): string[] {
  const from = moduleOf(node);
  if (FROM_SRC.test(from)) return [];
  if (from !== ROUTER) return [`imports from ${from}`];
  return importedNames(node)
    .filter((name) => !ROUTER_NAMES.includes(name))
    .map((name) => `imports ${name} from ${ROUTER}`);
}

function importsOf(source: ts.SourceFile): Imports {
  const pairs = source.statements
    .filter(ts.isImportDeclaration)
    .flatMap((node) => importedNames(node).map((name) => [name, moduleOf(node)] as const));
  return new Map(pairs);
}

function isDefaultFunction(node: ts.Statement): node is ts.FunctionDeclaration {
  if (!ts.isFunctionDeclaration(node)) return false;
  const kinds = (node.modifiers ?? []).map((modifier) => modifier.kind);
  return (
    kinds.includes(ts.SyntaxKind.ExportKeyword) && kinds.includes(ts.SyntaxKind.DefaultKeyword)
  );
}

/** Every node under `root`, depth first. */
function descendants(root: ts.Node): ts.Node[] {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    found.push(node);
    node.forEachChild(visit);
  };
  root.forEachChild(visit);
  return found;
}

function calledName(call: ts.CallExpression): string | null {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  return ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
}

function hookFaults(source: ts.SourceFile): string[] {
  return descendants(source)
    .filter(ts.isCallExpression)
    .map(calledName)
    .filter((name): name is string => name !== null && HOOK.test(name) && name !== PARAMS_HOOK)
    .map((name) => `calls ${name}`);
}

function returnedElement(statement: ts.Statement | undefined): ts.JsxSelfClosingElement | null {
  if (!statement || !ts.isReturnStatement(statement) || !statement.expression) return null;
  let value: ts.Expression = statement.expression;
  while (ts.isParenthesizedExpression(value)) value = value.expression;
  return ts.isJsxSelfClosingElement(value) ? value : null;
}

function isConst(statement: ts.Statement): boolean {
  return (
    ts.isVariableStatement(statement) &&
    (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
  );
}

function elementFaults(element: ts.JsxSelfClosingElement | null, imports: Imports): string[] {
  if (!element) return ['does not return one element with no children'];
  const tag = element.tagName.getText();
  const from = imports.get(tag);
  if (tag === REDIRECT && from === ROUTER) return [];
  return from && FROM_SRC.test(from) ? [] : [`returns <${tag}>, which is not from src/`];
}

function bodyFaults(fn: ts.FunctionDeclaration, imports: Imports): string[] {
  const statements = fn.body?.statements ?? [];
  const faults = fn.parameters.length > 0 ? ['takes props'] : [];
  const before = statements.slice(0, -1).filter((statement) => !isConst(statement));
  faults.push(...before.map(() => 'holds a statement that is not a const'));
  faults.push(...elementFaults(returnedElement(statements[statements.length - 1]), imports));
  const inner = descendants(fn).filter(
    (node) => ts.isArrowFunction(node) || ts.isFunctionExpression(node),
  );
  faults.push(...inner.map(() => 'writes a function inside'));
  const elements = descendants(fn).filter(
    (node) => ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node) || ts.isJsxFragment(node),
  );
  if (elements.length > 1) faults.push('draws more than one element');
  return faults;
}

/** A top-level statement that is neither an import nor the default function, in words. */
function topLevelName(node: ts.Statement): string {
  if (ts.isVariableStatement(node)) return 'a declaration';
  if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) return 'an export';
  if (ts.isFunctionDeclaration(node)) return 'another function';
  return ts.isExpressionStatement(node) ? 'a call' : 'a statement';
}

function statementFaults(node: ts.Statement, imports: Imports): string[] {
  if (ts.isImportDeclaration(node)) return importFaults(node);
  if (isDefaultFunction(node)) return bodyFaults(node, imports);
  return [`holds ${topLevelName(node)} at the top level`];
}

/** Why a route file is not thin; empty when it is. */
export function routeFaults(fileName: string, text: string): string[] {
  const source = treeOf(fileName, text);
  const imports = importsOf(source);
  const faults = source.statements.flatMap((node) => statementFaults(node, imports));
  const defaults = source.statements.filter(isDefaultFunction).length;
  if (defaults !== 1) faults.push(`has ${defaults} default-exported functions, not one`);
  return [...faults, ...hookFaults(source)];
}

/** The module a thin route's element comes from ('expo-router' for Redirect), or null. */
export function mountedFrom(fileName: string, text: string): string | null {
  const source = treeOf(fileName, text);
  const fn = source.statements.find(isDefaultFunction);
  const statements = fn?.body?.statements ?? [];
  const element = returnedElement(statements[statements.length - 1]);
  return element ? (importsOf(source).get(element.tagName.getText()) ?? null) : null;
}
