// The vendoring walk (PRD-001 §4.3, K1): start from the manifest's sets, follow every relative
// and aliased import transitively, apply typeOnly / extract / drop, redirect shimmed packages,
// refuse anything impure with the import chain that reached it, and return the files to write
// under src/core/web. Pure: it reads only through the SourceTree it is given.
import { analyse, moduleRefs, type ModuleRef } from './ast';
import { webPath, type Manifest } from './manifest';
import { forbiddenGlobals, isForbiddenPackage } from './purity';
import {
  exportedNames,
  relativeSpecifier,
  resolveSpec,
  type Alias,
  type SourceTree,
} from './resolve';
import { select, type SelectMode } from './select';

export type VendorConfig = {
  readonly manifest: Manifest;
  readonly aliases: readonly Alias[];
  /** the app's runtime dependencies: a bare import of one of these may stay as written */
  readonly packages: ReadonlySet<string>;
};

export type VendoredFile = { readonly path: string; readonly text: string };
export type VendorResult = {
  readonly files: VendoredFile[];
  /** the root-relative source path of every vendored file */
  readonly sources: string[];
  readonly problems: string[];
};

export type Mode = { readonly kind: 'full' | SelectMode; readonly names: readonly string[] };
export type Edit = { readonly start: number; readonly end: number; readonly text: string };
type Job = { readonly path: string; readonly chain: readonly string[] };
type RefOutcome = {
  readonly edit?: Edit;
  readonly next?: Job;
  /** the shimmed package this import was redirected from */
  readonly shim?: string;
  /** a forbidden package: the walk does not descend from this file */
  readonly impure?: boolean;
  readonly problems: string[];
};

const NAMED_KINDS: readonly SelectMode[] = ['typeOnly', 'extract', 'drop'];

export function modeOf(manifest: Manifest, path: string): Mode {
  const kind = NAMED_KINDS.find((k) => path in manifest[k]);
  return kind ? { kind, names: manifest[kind][path]?.names ?? [] } : { kind: 'full', names: [] };
}

function chainText(chain: readonly string[]): string {
  return `\n    import chain: ${chain.join(' → ')}`;
}

export function header(manifest: Manifest, path: string, mode: Mode): string {
  const how = mode.kind === 'full' ? '' : ` · ${mode.kind}: ${mode.names.join(', ')}`;
  return (
    `// Vendored from ${manifest.source} ${manifest.root}/${path} @ ${manifest.sha}${how} — ` +
    'do not edit — scripts/sync-core.ts\n'
  );
}

export function applyEdits(text: string, edits: readonly Edit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce((out, edit) => out.slice(0, edit.start) + edit.text + out.slice(edit.end), text);
}

/** Names taken from a typeOnly/extract module must be ones the manifest lists for it. */
function namedTargetProblems(ref: ModuleRef, target: string, mode: Mode): string[] {
  if (mode.kind !== 'typeOnly' && mode.kind !== 'extract') return [];
  if (mode.kind === 'typeOnly' && !ref.typeOnly) {
    return [`'${ref.spec}' is a value import of ${target}, which is vendored typeOnly`];
  }
  if (ref.names === '*') return [`'${ref.spec}' takes every export of ${target} (${mode.kind})`];
  const missing = ref.names.filter((name) => !mode.names.includes(name));
  return missing.length === 0
    ? []
    : [`${target} is ${mode.kind}: add ${missing.join(', ')} to its names in the manifest`];
}

type LocalTarget = { readonly path: string | undefined; readonly base: string };

function localOutcome(config: VendorConfig, job: Job, ref: ModuleRef, target: LocalTarget) {
  if (target.path === undefined) {
    return { problems: [`${job.path}: cannot resolve '${ref.spec}'${chainText(job.chain)}`] };
  }
  const problems = namedTargetProblems(ref, target.path, modeOf(config.manifest, target.path));
  const isAlias = !ref.spec.startsWith('.');
  const edit = isAlias
    ? { start: ref.start, end: ref.end, text: relativeSpecifier(job.path, target.base) }
    : undefined;
  return {
    edit,
    next: { path: target.path, chain: [...job.chain, target.path] },
    problems: problems.map((p) => `${p}${chainText(job.chain)}`),
  };
}

function packageOutcome(config: VendorConfig, job: Job, ref: ModuleRef, name: string): RefOutcome {
  const chain = chainText(job.chain);
  if (isForbiddenPackage(ref.spec)) {
    return { impure: true, problems: [`${job.path} is impure: it imports '${ref.spec}'${chain}`] };
  }
  const shim = config.manifest.shims[ref.spec];
  if (shim && !ref.typeOnly) {
    return { problems: [`${job.path}: only types may come from shimmed '${ref.spec}'${chain}`] };
  }
  if (shim) {
    const text = relativeSpecifier(webPath(job.path), shim.path);
    return { edit: { start: ref.start, end: ref.end, text }, shim: ref.spec, problems: [] };
  }
  if (config.packages.has(name)) return { problems: [] };
  return {
    problems: [
      `${job.path} imports '${ref.spec}', which the app does not depend on: shim its types ` +
        `(type-only imports) or vendor it another way${chain}`,
    ],
  };
}

function refOutcome(config: VendorConfig, tree: SourceTree, job: Job, ref: ModuleRef): RefOutcome {
  const target = resolveSpec(job.path, ref.spec, config.aliases, tree);
  return target.kind === 'local'
    ? localOutcome(config, job, ref, target)
    : packageOutcome(config, job, ref, target.name);
}

function narrowed(config: VendorConfig, tree: SourceTree, job: Job, mode: Mode, text: string) {
  if (mode.kind === 'full') return { text, problems: [] as string[] };
  const exportsOf = (spec: string) => {
    const target = resolveSpec(job.path, spec, config.aliases, tree);
    return target.kind === 'local' && target.path
      ? exportedNames(target.path, config.aliases, tree)
      : new Set<string>();
  };
  const result = select(analyse(job.path, text), { mode: mode.kind, names: mode.names, exportsOf });
  return { text: result.text, problems: result.problems.map((p) => p + chainText(job.chain)) };
}

function impurityProblem(job: Job, mode: Mode, globals: readonly string[]): string {
  const advice =
    mode.kind === 'full' && job.chain.length > 1
      ? 'list it under typeOnly or extract with only the names the chain needs'
      : 'drop the declarations that use them';
  return `${job.path} is impure: it refers to ${globals.join(', ')}${chainText(job.chain)}\n    → ${advice}`;
}

function vendorFile(config: VendorConfig, tree: SourceTree, job: Job) {
  const source = tree.read(job.path);
  if (source === undefined) {
    return { next: [], shims: [], problems: [`cannot read ${job.path}${chainText(job.chain)}`] };
  }
  const mode = modeOf(config.manifest, job.path);
  const body = narrowed(config, tree, job, mode, source);
  const model = analyse(job.path, body.text);
  const outcomes = moduleRefs(model.sf).map((ref) => refOutcome(config, tree, job, ref));
  const globals = forbiddenGlobals(model);
  const problems = [
    ...body.problems,
    ...outcomes.flatMap((o) => o.problems),
    ...(globals.length > 0 ? [impurityProblem(job, mode, globals)] : []),
  ];
  const edits = outcomes.flatMap((o) => (o.edit ? [o.edit] : []));
  const text = header(config.manifest, job.path, mode) + applyEdits(body.text, edits);
  // an impure file's own imports only lead further from a fix, so the walk stops there
  const impure = globals.length > 0 || outcomes.some((o) => o.impure);
  const next = impure ? [] : outcomes.flatMap((o) => (o.next ? [o.next] : []));
  const shims = outcomes.flatMap((o) => (o.shim ? [o.shim] : []));
  return { file: { path: webPath(job.path), text }, next, shims, problems };
}

function manifestProblems(
  manifest: Manifest,
  reached: ReadonlySet<string>,
  shimsUsed: ReadonlySet<string>,
): string[] {
  // a set entry may be narrowed by extract or drop (its runtime is what the set wants), not typeOnly
  const conflicts = Object.values(manifest.sets)
    .flat()
    .filter((path) => path in manifest.typeOnly)
    .map((path) => `${path} is in a set (vendored for its runtime) and also listed typeOnly`);
  const unused = NAMED_KINDS.flatMap((kind) =>
    Object.keys(manifest[kind])
      .filter((path) => !reached.has(path))
      .map((path) => `manifest ${kind} entry ${path} is never reached: remove it`),
  );
  const unusedShims = Object.keys(manifest.shims)
    .filter((spec) => !shimsUsed.has(spec))
    .map((spec) => `manifest shim for '${spec}' is never used: remove it`);
  return [...conflicts, ...unused, ...unusedShims];
}

export function vendor(config: VendorConfig, tree: SourceTree): VendorResult {
  const roots = [...new Set(Object.values(config.manifest.sets).flat())];
  const queue: Job[] = roots.map((path) => ({ path, chain: [path] }));
  const files = new Map<string, VendoredFile>();
  const problems: string[] = [];
  const shimsUsed = new Set<string>();
  const seen = new Set(roots);
  for (let job = queue.shift(); job; job = queue.shift()) {
    const result = vendorFile(config, tree, job);
    if ('file' in result && result.file) files.set(job.path, result.file);
    problems.push(...result.problems);
    result.shims.forEach((spec) => shimsUsed.add(spec));
    const fresh = result.next.filter((next) => !seen.has(next.path));
    fresh.forEach((next) => seen.add(next.path));
    queue.push(...fresh);
  }
  problems.push(...manifestProblems(config.manifest, seen, shimsUsed));
  return { files: [...files.values()], sources: [...files.keys()], problems };
}
