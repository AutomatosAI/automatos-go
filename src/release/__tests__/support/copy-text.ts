// The words a person can read in the app, as the store-copy audit reads them (R12–R16, KR4):
// every string a feature's copy module holds (each strings.ts under src/), and every piece of
// literal text in a product .tsx — JSX text, and the strings its props and expressions carry
// (labels VoiceOver reads included). Read from the syntax tree, so comments are never copy and an
// apostrophe or a '//' inside a string is kept. A template's substitutions read as '${…}'.
// Test-only (it lives under __tests__/ and never reaches the bundle).

import ts from 'typescript';

import { productFiles, readRepoFile, stringsModules } from './tree';

export type CopyText = Readonly<{ file: string; text: string }>;

/** What a template literal reads as: its literal parts, each substitution as '${…}'. */
const SUBSTITUTION = '${…}';

function templateText(node: ts.TemplateExpression): string {
  const parts = node.templateSpans.map((span) => span.literal.text);
  return [node.head.text, ...parts].join(SUBSTITUTION);
}

/** A module name in an import, an export or a require is no copy. */
function isModuleName(node: ts.Node): boolean {
  const parent = node.parent;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
  if (ts.isExternalModuleReference(parent) || ts.isImportTypeNode(parent.parent)) return true;
  return ts.isCallExpression(parent) && parent.expression.getText() === 'require';
}

function textOf(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return isModuleName(node) ? null : node.text;
  }
  if (ts.isTemplateExpression(node)) return templateText(node);
  if (ts.isJsxText(node)) return node.text.replace(/\s+/g, ' ').trim() || null;
  return null;
}

/** Every string, template and JSX text in one source, in source order (.tsx parsed as TSX). */
export function copyTextsOf(fileName: string, source: string): string[] {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const text = textOf(node);
    if (text !== null) found.push(text);
    // a template's own parts are read once, through templateText
    if (!ts.isTemplateExpression(node)) ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

/** The files the audit reads: every strings module, then every product .tsx. */
export function copyFiles(): string[] {
  const tsx = productFiles().filter((file) => file.endsWith('.tsx'));
  return [...stringsModules(), ...tsx];
}

/** Every piece of copy in the product tree, with the file it is in. */
export function appCopy(): CopyText[] {
  return copyFiles().flatMap((file) =>
    copyTextsOf(file, readRepoFile(file)).map((text) => ({ file, text })),
  );
}
