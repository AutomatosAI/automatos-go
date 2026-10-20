// The web's own unit tests for vendored modules (PRD-001 §4.3, US-003b): every
// __tests__/*.test.ts beside a vendored file that imports a vendored module is copied to the
// mirrored path when it needs nothing but vitest, vendored modules and test fixtures (other
// files under a __tests__/ directory, held to the same rule), runs in node, imports what it
// uses and is pure. Every other one is skipped with its reason (core.lock.json skippedTests),
// so a drift in the web's logic shows here as a red test. Pure: reads only through the tree.
import { posix } from 'node:path';
import ts from 'typescript';

import { analyse, moduleRefs, type FileModel, type ModuleRef } from './ast';
import {
  applyEdits,
  header,
  modeOf,
  type Edit,
  type Mode,
  type VendorConfig,
  type VendoredFile,
} from './closure';
import { webPath, type Manifest } from './manifest';
import { forbiddenGlobals, globalsUsed } from './purity';
import { relativeSpecifier, resolveSpec, type SourceTree } from './resolve';

export type TestsResult = {
  readonly files: VendoredFile[];
  /** `<root>/<test path>` → why it was not copied */
  readonly skipped: Record<string, string>;
  readonly problems: string[];
};

const TESTS_DIR = '__tests__';
const TEST_FILE = /\.test\.ts$/;
const FIXTURE_FILE = /\.ts$/;
/** vitest's globals: the web runs with `globals: true`, this app does not */
const VITEST_GLOBALS = new Set([
  'describe',
  'it',
  'test',
  'suite',
  'expect',
  'vi',
  'beforeAll',
  'beforeEach',
  'afterAll',
  'afterEach',
]);
/** `vi.mock('x')` and friends name a module too; their specifier is checked and rewritten */
const VI_MODULE_CALLS = new Set([
  'mock',
  'doMock',
  'unmock',
  'doUnmock',
  'importActual',
  'importMock',
]);
const ENVIRONMENT = /@vitest-environment\s+([\w-]+)/;
const NODE_ENVIRONMENT = 'node';
/** how many distinct reasons a skipped test's lock line spells out */
const MAX_REASONS = 4;

type Context = {
  readonly config: VendorConfig;
  readonly tree: SourceTree;
  readonly vendored: ReadonlySet<string>;
};

type RefCheck = {
  readonly reason?: string;
  readonly edit?: Edit;
  readonly fixture?: string;
  readonly vendored?: boolean;
};

type FileCheck = {
  readonly reasons: string[];
  readonly text: string;
  readonly fixtures: string[];
  readonly touchesVendored: boolean;
};

const FULL: Mode = { kind: 'full', names: [] };

/** Every *.test.ts in a __tests__/ directory beside a vendored file, sorted. */
export function candidateTests(tree: SourceTree, sources: readonly string[]): string[] {
  const dirs = [...new Set(sources.map((path) => posix.join(posix.dirname(path), TESTS_DIR)))];
  const tests = dirs.flatMap((dir) =>
    tree
      .list(dir)
      .filter((name) => TEST_FILE.test(name))
      .map((name) => `${dir}/${name}`),
  );
  return tests.sort((a, b) => a.localeCompare(b));
}

function viModuleRef(node: ts.Node): ModuleRef | undefined {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
  const { expression, name } = node.expression;
  const [arg] = node.arguments;
  const isVi = ts.isIdentifier(expression) && expression.text === 'vi';
  if (!isVi || !VI_MODULE_CALLS.has(name.text) || !arg || !ts.isStringLiteralLike(arg)) return;
  // a mock replaces the module, so it takes no names from the vendored copy
  return {
    spec: arg.text,
    start: arg.getStart() + 1,
    end: arg.getEnd() - 1,
    typeOnly: false,
    names: [],
  };
}

function viModuleRefs(sf: ts.SourceFile): ModuleRef[] {
  const refs: ModuleRef[] = [];
  const visit = (node: ts.Node): void => {
    const ref = viModuleRef(node);
    if (ref) refs.push(ref);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return refs;
}

/** The environment a `@vitest-environment` docblock at the top of the file asks for. */
function environmentOf(sf: ts.SourceFile): string | undefined {
  const text = sf.getFullText();
  const comments = ts.getLeadingCommentRanges(text, 0) ?? [];
  return comments
    .map((range) => ENVIRONMENT.exec(text.slice(range.pos, range.end))?.[1])
    .find((env) => env !== undefined);
}

/** Why a test cannot take these names from a partially vendored module, if it cannot. */
function namesReason(ref: ModuleRef, target: string, mode: Mode): string | undefined {
  if (mode.kind === 'full' || (ref.names !== '*' && ref.names.length === 0)) return undefined;
  const vendoredAs = `${target}, which is vendored ${mode.kind}: ${mode.names.join(', ')}`;
  if (ref.names === '*') return `takes every export of ${vendoredAs}`;
  const missing =
    mode.kind === 'drop'
      ? ref.names.filter((name) => mode.names.includes(name))
      : ref.names.filter((name) => !mode.names.includes(name));
  return missing.length === 0 ? undefined : `takes ${missing.join(', ')} from ${vendoredAs}`;
}

function isFixture(path: string): boolean {
  return path.split('/').includes(TESTS_DIR) && FIXTURE_FILE.test(path) && !TEST_FILE.test(path);
}

function checkRef(ctx: Context, path: string, ref: ModuleRef): RefCheck {
  if (ref.spec === 'vitest') return {};
  const target = resolveSpec(path, ref.spec, ctx.config.aliases, ctx.tree);
  if (target.kind === 'package') return { reason: `imports the package '${ref.spec}'` };
  if (target.path === undefined) return { reason: `imports '${ref.spec}', which does not resolve` };
  const edit = ref.spec.startsWith('.')
    ? undefined
    : { start: ref.start, end: ref.end, text: relativeSpecifier(path, target.base) };
  if (ctx.vendored.has(target.path)) {
    const reason = namesReason(ref, target.path, modeOf(ctx.config.manifest, target.path));
    return { reason, edit, vendored: true };
  }
  if (isFixture(target.path)) return { edit, fixture: target.path };
  return { reason: `imports '${ref.spec}' (${target.path}), which is not vendored` };
}

function fileReasons(model: FileModel): string[] {
  const env = environmentOf(model.sf);
  const impure = forbiddenGlobals(model);
  const vitestGlobals = globalsUsed(model, VITEST_GLOBALS);
  return [
    ...(env !== undefined && env !== NODE_ENVIRONMENT ? [`runs in the ${env} environment`] : []),
    ...(impure.length > 0 ? [`refers to ${impure.join(', ')}`] : []),
    ...(vitestGlobals.length > 0
      ? [`uses vitest's globals without importing them: ${vitestGlobals.join(', ')}`]
      : []),
  ];
}

function checkFile(ctx: Context, path: string, source: string): FileCheck {
  const model = analyse(path, source);
  const checks = [...moduleRefs(model.sf), ...viModuleRefs(model.sf)].map((ref) =>
    checkRef(ctx, path, ref),
  );
  const edits = checks.flatMap((check) => (check.edit ? [check.edit] : []));
  return {
    reasons: [...checks.flatMap((c) => (c.reason ? [c.reason] : [])), ...fileReasons(model)],
    text: header(ctx.config.manifest, path, FULL) + applyEdits(source, edits),
    fixtures: checks.flatMap((c) => (c.fixture ? [c.fixture] : [])),
    touchesVendored: checks.some((c) => c.vendored),
  };
}

type Copy = { readonly files: VendoredFile[]; readonly reasons: string[] };

/** The test with every fixture it reaches, transitively; a fixture's reasons name it. */
function copyWithFixtures(ctx: Context, test: string, first: FileCheck): Copy {
  const files: VendoredFile[] = [{ path: webPath(test), text: first.text }];
  const reasons = [...first.reasons];
  const queue = [...first.fixtures];
  const seen = new Set([test, ...queue]);
  for (let fixture = queue.shift(); fixture; fixture = queue.shift()) {
    const source = ctx.tree.read(fixture);
    if (source === undefined) {
      reasons.push(`its fixture ${fixture} cannot be read`);
      continue;
    }
    const check = checkFile(ctx, fixture, source);
    files.push({ path: webPath(fixture), text: check.text });
    reasons.push(...check.reasons.map((reason) => `its fixture ${fixture} ${reason}`));
    const fresh = check.fixtures.filter((next) => !seen.has(next));
    fresh.forEach((next) => seen.add(next));
    queue.push(...fresh);
  }
  return { files, reasons };
}

/** One line for the lock: the distinct reasons, the first few in full. */
function summary(reasons: readonly string[]): string {
  const distinct = [...new Set(reasons)];
  const shown = distinct.slice(0, MAX_REASONS).join('; ');
  const more = distinct.length - MAX_REASONS;
  return more > 0 ? `${shown}; and ${more} more` : shown;
}

type Outcome =
  | { readonly kind: 'ignored' }
  | { readonly kind: 'copied'; readonly files: VendoredFile[] }
  | { readonly kind: 'skipped'; readonly reason: string; readonly byHand: boolean };

function outcomeOf(ctx: Context, test: string): Outcome {
  const source = ctx.tree.read(test);
  const first = source === undefined ? undefined : checkFile(ctx, test, source);
  // a test that imports no vendored module is not a test of one
  if (!first?.touchesVendored) return { kind: 'ignored' };
  const copy = copyWithFixtures(ctx, test, first);
  if (copy.reasons.length > 0) {
    return { kind: 'skipped', reason: summary(copy.reasons), byHand: false };
  }
  const byHand = ctx.config.manifest.skipTests[test];
  return byHand
    ? { kind: 'skipped', reason: byHand, byHand: true }
    : { kind: 'copied', files: copy.files };
}

function skipProblems(manifest: Manifest, outcomes: ReadonlyMap<string, Outcome>): string[] {
  return Object.keys(manifest.skipTests).flatMap((test) => {
    const outcome = outcomes.get(test);
    if (outcome === undefined || outcome.kind === 'ignored') {
      return [`manifest skipTests entry ${test} is not a web test of a vendored module: remove it`];
    }
    return outcome.kind === 'skipped' && !outcome.byHand
      ? [`manifest skipTests entry ${test} is skipped anyway (${outcome.reason}): remove it`]
      : [];
  });
}

/** Copies (or skips, with the reason) every web test of a vendored module. */
export function vendorTests(
  config: VendorConfig,
  tree: SourceTree,
  sources: readonly string[],
): TestsResult {
  const ctx: Context = { config, tree, vendored: new Set(sources) };
  const outcomes = new Map(
    candidateTests(tree, sources).map((test) => [test, outcomeOf(ctx, test)]),
  );
  const files = new Map<string, VendoredFile>();
  const skipped: Record<string, string> = {};
  for (const [test, outcome] of outcomes) {
    if (outcome.kind === 'copied') outcome.files.forEach((file) => files.set(file.path, file));
    if (outcome.kind === 'skipped') skipped[`${config.manifest.root}/${test}`] = outcome.reason;
  }
  return { files: [...files.values()], skipped, problems: skipProblems(config.manifest, outcomes) };
}
