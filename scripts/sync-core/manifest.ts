// The two files sync-core reads and writes, parsed with zod (PRD-001 §4.11: zod at every
// boundary). scripts/core-manifest.json says what to vendor from automatos-ai and how;
// core.lock.json records every file the sync wrote with its sha256 (K1, D-CORE).
import { createHash } from 'node:crypto';
import { z } from 'zod';

const reason = z.string().min(1, 'every entry needs a one-line reason');

const namedEntry = z.object({
  names: z.array(z.string().min(1)).min(1),
  reason,
});

export const manifestSchema = z.object({
  source: z.string().min(1),
  sha: z.string().regex(/^[0-9a-f]{40}$/, 'sha must be a full 40-character commit id'),
  root: z.string().min(1),
  notes: z.array(z.string()).default([]),
  sets: z.record(z.array(z.string().min(1))),
  extract: z.record(namedEntry),
  drop: z.record(namedEntry),
  typeOnly: z.record(namedEntry),
  shims: z.record(z.object({ path: z.string().min(1), reason })),
  /** web test files (root-relative) the static rule would copy but that cannot run here */
  skipTests: z.record(reason).default({}),
});

export type Manifest = z.infer<typeof manifestSchema>;

// passthrough: later stories may add keys that --check must not reject.
export const lockSchema = z
  .object({
    source: z.string().min(1),
    sha: z.string().min(1),
    syncedAt: z.string().min(1),
    files: z.record(z.string().regex(/^[0-9a-f]{64}$/)),
    /** every web test beside a vendored module that was not copied, with the reason */
    skippedTests: z.record(z.string().min(1)).default({}),
  })
  .passthrough();

export type Lock = z.infer<typeof lockSchema>;

/** Where vendored files land in this repo: src/core/web/ mirrors the source's root (K1). */
export const WEB_DIR = 'src/core/web';

export const MANIFEST_PATH = 'scripts/core-manifest.json';
export const LOCK_PATH = 'core.lock.json';

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function webPath(sourcePath: string): string {
  return `${WEB_DIR}/${sourcePath}`;
}

export function buildLock(
  manifest: Pick<Manifest, 'source' | 'sha'>,
  files: readonly { readonly path: string; readonly text: string }[],
  syncedAt: string,
  skippedTests: Readonly<Record<string, string>> = {},
): Lock {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const skipped = Object.entries(skippedTests).sort(([a], [b]) => a.localeCompare(b));
  return {
    source: manifest.source,
    sha: manifest.sha,
    syncedAt,
    files: Object.fromEntries(sorted.map((file) => [file.path, sha256(file.text)])),
    skippedTests: Object.fromEntries(skipped),
  };
}

/**
 * The drift check (`--check`, npm run check:core). `files` holds every file found under
 * src/core/web plus any lock-listed file elsewhere that exists; paths are repo-relative.
 * Returns one line per problem; an empty list means the tree matches the lock.
 */
export function checkLock(
  manifest: Pick<Manifest, 'source' | 'sha' | 'sets'>,
  lock: Lock,
  files: ReadonlyMap<string, string>,
): string[] {
  return [
    ...pinProblems(manifest, lock),
    ...listedProblems(lock, files),
    ...extraProblems(lock, files),
    ...setProblems(manifest, lock),
  ];
}

function pinProblems(manifest: Pick<Manifest, 'source' | 'sha'>, lock: Lock): string[] {
  if (lock.source === manifest.source && lock.sha === manifest.sha) return [];
  return [
    `${LOCK_PATH} is pinned to ${lock.source}@${lock.sha} but ${MANIFEST_PATH} says ` +
      `${manifest.source}@${manifest.sha}: run the sync`,
  ];
}

function listedProblems(lock: Lock, files: ReadonlyMap<string, string>): string[] {
  return Object.entries(lock.files).flatMap(([path, hash]) => {
    const text = files.get(path);
    if (text === undefined) return [`missing: ${path}`];
    return sha256(text) === hash ? [] : [`edited: ${path} (never edit vendored files)`];
  });
}

function extraProblems(lock: Lock, files: ReadonlyMap<string, string>): string[] {
  return [...files.keys()]
    .filter((path) => path.startsWith(`${WEB_DIR}/`) && !(path in lock.files))
    .map((path) => `extra: ${path} (not written by scripts/sync-core.ts)`);
}

function setProblems(manifest: Pick<Manifest, 'sets'>, lock: Lock): string[] {
  return Object.values(manifest.sets)
    .flat()
    .filter((entry) => !(webPath(entry) in lock.files))
    .map((entry) => `not vendored: ${entry} is in ${MANIFEST_PATH} but not in ${LOCK_PATH}`);
}
