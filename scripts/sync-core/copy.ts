// Files sync-core copies verbatim from elsewhere in the checkout, outside the manifest's root:
// the server's route manifest, which scripts/check-routes.ts checks every route table against
// (K4). A copy keeps its bytes (JSON takes no header line); core.lock.json lists it like any
// vendored file, so --check catches an edit. Pure: it reads only through the tree it is given.
import path from 'node:path';

import type { VendoredFile } from './closure';
import { WEB_DIR, type Manifest } from './manifest';
import type { SourceTree } from './resolve';

/** Copies land in the hand-written core's folder, never in the web mirror sync-core owns. */
const COPY_DIR = 'src/core';

export type CopyResult = { readonly files: VendoredFile[]; readonly problems: string[] };

function targetProblem(to: string): string | undefined {
  const plain = path.posix.normalize(to) === to && !path.posix.isAbsolute(to);
  if (plain && to.startsWith(`${COPY_DIR}/`) && !to.startsWith(`${WEB_DIR}/`)) return undefined;
  return `copy target ${to} must be a plain path under ${COPY_DIR}/, outside ${WEB_DIR}/`;
}

function copyOne(checkout: SourceTree, from: string, to: string): CopyResult {
  const refused = targetProblem(to);
  if (refused) return { files: [], problems: [refused] };
  const text = checkout.read(from);
  return text === undefined
    ? { files: [], problems: [`copy source not in the checkout: ${from}`] }
    : { files: [{ path: to, text }], problems: [] };
}

/** `checkout` reads checkout-relative paths (the copy sources sit outside the root). */
export function copyFiles(manifest: Pick<Manifest, 'copy'>, checkout: SourceTree): CopyResult {
  const results = Object.entries(manifest.copy).map(([from, { to }]) =>
    copyOne(checkout, from, to),
  );
  return {
    files: results.flatMap((result) => result.files),
    problems: results.flatMap((result) => result.problems),
  };
}
