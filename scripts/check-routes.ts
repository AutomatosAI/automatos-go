// check-routes (K4, US-004c): every server path the app calls exists on automatos-ai at the
// pinned SHA. It loads every src/**/routes.ts route table, normalises path parameters and checks
// each {method, path} against src/core/route-manifest.json (copied by scripts/sync-core.ts).
// A route marked pendingUpstream: 'PRD-266 US-0xx' passes and is listed; any other miss fails.
//
//   npx tsx scripts/check-routes.ts      (npm run check:routes)
//
// The engine is scripts/check-routes/match.ts (pure, tested in
// scripts/__tests__/check-routes.test.ts); this file reads, loads, prints and exits.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  checkRoutes,
  collectRoutes,
  formatReport,
  isRouteTableFile,
  ROUTE_MANIFEST_PATH,
  routeManifestSchema,
  type Collected,
} from './check-routes/match';
import { listFiles } from './sync-core/source';

const REPO = path.resolve(__dirname, '..');

// CLI output goes to stdout/stderr directly (eslint's no-console holds here too).
function say(stream: NodeJS.WriteStream, line: string): void {
  stream.write(`[check-routes] ${line}\n`);
}

function fail(problems: readonly string[]): never {
  for (const problem of problems) say(process.stderr, problem);
  process.exit(1);
}

async function load(file: string): Promise<Collected> {
  try {
    const exports: Record<string, unknown> = await import(
      pathToFileURL(path.join(REPO, file)).href
    );
    return collectRoutes(file, exports);
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    return { routes: [], problems: [`cannot load ${file}: ${why}`] };
  }
}

async function main(): Promise<void> {
  const text = fs.readFileSync(path.join(REPO, ROUTE_MANIFEST_PATH), 'utf8');
  const manifest = routeManifestSchema.parse(JSON.parse(text));
  const files = listFiles(REPO, 'src').filter(isRouteTableFile).sort();
  if (files.length === 0) fail(['no src/**/routes.ts route table found']);
  const tables = await Promise.all(files.map(load));
  const problems = tables.flatMap((table) => table.problems);
  if (problems.length > 0) fail(problems);
  const routes = tables.flatMap((table) => table.routes);
  const { lines, ok } = formatReport(checkRoutes(routes, manifest));
  const against = `${ROUTE_MANIFEST_PATH} (${manifest.route_count} server routes)`;
  say(process.stdout, `checking ${files.join(', ')} against ${against}`);
  for (const line of lines) say(ok ? process.stdout : process.stderr, line);
  if (!ok) fail(['routes missing on the server: add them upstream or mark them pendingUpstream']);
}

main().catch((error: unknown) => fail([error instanceof Error ? error.message : String(error)]));
