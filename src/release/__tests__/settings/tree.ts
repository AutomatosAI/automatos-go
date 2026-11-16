// The product tree the release audits read (test-only): the folders support/tree.ts walks. Every
// path is relative to the repository root, in posix form, with no trailing slash. A folder outside
// the repository is written relative to it ('../site/src', for an app that shares source with its
// product), and the walkers read it as they read 'src'.

import { frozen } from './types';

export type AuditTree = Readonly<{
  /** The folders whose .ts and .tsx files the app ships. */
  productFolders: readonly string[];
  /** The product folders whose strings.ts and platform *-copy.ts files hold the app's words. */
  copyFolders: readonly string[];
  /** Folders inside the product folders that a tool writes, never a person: no audit reads them. */
  vendoredFolders: readonly string[];
}>;

export const AUDIT_TREE: AuditTree = frozen({
  productFolders: ['src', 'app'],
  copyFolders: ['src'],
  vendoredFolders: ['src/core/web'],
});
