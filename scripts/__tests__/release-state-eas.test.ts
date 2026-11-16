// The state check's EAS lines (scripts/release/state-eas.mjs, docs/release/README.md "State
// check") over a fake eas-cli: each environment's names, the latest delivery run (a run that failed
// to start among them), the build quota and the CI/CD minutes. No line ever holds an environment
// variable's value, even when eas fails.

import { afterAll, describe, expect, it } from 'vitest';

import { namesFromEnvList } from '../release/eas.mjs';
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

  it('fails on a run that failed to start because the minutes are spent, quoting Expo', async () => {
    const view = viewOf([{ name: 'Fingerprint', status: 'FAILURE', errors: [spent] }]);
    const result = await state(GOOD_ASC, { ...GOOD_EAS, runs: runs('FAILURE'), view });
    expect(result.code).toBe(1);
    expect(result.lineOf('workflow-run')).toBe(
      'workflow-run: FAIL: latest run run-9 failed to start (Free plan CI/CD and Simulator 60 minute limit reached. CI/CD and Simulator minutes reset on December 1, 2026): that merge shipped nothing',
    );
    expect(result.calls.at(-2)?.args.slice(2)).toEqual([
      'workflow:view',
      'run-9',
      '--json',
      '--non-interactive',
    ]);
  });

  it('tells a run where no job started from one where a job failed', () => {
    expect(
      whyRunFailed(
        viewOf([{ name: 'Fingerprint', status: 'NEW' }], [{ title: 'Could not start' }]),
      ),
    ).toEqual({
      started: false,
      reason: 'Could not start',
    });
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
      'a cancelled run',
      'CANCELED',
      undefined,
      'latest run run-9 is CANCELED: that merge shipped nothing',
    ],
    [
      'an unreadable view',
      'FAILURE',
      1,
      'latest run run-9 is FAILURE; whether it started is not known (eas workflow:view: Error: eas said no)',
    ],
  ])('fails on %s', async (_, status, view, detail) => {
    const result = await state(GOOD_ASC, { ...GOOD_EAS, runs: runs(status), view });
    expect(result.lineOf('workflow-run')).toBe(`workflow-run: FAIL: ${detail}`);
  });

  it('is ok while a run is going, and fails when the workflow has never run', async () => {
    expect(
      (await state(GOOD_ASC, { ...GOOD_EAS, runs: runs('IN_PROGRESS') })).lineOf('workflow-run'),
    ).toBe('workflow-run: ok: latest run run-9 is running');
    expect((await state(GOOD_ASC, { ...GOOD_EAS, runs: [] })).lineOf('workflow-run')).toBe(
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
