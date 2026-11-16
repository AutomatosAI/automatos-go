// Fakes for the release scripts' tests (release-first-release.test.ts, release-state.test.ts): an
// app folder with made-up ids, a team key generated for the run, a fake App Store Connect that
// keeps its own state, and a fake eas-cli. Nothing here talks to Apple or Expo, and no id here is
// the app's own.

import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { EasTimeout } from '../release/eas.mjs';

export const FAKE_APP_ID = '1234567890';
export const FAKE_BUNDLE = 'com.example.go';
export const FAKE_OWNER = 'example-owner';
export const FAKE_PROJECT = '00000000-0000-4000-8000-000000000002';
export const KEY_FILE = '/nowhere/AuthKey_FAKE.p8';
export const FAKE_KEY_ID = 'FAKEKEYID9';
export const FAKE_ISSUER = '00000000-0000-4000-8000-0000000000aa';
/** A value planted in every fake env:list line: no output may ever hold it. */
export const PLANTED = 'planted-value-that-must-never-print';
export const ENV_NAMES_FOR_TEST = ['EXPO_PUBLIC_ONE', 'EXPO_PUBLIC_TWO'];

export type Io = {
  out: string[];
  err: string[];
  io: { out: (l: string) => void; err: (l: string) => void };
};

export function captureIo(): Io {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { out: (line) => out.push(line), err: (line) => err.push(line) } };
}

/** A scratch folder for one test file, removed with `cleanup`. */
export function scratchFolder(prefix: string) {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

let appCount = 0;

/** An app folder: app.json, eas.json and docs/release/eas-env.json, with made-up ids. */
export function fakeApp(
  scratch: string,
  options: { ascAppId?: string | null; link?: boolean; bundle?: boolean; envList?: unknown } = {},
): string {
  appCount += 1;
  const root = path.join(scratch, `app-${appCount}`);
  mkdirSync(path.join(root, 'docs/release'), { recursive: true });
  const link =
    options.link === false
      ? {}
      : { owner: FAKE_OWNER, extra: { eas: { projectId: FAKE_PROJECT } } };
  const expo = {
    name: 'Example Go',
    slug: 'example-go',
    ...link,
    ...(options.bundle === false ? {} : { ios: { bundleIdentifier: FAKE_BUNDLE } }),
    plugins: ['./plugins/never-loaded'],
  };
  writeFileSync(path.join(root, 'app.json'), JSON.stringify({ expo }));
  const ascAppId = options.ascAppId === undefined ? FAKE_APP_ID : options.ascAppId;
  const ios =
    ascAppId === null ? { appleTeamId: 'TEAMFAKE01' } : { appleTeamId: 'TEAMFAKE01', ascAppId };
  writeFileSync(path.join(root, 'eas.json'), JSON.stringify({ submit: { testflight: { ios } } }));
  const envList = options.envList ?? {
    environments: { preview: ENV_NAMES_FOR_TEST, production: ENV_NAMES_FOR_TEST },
  };
  writeFileSync(path.join(root, 'docs/release/eas-env.json'), JSON.stringify(envList));
  return root;
}

/** A P-256 key made for this run, as a team key's .p8 file holds it. */
export function testKey(): { pem: string; publicKey: KeyObject } {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return { pem: String(privateKey.export({ type: 'pkcs8', format: 'pem' })), publicKey };
}

export const keyEnv = (): Record<string, string> => ({
  EXPO_ASC_API_KEY_PATH: KEY_FILE,
  EXPO_ASC_KEY_ID: FAKE_KEY_ID,
  EXPO_ASC_ISSUER_ID: FAKE_ISSUER,
});

export const readKeyFrom = (pem: string) => (file: string) => {
  if (file !== KEY_FILE) throw new Error('no such file');
  return pem;
};

export type FakeGroup = { id: string; name: string; internal: boolean; allBuilds: boolean | null };
export type FakeBuild = {
  id: string;
  version: string;
  state: string;
  expired?: boolean;
  /** Its internal TestFlight state (buildBetaDetail); READY_FOR_BETA_TESTING when unset. */
  beta?: string;
};
export type AscRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
};
export type AscState = {
  app?: { name: string; bundleId: string };
  groups: FakeGroup[];
  testers?: Record<string, number>;
  /** Newest first. */
  builds?: FakeBuild[];
  /** A second page of groups, as Apple answers past its limit. */
  morePages?: boolean;
  /** Every answer this status, with Apple's error body. */
  failWith?: { status: number; title: string };
};

const answer = (status: number, body: unknown) => ({ status, text: JSON.stringify(body) });
const groupBody = (group: FakeGroup) => ({
  type: 'betaGroups',
  id: group.id,
  attributes: {
    name: group.name,
    isInternalGroup: group.internal,
    hasAccessToAllBuilds: group.allBuilds,
  },
});
const buildBody = (build: FakeBuild) => ({
  type: 'builds',
  id: build.id,
  attributes: {
    version: build.version,
    processingState: build.state,
    expired: build.expired === true,
  },
});

function builds(state: AscState, url: URL) {
  if (url.searchParams.get('filter[app]') !== FAKE_APP_ID) return answer(400, { errors: [] });
  const all = state.builds ?? [];
  return answer(200, {
    data: all.slice(0, Number(url.searchParams.get('limit') ?? 50)).map(buildBody),
  });
}

function groups(state: AscState, url: URL) {
  if (url.searchParams.get('filter[app]') !== FAKE_APP_ID) return answer(400, { errors: [] });
  const links = state.morePages ? { next: 'https://api.appstoreconnect.apple.com/next' } : {};
  return answer(200, { data: state.groups.map(groupBody), links });
}

function betaDetail(state: AscState, buildId: string) {
  const build = (state.builds ?? []).find((each) => each.id === buildId);
  if (!build) return answer(404, { errors: [{ code: 'NOT_FOUND', title: 'no build' }] });
  const internalBuildState = build.beta ?? 'READY_FOR_BETA_TESTING';
  return answer(200, {
    data: { type: 'buildBetaDetails', id: buildId, attributes: { internalBuildState } },
  });
}

function createGroup(state: AscState, request: AscRequest) {
  const { data } = JSON.parse(request.body ?? '{}');
  const group = {
    id: `group-${state.groups.length + 1}`,
    name: data.attributes.name,
    internal: data.attributes.isInternalGroup,
    allBuilds: data.attributes.hasAccessToAllBuilds,
  };
  state.groups.push(group);
  return answer(201, { data: groupBody(group) });
}

/** A fake App Store Connect over one mutable state, with every request it was sent. */
export function fakeAsc(state: AscState) {
  const requests: AscRequest[] = [];
  const transport = async (request: AscRequest) => {
    requests.push(request);
    if (state.failWith)
      return answer(state.failWith.status, {
        errors: [{ code: 'NOT_AUTHORIZED', title: state.failWith.title }],
      });
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    if (route === `GET /v1/apps/${FAKE_APP_ID}`)
      return answer(200, { data: { id: FAKE_APP_ID, attributes: state.app } });
    if (route === 'GET /v1/betaGroups') return groups(state, url);
    if (route === 'POST /v1/betaGroups') return createGroup(state, request);
    if (route === 'GET /v1/builds') return builds(state, url);
    const detail = /^GET \/v1\/builds\/([^/]+)\/buildBetaDetail$/.exec(route);
    if (detail) return betaDetail(state, detail[1]);
    const testers = /^GET \/v1\/betaGroups\/([^/]+)\/relationships\/betaTesters$/.exec(route);
    if (testers) {
      const total = state.testers?.[testers[1]] ?? 0;
      return answer(200, {
        data: Array.from({ length: total }, (_, i) => ({ type: 'betaTesters', id: `t${i}` })),
        meta: { paging: { total, limit: 200 } },
      });
    }
    return answer(404, { errors: [{ code: 'NOT_FOUND', title: `no route ${route}` }] });
  };
  return { transport, requests };
}

export type EasCall = {
  command: string;
  args: string[];
  cwd: string;
  appJson: unknown;
  env: Record<string, string | undefined>;
};
export type EasResult = { code: number; stdout: string; stderr: string };
export type EasSpec = {
  whoami?: number;
  /** Names per environment and scope; a number is an exit code instead. */
  env?: Record<string, { project?: string[] | number; account?: string[] }>;
  runs?: unknown[] | number;
  view?: unknown;
  usage?: unknown;
  throws?: boolean;
  /** Every command runs past its time, as spawnExec then rejects. */
  timesOut?: boolean;
};

const ok = (stdout: string): EasResult => ({ code: 0, stdout, stderr: '' });
const flag = (args: string[], name: string) => args[args.indexOf(name) + 1] ?? '';

function envList(spec: EasSpec, args: string[]): EasResult {
  const env = flag(args, '--environment');
  const scope = flag(args, '--scope') as 'project' | 'account';
  const names = spec.env?.[env]?.[scope] ?? [];
  if (typeof names === 'number')
    return { code: names, stdout: `EXPO_PUBLIC_ONE=${PLANTED}`, stderr: `Error: ${PLANTED}` };
  const lines = names.map((name) => `\u001b[1m${name}\u001b[22m=${PLANTED}-${name}`);
  return ok(
    [
      `Environment: ${env}`,
      ...(lines.length ? lines : ['No variables found for this environment.']),
    ].join('\n'),
  );
}

const asJson = (value: unknown): EasResult =>
  typeof value === 'number'
    ? { code: value, stdout: '', stderr: 'Error: eas said no' }
    : ok(JSON.stringify(value));

/** The fake's answer to one command (the args after npx's own). */
function answerFor(spec: EasSpec, rest: string[]): EasResult {
  const answers: Record<string, () => EasResult> = {
    whoami: () => ({ code: spec.whoami ?? 0, stdout: 'someone', stderr: '' }),
    'env:list': () => envList(spec, rest),
    'workflow:runs': () => asJson(spec.runs ?? []),
    'workflow:view': () => asJson(spec.view ?? {}),
    'account:usage': () => asJson(spec.usage ?? {}),
  };
  const answer = answers[rest[0] ?? ''];
  return answer ? answer() : { code: 1, stdout: '', stderr: `unknown command ${rest[0]}` };
}

/** A fake eas-cli, answering by command, with every call it got (and the linked folder's app.json). */
export function fakeEas(spec: EasSpec) {
  const calls: EasCall[] = [];
  const exec = async (
    command: string,
    args: string[],
    options: { cwd: string; env: Record<string, string | undefined> },
  ) => {
    const appFile = path.join(options.cwd, 'app.json');
    const appJson = existsSync(appFile) ? JSON.parse(readFileSync(appFile, 'utf8')) : undefined;
    calls.push({ command, args, cwd: options.cwd, env: options.env, appJson });
    if (spec.throws) throw new Error('spawn npx ENOENT');
    if (spec.timesOut) throw new EasTimeout(`${args[2]} took over 120 s`);
    return answerFor(spec, args.slice(2));
  };
  return { exec, calls };
}
