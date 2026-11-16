// The release state check (scripts/release/state.mjs, docs/release/README.md "State check"), over a
// fake App Store Connect and a fake eas-cli: nothing here talks to Apple or Expo. One line per
// check; a check without its credentials says "not checked" and never passes. It also holds the
// committed list of EAS names to the names the app reads, and rule 14.7's files to the template
// (docs/app-standard.md). The EAS lines' own cases are in release-state-eas.test.ts.

import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { afterAll, describe, expect, it } from 'vitest';

import easJson from '../../eas.json';
import { ENV_NAMES } from '../../src/lib/env';
import { readRepoFile, repoRoot } from '../../src/release/__tests__/support/tree';
import { EAS_CLI, spawnExec } from '../release/eas.mjs';
import { readEnvList } from '../release/project.mjs';
import { parseArgs } from '../release/state.mjs';
import { FAKE_OWNER, FAKE_PROJECT, PLANTED, fakeApp, scratchFolder } from './release-fixtures';
import { GOOD_ASC, GOOD_EAS, LINE, stateRunner } from './release-state-harness';

const scratch = scratchFolder('release-state-');
afterAll(scratch.cleanup);
const state = stateRunner(scratch.dir);

describe('state.mjs: a release in order', () => {
  it('says ok on every check, one plain line each, and exits 0', async () => {
    const result = await state(GOOD_ASC, GOOD_EAS);
    expect(result.code).toBe(0);
    expect(result.lines).toEqual([
      'testflight-group: ok: "Team" is internal, with automatic distribution',
      'testflight-testers: ok: "Team" has 2 tester(s)',
      'testflight-build: ok: newest build 12 (VALID) is in "Team"',
      'eas-env:preview: ok: EAS environment preview holds the 2 names docs/release/eas-env.json lists',
      'eas-env:production: ok: EAS environment production holds the 2 names docs/release/eas-env.json lists',
      'workflow-run: ok: latest run run-1 succeeded (2026-11-16)',
      'build-quota: ok: iOS builds 9 of 15 used this cycle, 6 left (the cycle ends 2026-12-01)',
      'cicd-minutes: ok: CI/CD minutes 20 of 60 used (workflows 20) (the cycle ends 2026-12-01)',
    ]);
    result.lines.forEach((each) => expect(each).toMatch(LINE));
    expect(result.printed).not.toContain(PLANTED);
  });

  it('reads the GET routes only: it changes nothing in App Store Connect', async () => {
    const result = await state(GOOD_ASC, GOOD_EAS);
    expect(new Set(result.asc.map((request) => request.method))).toEqual(new Set(['GET']));
  });

  it('runs eas-cli through npx, pinned, in a folder that holds only the EAS link, removed after', async () => {
    const result = await state(GOOD_ASC, GOOD_EAS);
    const [first] = result.calls;
    expect(first.command).toBe('npx');
    expect(first.args.slice(0, 2)).toEqual(['--yes', EAS_CLI]);
    expect(first.appJson).toEqual({
      expo: {
        name: 'Example Go',
        slug: 'example-go',
        owner: FAKE_OWNER,
        extra: { eas: { projectId: FAKE_PROJECT } },
      },
    });
    expect(result.calls.every((call) => call.cwd === first.cwd)).toBe(true);
    expect(existsSync(first.cwd)).toBe(false);
    expect(first.env.FORCE_COLOR).toBe('0');
  });

  it("asks eas for each environment in both scopes, the runs of the delivery, and the owner's usage", async () => {
    const result = await state(GOOD_ASC, GOOD_EAS);
    const commands = result.calls.map((call) => call.args.slice(2).join(' '));
    expect(commands).toEqual([
      'whoami',
      'env:list --environment preview --format short --scope project',
      'env:list --environment preview --format short --scope account',
      'env:list --environment production --format short --scope project',
      'env:list --environment production --format short --scope account',
      'workflow:runs --workflow testflight.yml --limit 1 --json',
      `account:usage ${FAKE_OWNER} --json --non-interactive`,
    ]);
  });

  it('takes --workflow and --profile', async () => {
    expect(parseArgs(['--workflow', 'ship.yml', '--profile', 'beta'])).toEqual({
      profile: 'beta',
      workflowFile: 'ship.yml',
    });
    expect(() => parseArgs(['--workflow'])).toThrow('--workflow needs a value');
    expect(() => parseArgs(['--apply'])).toThrow('unknown option --apply');
  });
});

describe('state.mjs: TestFlight', () => {
  it('fails when no group delivers the builds, pointing at first-release.mjs', async () => {
    const asc = {
      ...GOOD_ASC,
      groups: [{ id: 'x', name: 'Picked', internal: true, allBuilds: false }],
    };
    const result = await state(asc, GOOD_EAS);
    expect(result.code).toBe(1);
    expect(result.lineOf('testflight-group')).toBe(
      'testflight-group: FAIL: no internal TestFlight group with automatic distribution (1 group(s) in all), so a build reaches no tester: run node scripts/release/first-release.mjs --apply',
    );
    expect(result.lineOf('testflight-testers')).toBe(
      'testflight-testers: not checked: no group delivers the builds',
    );
  });

  it.each([
    [
      'no testers',
      { testers: { g1: 0 } },
      'testflight-testers',
      'FAIL: "Team" has no testers: add the team\'s App Store Connect users to it',
    ],
    [
      'no build',
      { builds: [] },
      'testflight-build',
      'FAIL: App Store Connect has no build of the app',
    ],
    [
      'a build not in the group',
      { inGroup: { g1: [] } },
      'testflight-build',
      'FAIL: newest build 12 (VALID) is not in "Team": it reaches no tester',
    ],
    [
      'a build that expired',
      { builds: [{ id: 'b2', version: '12', state: 'VALID', expired: true }] },
      'testflight-build',
      'FAIL: newest build 12 (VALID) has expired: testers cannot install it',
    ],
    [
      'a build that failed',
      { builds: [{ id: 'b2', version: '12', state: 'INVALID' }] },
      'testflight-build',
      'FAIL: newest build 12 (INVALID) did not process: testers cannot install it',
    ],
    [
      'a build still processing',
      { builds: [{ id: 'b3', version: '13', state: 'PROCESSING' }] },
      'testflight-build',
      'ok: newest build 13 (PROCESSING) is still processing',
    ],
  ])('reads %s', async (_, change, check, verdict) => {
    const result = await state({ ...GOOD_ASC, ...change }, GOOD_EAS);
    expect(result.lineOf(check)).toBe(`${check}: ${verdict}`);
  });

  it('fails a new app (no ascAppId), and asks App Store Connect nothing', async () => {
    const result = await state(GOOD_ASC, GOOD_EAS, {
      root: fakeApp(scratch.dir, { ascAppId: null }),
    });
    expect(result.lineOf('testflight-group')).toContain(
      'testflight-group: FAIL: eas.json submit.testflight.ios has no ascAppId',
    );
    expect(result.asc).toEqual([]);
  });
});

describe('state.mjs: without credentials it says so, and never passes a check', () => {
  it('says not checked for App Store Connect without a key, naming the variables', async () => {
    const result = await state(GOOD_ASC, GOOD_EAS, { env: {} });
    expect(result.lines.slice(0, 3)).toEqual(
      ['testflight-group', 'testflight-testers', 'testflight-build'].map(
        (check) =>
          `${check}: not checked: no App Store Connect key (EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID, EXPO_ASC_ISSUER_ID unset)`,
      ),
    );
    expect(result.asc).toEqual([]);
  });

  it("says not checked on App Store Connect's refusal", async () => {
    const result = await state(
      { groups: [], failWith: { status: 401, title: 'Unauthorized' } },
      GOOD_EAS,
    );
    expect(result.lineOf('testflight-group')).toBe(
      'testflight-group: not checked: App Store Connect: list the TestFlight groups: App Store Connect answered HTTP 401 (NOT_AUTHORIZED: Unauthorized)',
    );
  });

  it.each([
    [
      'eas is not signed in',
      { whoami: 1 },
      'not signed in to Expo (eas whoami failed): npx eas-cli login, or set EXPO_TOKEN',
    ],
    ['eas-cli cannot start', { throws: true }, 'eas-cli did not start (npx --yes eas-cli)'],
  ])('says not checked for every EAS line when %s', async (_, eas, why) => {
    const result = await state(GOOD_ASC, eas);
    const easLines = result.lines.slice(3);
    expect(easLines).toEqual(
      ['eas-env:preview', 'eas-env:production', 'workflow-run', 'build-quota', 'cicd-minutes'].map(
        (check) => `${check}: not checked: ${why}`,
      ),
    );
    expect(result.code).toBe(0);
  });

  it('says not checked for EAS when app.json has no EAS link, and runs no eas', async () => {
    const result = await state(GOOD_ASC, GOOD_EAS, { root: fakeApp(scratch.dir, { link: false }) });
    expect(result.lineOf('workflow-run')).toBe(
      'workflow-run: not checked: app.json has no EAS link (owner, slug, extra.eas.projectId)',
    );
    expect(result.calls).toEqual([]);
  });

  it('as GitHub CI sees it (no key, no Expo sign-in): every line not checked, exit 0', async () => {
    const result = await state(undefined, { whoami: 1 }, { env: {} });
    expect(result.lines).toHaveLength(8);
    result.lines.forEach((each) => expect(each).toMatch(/: not checked: /));
    expect(result.code).toBe(0);
  });

  it("fails, on one line, when the app's own list cannot be read", async () => {
    const result = await state(GOOD_ASC, GOOD_EAS, {
      root: fakeApp(scratch.dir, { envList: { environments: {} } }),
    });
    expect(result.code).toBe(1);
    expect(result.err).toEqual([
      'release-state: FAIL: docs/release/eas-env.json: no environment listed',
    ]);
  });
});

describe('eas.mjs spawnExec', () => {
  it('closes stdin, so an eas prompt can never wait for a person', async () => {
    const script =
      'process.stdin.resume();process.stdin.on("end",()=>process.stdout.write("closed"))';
    const result = await spawnExec(process.execPath, ['-e', script], {
      cwd: scratch.dir,
      env: process.env,
      timeoutMs: 10_000,
    });
    expect(result).toEqual({ code: 0, stdout: 'closed', stderr: '' });
  });
});

// docs/app-standard.md 14.7: the release steps come from the template's files, copied.
describe('the template release files (rule 14.7)', () => {
  const list = readEnvList({ root: repoRoot() });

  it("lists, for each EAS environment the app's builds read, exactly the names src/lib/env.ts reads", () => {
    const names = [...Object.values(ENV_NAMES)].sort();
    expect(Object.keys(list).sort()).toEqual(['preview', 'production']);
    expect(Object.keys(list)).toContain(easJson.build.testflight.environment);
    expect(Object.keys(list)).toContain(easJson.build.production.environment);
    Object.values(list).forEach((each) => expect([...each].sort()).toEqual(names));
  });

  it('keeps every file a copy takes, and the README sections they are run from', () => {
    const files = [
      'scripts/release/first-release.mjs',
      'scripts/release/state.mjs',
      'scripts/release/state-eas.mjs',
      'scripts/release/asc.mjs',
      'scripts/release/eas.mjs',
      'scripts/release/project.mjs',
      'docs/release/eas-env.json',
      '.eas/workflows/testflight.yml',
      '.eas/workflows/pr-check.yml',
    ];
    files.forEach((file) => expect(existsSync(path.join(repoRoot(), file)), file).toBe(true));
    const readme = readRepoFile('docs/release/README.md');
    [
      '## First release',
      '## Signing and capabilities',
      '## EAS environment',
      '## State check',
    ].forEach((heading) => expect(readme.split('\n')).toContain(heading));
    const page = readRepoFile('docs/app-standard.md');
    const start = page.indexOf('**14.7 ');
    const rule = start === -1 ? '' : page.slice(start, page.indexOf('\n\n', start));
    expect(rule).toContain('(Must)');
    files.forEach((file) => expect(rule, file).toContain(path.basename(file)));
    ['First release', 'Signing', 'EAS environment', 'State check'].forEach((section) =>
      expect(rule.replace(/\s+/g, ' '), section).toContain(section),
    );
  });
});
