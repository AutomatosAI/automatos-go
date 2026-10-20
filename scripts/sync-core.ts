// sync-core (PRD-001 §4.3, K1, K2, D-CORE): vendors the web's pure logic from an automatos-ai
// checkout at the pinned SHA into src/core/web/ and records it in core.lock.json.
//
//   npx tsx scripts/sync-core.ts --source <automatos-ai checkout>   vendor and write the lock
//   npx tsx scripts/sync-core.ts --check                            (npm run check:core) drift check
//
// --check needs no checkout: it compares src/core/web with the lock. The engine lives in
// scripts/sync-core/ (pure, tested in scripts/__tests__/sync-core.test.ts); this file does the
// reading, the writing and the exit codes.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { vendor, type VendoredFile } from './sync-core/closure';
import {
  buildLock,
  checkLock,
  lockSchema,
  LOCK_PATH,
  MANIFEST_PATH,
  manifestSchema,
  WEB_DIR,
  type Manifest,
} from './sync-core/manifest';
import { checkoutProblems, fsTree, listFiles, readAliases, readPackages } from './sync-core/source';
import { vendorTests } from './sync-core/tests';

const REPO = path.resolve(__dirname, '..');

// CLI output goes to stdout/stderr directly (eslint's no-console holds here too).
function say(stream: NodeJS.WriteStream, line: string): void {
  stream.write(`[sync-core] ${line}\n`);
}

function fail(problems: readonly string[]): never {
  for (const problem of problems) say(process.stderr, problem);
  process.exit(1);
}

function readJson(relative: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(REPO, relative), 'utf8'));
}

function readManifest(): Manifest {
  return manifestSchema.parse(readJson(MANIFEST_PATH));
}

function writeFiles(files: readonly VendoredFile[]): void {
  fs.rmSync(path.join(REPO, WEB_DIR), { recursive: true, force: true });
  for (const file of files) {
    const target = path.join(REPO, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.text);
  }
}

function sync(checkout: string): void {
  const manifest = readManifest();
  const source = path.resolve(checkout);
  const refused = checkoutProblems(source, manifest.sha, manifest.root);
  if (refused.length > 0) fail(refused);
  const sourceRoot = path.join(source, manifest.root);
  const config = { manifest, aliases: readAliases(sourceRoot), packages: readPackages(REPO) };
  const tree = fsTree(sourceRoot);
  const modules = vendor(config, tree);
  const tests = vendorTests(config, tree, modules.sources);
  const problems = [...modules.problems, ...tests.problems];
  if (problems.length > 0) fail([...problems, `${problems.length} problem(s): nothing written`]);
  const files = [...modules.files, ...tests.files];
  writeFiles(files);
  const lock = buildLock(manifest, files, new Date().toISOString(), tests.skipped);
  fs.writeFileSync(path.join(REPO, LOCK_PATH), `${JSON.stringify(lock, null, 2)}\n`);
  const skipped = Object.keys(tests.skipped).length;
  say(process.stdout, `vendored ${files.length} files from ${manifest.source}@${manifest.sha}`);
  say(
    process.stdout,
    `${tests.files.length} of them are web tests and fixtures; ${skipped} tests skipped`,
  );
}

function check(): void {
  const manifest = readManifest();
  const lock = lockSchema.parse(readJson(LOCK_PATH));
  const outside = Object.keys(lock.files).filter((p) => !p.startsWith(`${WEB_DIR}/`));
  const present = [...listFiles(REPO, WEB_DIR), ...outside].filter((p) =>
    fs.existsSync(path.join(REPO, p)),
  );
  const files = new Map(present.map((p) => [p, fs.readFileSync(path.join(REPO, p), 'utf8')]));
  const problems = checkLock(manifest, lock, files);
  if (problems.length > 0) fail([...problems, 'src/core/web has drifted from core.lock.json']);
  say(process.stdout, `${Object.keys(lock.files).length} files match ${LOCK_PATH} (${lock.sha})`);
}

function main(): void {
  const { values } = parseArgs({
    options: { source: { type: 'string' }, check: { type: 'boolean' } },
    strict: true,
  });
  if (values.check && values.source === undefined) return check();
  if (values.source !== undefined && !values.check) return sync(values.source);
  fail(['usage: sync-core.ts --source <automatos-ai checkout> | --check']);
}

try {
  main();
} catch (error) {
  fail([error instanceof Error ? error.message : String(error)]);
}
