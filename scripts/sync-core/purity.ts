// What "pure" means for src/core/web (PRD-001 §4.3, D-CORE): no UI framework, no store, no
// Expo, and no browser or network global. Checked on the AST, so the word "window" in a comment
// or a string never fails a file, while `typeof window` or `globalThis.fetch` always does.
import ts from 'typescript';

import { forEachIdentifier, isMemberName, symbolOf, type FileModel } from './ast';

const FORBIDDEN_PACKAGES: readonly RegExp[] = [
  /^react(\/|$)/,
  /^react-dom(\/|$)/,
  /^react-native([-/]|$)/,
  /^next(\/|$)/,
  /^@tanstack\//,
  /^zustand(\/|$)/,
  /^expo([-/]|$)/,
];

const FORBIDDEN_GLOBALS = new Set([
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'fetch',
  'XMLHttpRequest',
]);

/** Receivers through which a global is still a global: `globalThis.fetch`, `self.window`. */
const GLOBAL_RECEIVERS = new Set(['globalThis', 'self']);

export function isForbiddenPackage(spec: string): boolean {
  return FORBIDDEN_PACKAGES.some((pattern) => pattern.test(spec));
}

/** Bound by nothing in this file: a global (`globalThis` is built in even without a lib). */
function isGlobal(model: FileModel, id: ts.Identifier): boolean {
  const declarations = symbolOf(model, id)?.declarations ?? [];
  return !declarations.some((decl) => decl.getSourceFile() === model.sf);
}

function isGlobalMemberAccess(model: FileModel, id: ts.Identifier): boolean {
  const parent = id.parent;
  if (!ts.isPropertyAccessExpression(parent) || parent.name !== id) return false;
  const receiver = parent.expression;
  return (
    ts.isIdentifier(receiver) && GLOBAL_RECEIVERS.has(receiver.text) && isGlobal(model, receiver)
  );
}

function isUnboundUse(model: FileModel, id: ts.Identifier, names: ReadonlySet<string>): boolean {
  if (!names.has(id.text)) return false;
  if (isGlobalMemberAccess(model, id)) return true;
  return !isMemberName(id) && isGlobal(model, id);
}

/** Every one of `names` the file uses as a global, as `name (line N)`, in source order. */
export function globalsUsed(model: FileModel, names: ReadonlySet<string>): string[] {
  const found = new Set<string>();
  forEachIdentifier(model.sf, (id) => {
    if (!isUnboundUse(model, id, names)) return;
    const { line } = model.sf.getLineAndCharacterOfPosition(id.getStart());
    found.add(`${id.text} (line ${line + 1})`);
  });
  return [...found];
}

/** Every forbidden global the file refers to, as `name (line N)`, in source order. */
export function forbiddenGlobals(model: FileModel): string[] {
  return globalsUsed(model, FORBIDDEN_GLOBALS);
}
