// The harness for the state check's tests (release-state.test.ts, release-state-eas.test.ts): a
// release in order, and one call that runs scripts/release/state.mjs over the fakes in
// release-fixtures.ts and gives back its lines.

import { run } from '../release/state.mjs';
import {
  ENV_NAMES_FOR_TEST,
  captureIo,
  fakeApp,
  fakeAsc,
  fakeEas,
  keyEnv,
  readKeyFrom,
  testKey,
  type AscState,
  type EasSpec,
} from './release-fixtures';

const key = testKey();
export const APP = { name: 'Example Go', bundleId: 'com.example.go' };
export const GOOD_ASC: AscState = {
  app: APP,
  groups: [{ id: 'g1', name: 'Team', internal: true, allBuilds: true }],
  testers: { g1: 2 },
  builds: [{ id: 'b2', version: '12', state: 'VALID' }],
  inGroup: { g1: ['b2'] },
};
export const BOTH = { project: ENV_NAMES_FOR_TEST };
export const GOOD_RUN = { id: 'run-1', status: 'SUCCESS', startedAt: '2026-11-16T10:00:00.000Z' };
export const USAGE = {
  account: { billingPeriod: { end: '2026-12-01T00:00:00.000Z' } },
  builds: { ios: { plan: { used: 9, limit: 15 } } },
  simulator: { minutes: { plan: { used: 20, limit: 60 } }, byJobType: { workflows: 20 } },
};
export const GOOD_EAS: EasSpec = {
  env: { preview: BOTH, production: BOTH },
  runs: [GOOD_RUN],
  usage: USAGE,
};
/** One plain line: a check, its verdict, and what it found. */
export const LINE = /^[a-z][a-z:-]*: (ok|FAIL|not checked): \S.*$/;

/** state.mjs over the fakes, its app folder and linked folders under `scratch`. */
export function stateRunner(scratch: string) {
  return async (
    asc: AscState | undefined,
    eas: EasSpec,
    options: { root?: string; env?: Record<string, string>; argv?: string[] } = {},
  ) => {
    const fake = fakeAsc(asc ?? { groups: [] });
    const easFake = fakeEas(eas);
    const captured = captureIo();
    const code = await run({
      argv: options.argv ?? [],
      env: options.env ?? keyEnv(),
      root: options.root ?? fakeApp(scratch),
      transport: fake.transport,
      readKey: readKeyFrom(key.pem),
      exec: easFake.exec,
      tmp: scratch,
      io: captured.io,
    });
    const lines = captured.out;
    const lineOf = (check: string) => lines.find((each) => each.startsWith(`${check}: `)) ?? '';
    const printed = [...captured.out, ...captured.err].join('\n');
    return {
      code,
      lines,
      lineOf,
      printed,
      err: captured.err,
      asc: fake.requests,
      calls: easFake.calls,
    };
  };
}
