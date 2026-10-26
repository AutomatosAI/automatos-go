// Frozen copies (the manifest's `frozen`): files the sync vendored at an older pin that core has
// since deleted, kept because the app still runs them. src/core/frozen/ mirrors the source's root
// as src/core/web/ does; each file opens with a provenance header naming its source path and the
// frozen SHA, and the manifest records its sha256. Nothing writes these files: `--check` holds
// each one to its entry, so an edit, a lost header, a missing copy or a stray file fails.
// Pure: scripts/sync-core.ts reads the files.
import { MANIFEST_PATH, sha256, type Manifest } from './manifest';

export const FROZEN_DIR = 'src/core/frozen';

type Frozen = NonNullable<Manifest['frozen']>;
type Source = Pick<Manifest, 'source' | 'root'>;

/** The first line's opening: where the file came from and at which commit. */
export function frozenHeader(source: Source, sha: string, path: string): string {
  return `// Frozen from ${source.source} ${source.root}/${path} @ ${sha}`;
}

function opensWith(text: string, header: string): boolean {
  const [first = ''] = text.split('\n', 1);
  return first === header || first.startsWith(`${header} `);
}

function entryProblems(
  source: Source,
  frozen: Frozen,
  files: ReadonlyMap<string, string>,
): string[] {
  return Object.entries(frozen.files).flatMap(([path, hash]) => {
    const file = `${FROZEN_DIR}/${path}`;
    const text = files.get(file);
    if (text === undefined) return [`missing: ${file}`];
    const header = frozenHeader(source, frozen.sha, path);
    if (!opensWith(text, header)) return [`${file} must open with the header: ${header}`];
    if (sha256(text) === hash) return [];
    return [`edited: ${file} (never edit a frozen copy: to change it, make it the app's own code)`];
  });
}

/**
 * The frozen half of `--check`. `files` holds every file found under src/core/frozen (and may hold
 * others); paths are repo-relative. One line per problem; empty when every copy matches.
 */
export function frozenProblems(
  manifest: Pick<Manifest, 'source' | 'root' | 'frozen'>,
  files: ReadonlyMap<string, string>,
): string[] {
  const listed = manifest.frozen?.files ?? {};
  const extra = [...files.keys()]
    .filter((file) => file.startsWith(`${FROZEN_DIR}/`))
    .filter((file) => !(file.slice(FROZEN_DIR.length + 1) in listed))
    .map((file) => `extra: ${file} (not listed under frozen in ${MANIFEST_PATH})`);
  const entries = manifest.frozen ? entryProblems(manifest, manifest.frozen, files) : [];
  return [...entries, ...extra];
}
