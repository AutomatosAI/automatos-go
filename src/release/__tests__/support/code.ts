// A product file's code without its comments, for the release audits that look for what the code
// DOES (a call, an import, a route) rather than what a comment says about it. TypeScript's own
// printer drops the comments, so a '//' inside a string, a URL in JSX text or an apostrophe in
// copy is left as it is, where a regex stripper would cut it. Test-only (it lives under
// __tests__/ and never reaches the bundle).

import ts from 'typescript';

import { readRepoFile } from './tree';

const printer = ts.createPrinter({ removeComments: true });

/** The text as TypeScript prints it with every comment removed (.tsx parsed as TSX). */
export function stripComments(fileName: string, text: string): string {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  return printer.printFile(source);
}

/** One repo file's code, comments removed. */
export function codeOf(relPath: string): string {
  return stripComments(relPath, readRepoFile(relPath));
}
