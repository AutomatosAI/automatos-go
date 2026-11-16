// The first release, as code (docs/release/README.md, "First release"). It makes sure the app's
// builds reach testers: an internal TestFlight group with automatic distribution, which takes every
// build the delivery uploads.
//
//   node scripts/release/first-release.mjs            what it finds, and what it would do
//   node scripts/release/first-release.mjs --apply    the same, and it does it
//
// Options: --profile <eas.json submit profile> (default testflight), --group <name> (default
// "Team (Expo)", the name eas-cli gives the group it makes). Needs a team App Store Connect API key
// in EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID and EXPO_ASC_ISSUER_ID (scripts/release/asc.mjs).
//
// Why it exists: eas-cli makes the group on its own only when it creates the app in App Store
// Connect, or, with an ascAppId in eas.json, when the app has no group at all and eas-cli can sign
// in to App Store Connect (eas-cli 27.10.0, submit/ios/ensureTestFlightSetup). When it cannot, it
// prints "skipping TestFlight setup", the upload still succeeds, and the build reaches no one.
//
// Idempotent: it creates a group only when the app has no internal group with automatic
// distribution, and it never changes or deletes a group. It adds no testers: that is an App Store
// Connect step, which it names when the group has none. Exit 0: done, or nothing to do, or (without
// --apply) what it would do; exit 1: it cannot go on, with the reason on one line.

import { existsSync, realpathSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { ascClient, deliveringGroup, readAscKey, tokenFromEnv } from './asc.mjs';
import { APP_ROOT, DEFAULT_PROFILE, readProject } from './project.mjs';

/** The name eas-cli gives the group it creates (credentials/ios/appstore/ensureTestFlightGroup). */
export const DEFAULT_GROUP = 'Team (Expo)';
export const README = 'docs/release/README.md, "First release"';
const USAGE =
  'usage: node scripts/release/first-release.mjs [--apply] [--profile <name>] [--group <name>]';

/** A step that cannot go on (exit 1). */
export class FirstReleaseError extends Error {}

const messageOf = (error) => (error instanceof Error ? error.message : String(error));

/** --apply, --profile and --group, or an error naming what is wrong. */
export function parseArgs(argv) {
  const options = { apply: false, profile: DEFAULT_PROFILE, group: DEFAULT_GROUP };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--apply') {
      options.apply = true;
    } else if (flag === '--profile' || flag === '--group') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--') || value.trim() === '') {
        throw new FirstReleaseError(`${flag} needs a value. ${USAGE}`);
      }
      options[flag.slice(2)] = value;
      index += 1;
    } else {
      throw new FirstReleaseError(`unknown option ${flag}. ${USAGE}`);
    }
  }
  return Object.freeze(options);
}

/** The lines for an app App Store Connect does not have yet: eas submit creates it, group and all. */
function newApp(project, io) {
  io.out(
    `found: no ascAppId in eas.json submit.${project.profile}.ios: the app is not in App Store Connect yet.`,
  );
  io.out(
    'to do: let the first eas submit create the app, so its internal TestFlight group comes with it',
  );
  io.out(`to do: then put the new ascAppId in eas.json and run this again (${README}).`);
  return 1;
}

async function readTheApp(client, project, io) {
  const app = await client.app(project.ascAppId);
  io.out(`found: App Store Connect app "${app.name}" (${app.bundleId})`);
  if (app.bundleId !== project.bundleId) {
    throw new FirstReleaseError(
      `eas.json's ascAppId is the app ${app.bundleId}, not app.json's ${project.bundleId}: fix eas.json first`,
    );
  }
}

/** The delivering group, made when there is none and --apply is given; undefined on a dry run. */
async function ensureGroup(client, project, options, io) {
  const groups = await client.groups(project.ascAppId);
  const found = deliveringGroup(groups);
  if (found) {
    io.out(`found: internal TestFlight group "${found.name}" with automatic distribution`);
    return found;
  }
  if (groups.some((group) => group.name === options.group)) {
    throw new FirstReleaseError(
      `the group "${options.group}" exists but does not show as internal with automatic distribution, which App Store Connect's API cannot switch on: turn on automatic distribution for it in App Store Connect (TestFlight), or run this with --group <another name>`,
    );
  }
  io.out(
    `found: no internal TestFlight group with automatic distribution (${groups.length} group(s) in all)`,
  );
  if (!options.apply) {
    io.out(
      `would create: internal TestFlight group "${options.group}" with automatic distribution (run again with --apply)`,
    );
    return undefined;
  }
  const created = await client.createInternalGroup(project.ascAppId, options.group);
  if (!created.internal || !created.allBuilds) {
    throw new FirstReleaseError(
      `App Store Connect made "${created.name}" without automatic distribution`,
    );
  }
  io.out(`created: internal TestFlight group "${created.name}" with automatic distribution`);
  return created;
}

async function reportTesters(client, group, io) {
  const count = await client.testerCount(group.id);
  io.out(`found: "${group.name}" has ${count} tester(s)`);
  if (count === 0) {
    io.out(
      `to do: add the team's App Store Connect users to "${group.name}" (App Store Connect, TestFlight, the group, Testers): until then a build reaches no one`,
    );
  }
}

/**
 * The first release: its exit code. `transport` and `readKey` are for tests.
 * @param {{ argv?: string[], env?: Record<string, string | undefined>, root?: string, transport?: Function, readKey?: Function, now?: number, io?: { out: (line: string) => void, err: (line: string) => void } }} [options]
 */
export async function run(options = {}) {
  const io = options.io ?? defaultIo();
  try {
    const args = parseArgs(options.argv ?? process.argv.slice(2));
    const project = readProject({ root: options.root ?? APP_ROOT, profile: args.profile });
    if (!project.ascAppId) return newApp(project, io);
    const env = options.env ?? process.env;
    const key = readAscKey(env);
    if (!key.ok) throw new FirstReleaseError(key.why);
    const token = tokenFromEnv(env, { readKey: options.readKey, now: options.now });
    const client = ascClient({ token, transport: options.transport });
    await readTheApp(client, project, io);
    const group = await ensureGroup(client, project, args, io);
    if (group) await reportTesters(client, group, io);
    return 0;
  } catch (error) {
    io.err(`FAIL: ${messageOf(error)}`);
    return 1;
  }
}

function defaultIo() {
  return {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
  };
}

// Node runs the main module from its real path, so compare real paths (a symlinked checkout).
function invokedDirectly() {
  const entry = process.argv[1];
  return (
    entry !== undefined &&
    existsSync(entry) &&
    pathToFileURL(realpathSync(entry)).href === import.meta.url
  );
}

if (invokedDirectly()) process.exitCode = await run();
