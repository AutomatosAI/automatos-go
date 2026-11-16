// The release state check (docs/release/README.md, "State check"). Read-only: it changes nothing in
// App Store Connect or on EAS. One line per check, plain text:
//
//   <check>: ok: <what it found>
//   <check>: FAIL: <what is wrong>
//   <check>: not checked: <why it could not look>
//
//   node scripts/release/state.mjs [--profile <eas.json submit profile>] [--workflow <file>]
//
// The checks, in order:
//   testflight-group    App Store Connect has an internal TestFlight group with automatic
//                       distribution for the app (eas.json's ascAppId)
//   testflight-testers  that group has testers
//   testflight-build    the app's newest build is processed and ready for internal testers
//                       (its TestFlight state), so the group, which takes every build, has it
//   eas-env:<name>      each EAS environment holds every name docs/release/eas-env.json lists
//                       (names only: eas env:list's values are never printed)
//   workflow-run        the delivery workflow's latest run did not fail, or fail to start
//   build-quota         iOS builds left this cycle (eas account:usage)
//   cicd-minutes        the plan's CI/CD minutes, when eas account:usage reports them
//
// The App Store Connect checks need a team API key (EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID,
// EXPO_ASC_ISSUER_ID); the EAS checks need eas-cli signed in (eas login, or EXPO_TOKEN). Without
// them a check says "not checked" and why, and never passes. In GitHub CI, which holds neither by
// design (docs/app-standard.md 14.4), every line says not checked. Exit 1 when any line says FAIL,
// or when the app's own files cannot be read; otherwise 0.

import { existsSync, realpathSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { ascClient, deliveringGroup, readAscKey, tokenFromEnv, unclearGroup } from './asc.mjs';
import {
  APP_ROOT,
  DEFAULT_PROFILE,
  DEFAULT_WORKFLOW,
  readEnvList,
  readProject,
} from './project.mjs';
import { easLines, line } from './state-eas.mjs';

export const ASC_CHECKS = Object.freeze([
  'testflight-group',
  'testflight-testers',
  'testflight-build',
]);
const FIX_GROUP = 'run node scripts/release/first-release.mjs --apply';
const USAGE = 'usage: node scripts/release/state.mjs [--profile <name>] [--workflow <file>]';

const messageOf = (error) => (error instanceof Error ? error.message : String(error));

/** --profile and --workflow, or an error naming what is wrong. */
export function parseArgs(argv) {
  const pairs = { '--profile': 'profile', '--workflow': 'workflowFile' };
  const options = { profile: DEFAULT_PROFILE, workflowFile: DEFAULT_WORKFLOW };
  for (let index = 0; index < argv.length; index += 2) {
    const key = pairs[argv[index]];
    const value = argv[index + 1];
    if (key === undefined) throw new Error(`unknown option ${argv[index]}. ${USAGE}`);
    if (value === undefined || value.startsWith('--') || value.trim() === '') {
      throw new Error(`${argv[index]} needs a value. ${USAGE}`);
    }
    options[key] = value;
  }
  return Object.freeze(options);
}

const notChecked = (why, checks = ASC_CHECKS) =>
  checks.map((check) => line(check, 'not checked', why));

/** What each internal TestFlight state means for the newest build: [verdict, words]. */
const BETA_STATES = Object.freeze({
  READY_FOR_BETA_TESTING: ['ok', 'is ready for testers'],
  IN_BETA_TESTING: ['ok', 'is in testing'],
  PROCESSING: ['ok', 'is still processing for TestFlight'],
  MISSING_EXPORT_COMPLIANCE: [
    'FAIL',
    'waits for its export compliance answer in App Store Connect',
  ],
  IN_EXPORT_COMPLIANCE_REVIEW: ['FAIL', "waits for Apple's export compliance review"],
  PROCESSING_EXCEPTION: ['FAIL', 'did not process for TestFlight'],
  EXPIRED: ['FAIL', 'has expired'],
});

/** The newest build, by its processing and then its TestFlight state for internal testers. */
function buildLine(newest, betaState, group) {
  const check = 'testflight-build';
  if (newest === undefined) return line(check, 'FAIL', 'App Store Connect has no build of the app');
  const name = `newest build ${newest.version}`;
  if (newest.expired) return line(check, 'FAIL', `${name} has expired: testers cannot install it`);
  if (newest.state === 'PROCESSING') return line(check, 'ok', `${name} is still processing`);
  if (newest.state !== 'VALID') {
    return line(
      check,
      'FAIL',
      `${name} (${newest.state}) did not process: testers cannot install it`,
    );
  }
  const [verdict, words] = BETA_STATES[betaState] ?? ['FAIL', `is ${betaState} for TestFlight`];
  const reach =
    verdict === 'ok' ? `"${group.name}" takes every build` : 'testers cannot install it';
  return line(check, verdict, `${name} ${words} (${betaState}): ${reach}`);
}

async function groupLines(client, appId) {
  const groups = await client.groups(appId);
  const group = deliveringGroup(groups);
  const unclear = group ? undefined : unclearGroup(groups);
  if (unclear) {
    return [
      line(
        'testflight-group',
        'FAIL',
        `check automatic distribution for group "${unclear.name}" in App Store Connect: its API does not say whether the group has it`,
      ),
      ...notChecked('no group is known to deliver the builds', ASC_CHECKS.slice(1)),
    ];
  }
  if (!group) {
    return [
      line(
        'testflight-group',
        'FAIL',
        `no internal TestFlight group with automatic distribution (${groups.length} group(s) in all), so a build reaches no tester: ${FIX_GROUP}`,
      ),
      ...notChecked('no group delivers the builds', ASC_CHECKS.slice(1)),
    ];
  }
  const testers = await client.testerCount(group.id);
  const newest = await client.newestBuild(appId);
  const betaState = newest?.state === 'VALID' ? await client.internalState(newest.id) : undefined;
  return [
    line('testflight-group', 'ok', `"${group.name}" is internal, with automatic distribution`),
    testers > 0
      ? line('testflight-testers', 'ok', `"${group.name}" has ${testers} tester(s)`)
      : line(
          'testflight-testers',
          'FAIL',
          `"${group.name}" has no testers: add the team's App Store Connect users to it`,
        ),
    buildLine(newest, betaState, group),
  ];
}

/** The App Store Connect lines. `transport` and `readKey` are for tests. */
export async function ascLines({ project, env, transport, readKey, now }) {
  if (!project.ascAppId) {
    return [
      line(
        'testflight-group',
        'FAIL',
        `eas.json submit.${project.profile}.ios has no ascAppId: the app is not in App Store Connect yet (docs/release/README.md, "First release")`,
      ),
      ...notChecked('the app is not in App Store Connect yet', ASC_CHECKS.slice(1)),
    ];
  }
  const key = readAscKey(env);
  if (!key.ok) return notChecked(key.why);
  try {
    const client = ascClient({ token: tokenFromEnv(env, { readKey, now }), transport });
    return await groupLines(client, project.ascAppId);
  } catch (error) {
    return notChecked(`App Store Connect: ${messageOf(error)}`);
  }
}

/**
 * The check: its exit code.
 * @param {{ argv?: string[], env?: Record<string, string | undefined>, root?: string, transport?: Function, readKey?: Function, exec?: Function, tmp?: string, now?: number, io?: { out: (line: string) => void, err: (line: string) => void } }} [options]
 */
export async function run(options = {}) {
  const io = options.io ?? defaultIo();
  const env = options.env ?? process.env;
  try {
    const args = parseArgs(options.argv ?? process.argv.slice(2));
    const root = options.root ?? APP_ROOT;
    const project = readProject({ root, profile: args.profile });
    const envList = readEnvList({ root });
    const lines = [
      ...(await ascLines({ project, env, ...pick(options, ['transport', 'readKey', 'now']) })),
      ...(await easLines({
        project,
        envList,
        workflowFile: args.workflowFile,
        env,
        exec: options.exec,
        tmp: options.tmp,
      })),
    ];
    lines.forEach((each) => io.out(each));
    return lines.some((each) => each.includes(': FAIL: ')) ? 1 : 0;
  } catch (error) {
    io.err(`release-state: FAIL: ${messageOf(error)}`);
    return 1;
  }
}

const pick = (source, names) => Object.fromEntries(names.map((name) => [name, source[name]]));

function defaultIo() {
  return {
    out: (text) => process.stdout.write(`${text}\n`),
    err: (text) => process.stderr.write(`${text}\n`),
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
