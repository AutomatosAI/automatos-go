// The state check's EAS lines (scripts/release/state-eas.mjs, docs/release/README.md "State
// check") over a fake eas-cli: each environment's names, the latest delivery run (a run that failed
// to start among them), the build quota and the CI/CD minutes. No line ever holds an environment
// variable's value, even when eas fails.

import { EventEmitter } from 'node:events';
import process from 'node:process';
import { PassThrough } from 'node:stream';

import { afterAll, describe, expect, it } from 'vitest';

import { EasTimeout, easEnv, namesFromEnvList, spawnExec } from '../release/eas.mjs';
import { whyRunFailed } from '../release/state-eas.mjs';
import { PLANTED, scratchFolder } from './release-fixtures';
import { BOTH, GOOD_ASC, GOOD_EAS, USAGE, stateRunner } from './release-state-harness';

const scratch = scratchFolder('release-state-eas-');
afterAll(scratch.cleanup);
const state = stateRunner(scratch.dir);

describe('state.mjs: the EAS environment (names only)', () => {
  it('fails on each environment that lacks a name, naming the name and never a value', async () => {
    const eas = {
      ...GOOD_EAS,
      env: { preview: { project: ['EXPO_PUBLIC_ONE'] }, production: BOTH },
    };
    const result = await state(GOOD_ASC, eas);
    expect(result.code).toBe(1);
    expect(result.lineOf('eas-env:preview')).toBe(
      'eas-env:preview: FAIL: EAS environment preview lacks EXPO_PUBLIC_TWO',
    );
    expect(result.lineOf('eas-env:production')).toContain(': ok: ');
    expect(result.printed).not.toContain(PLANTED);
  });

  it('counts a name the account holds for every project, as a build does', async () => {
    const env = {
      preview: { project: ['EXPO_PUBLIC_ONE'], account: ['EXPO_PUBLIC_TWO'] },
      production: BOTH,
    };
    const result = await state(GOOD_ASC, { ...GOOD_EAS, env });
    expect(result.lineOf('eas-env:preview')).toContain(': ok: ');
  });

  it('says not checked when env:list fails, with its exit code and nothing it printed', async () => {
    const env = { preview: { project: 1 }, production: BOTH };
    const result = await state(GOOD_ASC, { ...GOOD_EAS, env });
    expect(result.lineOf('eas-env:preview')).toBe(
      'eas-env:preview: not checked: eas env:list exited 1',
    );
    expect(result.printed).not.toContain(PLANTED);
  });

  it('keeps only the names of what env:list prints', () => {
    const printed = `Environment: preview\n\u001b[1mEXPO_PUBLIC_A\u001b[22m=${PLANTED}\nEXPO_PUBLIC_B=a=b\nlower=x\nNo variables`;
    expect(namesFromEnvList(printed)).toEqual(['EXPO_PUBLIC_A', 'EXPO_PUBLIC_B']);
  });
});

describe('state.mjs: the latest delivery run', () => {
  const runs = (status: string) => [{ id: 'run-9', status }];
  const viewOf = (jobs: unknown[], errors: unknown[] = []) => ({
    id: 'run-9',
    status: 'FAILURE',
    errors,
    jobs,
  });
  const spent = {
    title: 'Free plan CI/CD and Simulator 60 minute limit reached.',
    message: 'CI/CD and Simulator minutes reset on December 1, 2026',
  };
  const SPENT_TEXT =
    'Free plan CI/CD and Simulator 60 minute limit reached. CI/CD and Simulator minutes reset on December 1, 2026';
  const runLine = async (eas: Record<string, unknown>) =>
    (await state(GOOD_ASC, { ...GOOD_EAS, ...eas })).lineOf('workflow-run');

  it('fails on a run that failed to start because the minutes are spent, quoting Expo', async () => {
    const view = viewOf([{ name: 'Fingerprint', status: 'NEW' }], [spent]);
    const result = await state(GOOD_ASC, { ...GOOD_EAS, runs: runs('FAILURE'), view });
    expect(result.code).toBe(1);
    expect(result.lineOf('workflow-run')).toBe(
      `workflow-run: FAIL: latest run run-9 failed to start (${SPENT_TEXT}): that merge shipped nothing`,
    );
    expect(result.calls.at(-2)?.args.slice(2)).toEqual([
      'workflow:view',
      'run-9',
      '--json',
      '--non-interactive',
    ]);
  });

  it("reads Expo's minutes words on the run and on jobs that never left NEW, not on a job that ran", () => {
    expect(whyRunFailed(viewOf([{ name: 'Fingerprint', status: 'NEW', errors: [spent] }]))).toEqual(
      {
        started: false,
        reason: SPENT_TEXT,
      },
    );
    const ran = viewOf([
      { name: 'Fingerprint', status: 'SUCCESS' },
      { name: 'Publish', status: 'FAILURE', errors: [{ title: 'Upstream rate limit reached' }] },
    ]);
    expect(whyRunFailed(ran)).toEqual({
      started: true,
      reason: 'Publish failed (Upstream rate limit reached)',
    });
  });

  it('calls a job that ran and hit a rate limit a plain failure, not a run that failed to start', async () => {
    const view = viewOf([
      { name: 'Fingerprint', status: 'FAILURE', errors: [{ title: 'API rate limit reached' }] },
    ]);
    expect(await runLine({ runs: runs('FAILURE'), view })).toBe(
      'workflow-run: FAIL: latest run run-9 failed: Fingerprint failed (API rate limit reached)',
    );
  });

  it('tells a run where no job started from one where a job failed', () => {
    expect(
      whyRunFailed(
        viewOf([{ name: 'Fingerprint', status: 'NEW' }], [{ title: 'Could not start' }]),
      ),
    ).toEqual({ started: false, reason: 'Could not start' });
    expect(whyRunFailed(viewOf([]))).toEqual({ started: false, reason: 'no job started' });
    const failed = viewOf([
      { name: 'Fingerprint', status: 'SUCCESS' },
      {
        name: 'Build iOS (native change)',
        status: 'FAILURE',
        errors: [{ title: 'Pod install failed' }],
      },
    ]);
    expect(whyRunFailed(failed)).toEqual({
      started: true,
      reason: 'Build iOS (native change) failed (Pod install failed)',
    });
  });

  it.each([
    [
      'a job that failed',
      'FAILURE',
      viewOf([{ name: 'Send the build to TestFlight', status: 'FAILURE' }]),
      'latest run run-9 failed: Send the build to TestFlight failed',
    ],
    ['a run that waits', 'ACTION_REQUIRED', undefined, 'latest run run-9 waits for an approval'],
    [
      'an unreadable view',
      'FAILURE',
      1,
      'latest run run-9 failed; whether it started is not known (eas workflow:view: Error: eas said no)',
    ],
    [
      'a view with no jobs to tell by',
      'FAILURE',
      { id: 'run-9', status: 'FAILURE', errors: [] },
      'latest run run-9 failed; whether it started is not known (eas workflow:view gave no jobs)',
    ],
  ])('fails on %s', async (_, status, view, detail) => {
    expect(await runLine({ runs: runs(status), view })).toBe(`workflow-run: FAIL: ${detail}`);
  });

  it('says a cancelled run is cancelled, and judges by the run before it', async () => {
    const before = { id: 'run-8', status: 'SUCCESS', startedAt: '2026-11-15T09:00:00.000Z' };
    const cancelled = { id: 'run-9', status: 'CANCELED' };
    expect(await runLine({ runs: [cancelled, before] })).toBe(
      'workflow-run: ok: latest run run-9 was cancelled (by a newer run or by hand); before it, run run-8 succeeded (2026-11-15)',
    );
    const failedBefore = { id: 'run-8', status: 'FAILURE' };
    const view = viewOf([{ name: 'Build iOS (native change)', status: 'FAILURE' }]);
    const line = await runLine({
      runs: [cancelled, { id: 'run-7', status: 'CANCELED' }, failedBefore],
      view,
    });
    expect(line).toBe(
      'workflow-run: FAIL: latest run run-9 was cancelled (by a newer run or by hand); before it, run run-8 failed: Build iOS (native change) failed',
    );
    [line, await runLine({ runs: [cancelled, before] })].forEach((each) =>
      expect(each).not.toContain('shipped nothing'),
    );
  });

  it('fails, without saying nothing shipped, when every run read was cancelled', async () => {
    const line = await runLine({
      runs: [
        { id: 'run-9', status: 'CANCELED' },
        { id: 'run-8', status: 'CANCELED' },
      ],
    });
    expect(line).toBe(
      'workflow-run: FAIL: latest run run-9 was cancelled (by a newer run or by hand), as were the 1 before it',
    );
  });

  it('reads the last ten runs, so a cancel has a run before it to judge by', async () => {
    const result = await state(GOOD_ASC, GOOD_EAS);
    const listed = result.calls.find((call) => call.args[2] === 'workflow:runs');
    expect(listed?.args.slice(2)).toEqual([
      'workflow:runs',
      '--workflow',
      'testflight.yml',
      '--limit',
      '10',
      '--json',
    ]);
  });

  it('is ok while a run is going, and fails when the workflow has never run', async () => {
    expect(await runLine({ runs: runs('IN_PROGRESS') })).toBe(
      'workflow-run: ok: latest run run-9 is running',
    );
    expect(await runLine({ runs: [] })).toBe(
      'workflow-run: FAIL: no run of testflight.yml yet: no merge has shipped',
    );
  });
});

describe('state.mjs: quota and minutes', () => {
  const usage = (ios: unknown, simulator: unknown) => ({ ...USAGE, builds: { ios }, simulator });

  it('fails when no iOS build is left, or the CI/CD minutes are spent', async () => {
    const spentAll = usage(
      { plan: { used: 15, limit: 15 } },
      { minutes: { plan: { used: 60, limit: 60 } } },
    );
    const result = await state(GOOD_ASC, { ...GOOD_EAS, usage: spentAll });
    expect(result.lineOf('build-quota')).toBe(
      'build-quota: FAIL: iOS builds 15 of 15 used this cycle, none left until 2026-12-01: a native merge cannot build',
    );
    expect(result.lineOf('cicd-minutes')).toBe(
      'cicd-minutes: FAIL: CI/CD minutes 60 of 60 used: workflow jobs cannot start until 2026-12-01, so a merge ships nothing',
    );
  });

  it('says not checked when the account reports no minutes, pointing at the run instead', async () => {
    const result = await state(GOOD_ASC, {
      ...GOOD_EAS,
      usage: usage({ plan: { used: 1, limit: 15 } }, null),
    });
    expect(result.lineOf('cicd-minutes')).toBe(
      'cicd-minutes: not checked: eas account:usage gives no CI/CD minutes for this account: a run that failed to start (workflow-run) is the only sign',
    );
    expect(result.code).toBe(0);
  });

  it('says not checked for both when account:usage fails', async () => {
    const result = await state(GOOD_ASC, { ...GOOD_EAS, usage: 1 });
    expect(result.lineOf('build-quota')).toBe(
      'build-quota: not checked: eas account:usage: Error: eas said no',
    );
    expect(result.lineOf('cicd-minutes')).toBe(
      'cicd-minutes: not checked: eas account:usage: Error: eas said no',
    );
  });
});

describe('eas.mjs: the environment eas sees', () => {
  const given = {
    PATH: '/bin',
    HOME: '/home/someone',
    LANG: 'en_GB.UTF-8',
    LC_ALL: 'en_GB.UTF-8',
    EXPO_TOKEN: 'expo-token',
    EAS_BUILD_PROFILE: 'testflight',
    EXPO_NO_DOTENV: '1',
    npm_config_registry: 'https://registry.npmjs.org/',
    HTTPS_PROXY: 'http://proxy.example.test:3128',
    GITHUB_TOKEN: 'sentinel-github-token',
    AWS_SECRET_ACCESS_KEY: 'sentinel-cloud-secret',
    EXPO_ASC_API_KEY_PATH: '/keys/AuthKey.p8',
    EXPO_ASC_KEY_ID: 'sentinel-key-id',
    EXPO_APPLE_PASSWORD: 'sentinel-apple-password',
  };

  it("passes the allowed names only, and never Apple's keys or another service's token", () => {
    const passed = easEnv(given);
    expect(Object.keys(passed).sort()).toEqual(
      [
        'PATH',
        'HOME',
        'LANG',
        'LC_ALL',
        'EXPO_TOKEN',
        'EAS_BUILD_PROFILE',
        'EXPO_NO_DOTENV',
        'npm_config_registry',
        'HTTPS_PROXY',
        'FORCE_COLOR',
        'NO_COLOR',
        'EXPO_NO_TELEMETRY',
      ].sort(),
    );
    expect(passed).toMatchObject({ FORCE_COLOR: '0', NO_COLOR: '1', EXPO_NO_TELEMETRY: '1' });
  });

  it('hands that environment to every eas call the state check makes', async () => {
    const result = await state(GOOD_ASC, GOOD_EAS, { env: given });
    expect(result.calls.length).toBeGreaterThan(1);
    result.calls.forEach((call) => {
      const text = JSON.stringify(call.env);
      [
        'sentinel-github-token',
        'sentinel-cloud-secret',
        'sentinel-key-id',
        'sentinel-apple-password',
      ].forEach((sentinel) => expect(text).not.toContain(sentinel));
      expect(call.env.EXPO_TOKEN).toBe('expo-token');
    });
  });
});

/** A fake child process: it records the signals sent to its group, and ignores SIGTERM. */
function stubbornChild() {
  const signals: [number, string][] = [];
  const child = Object.assign(new EventEmitter(), {
    pid: 4242,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  });
  const kill = (pid: number, signal: string) => {
    signals.push([pid, signal]);
    if (signal === 'SIGKILL') setImmediate(() => child.emit('exit', null, 'SIGKILL'));
  };
  return { child, signals, kill, spawnFn: (() => child) as never };
}

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

  it('on timeout, sends SIGTERM to the whole group, then SIGKILL, and rejects as a timeout', async () => {
    const fake = stubbornChild();
    const running = spawnExec('npx', ['--yes', 'eas-cli', 'whoami'], {
      cwd: scratch.dir,
      env: {},
      timeoutMs: 5,
      graceMs: 5,
      spawnFn: fake.spawnFn,
      kill: fake.kill,
    });
    await expect(running).rejects.toThrow(EasTimeout);
    await expect(running).rejects.toThrow('whoami took over 0.005 s');
    expect(fake.signals).toEqual([
      [-4242, 'SIGTERM'],
      [-4242, 'SIGKILL'],
    ]);
  });

  it('settles when the child exits, even while a grandchild keeps its output open', async () => {
    const fake = stubbornChild();
    const running = spawnExec('npx', ['--yes', 'eas-cli', 'whoami'], {
      cwd: scratch.dir,
      env: {},
      timeoutMs: 10_000,
      drainMs: 5,
      spawnFn: fake.spawnFn,
      kill: fake.kill,
    });
    fake.child.stdout.write('someone');
    setImmediate(() => fake.child.emit('exit', 0, null));
    await expect(running).resolves.toEqual({ code: 0, stdout: 'someone', stderr: '' });
    expect(fake.signals).toEqual([]);
  });
});
