// The Expo enhanced push security check (US-021n, R19, KR13), with a fake transport: nothing here
// talks to Expo. It also keeps .github/workflows/push-security.yml inside its trust boundary (main
// only, the testflight environment, nothing installed, the token on one step) and keeps
// docs/release/push-security.md naming the fields the script reads.

import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';

import { afterAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { readRepoFile, repoRoot } from '../../src/release/__tests__/support/tree';
import {
  APP_JSON_PATH,
  buildRequest,
  EXPO_GRAPHQL_URL,
  httpsTransport,
  MAX_ANSWER_BYTES,
  NO_TOKEN,
  ON_MESSAGE,
  QUERY,
  QUERY_NAME,
  readProjectId,
  run,
  SKIPPED,
} from '../release/check-push-security.mjs';

const PROJECT_ID = '00000000-0000-4000-8000-000000000001';
const TOKEN = 'fake-expo-token-0123456789abcdef';
const scratch = mkdtempSync(path.join(os.tmpdir(), 'release-push-security-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
let fileCount = 0;

function appJson(expo: Record<string, unknown>): string {
  fileCount += 1;
  const file = path.join(scratch, `app-${fileCount}.json`);
  writeFileSync(file, JSON.stringify({ expo }));
  return file;
}

const WITH_PROJECT = appJson({ name: 'Automatos Go', extra: { eas: { projectId: PROJECT_ID } } });

type Request = { url: string; headers: Record<string, string>; body: string };
type Answer = { status: number; text: string };

function settings(projectOn: unknown, accountOn: unknown): Answer {
  const byId = {
    fullName: '@example/automatos-go',
    pushSecurityEnabled: projectOn,
    ownerAccount: { name: 'example', pushSecurityEnabled: accountOn },
  };
  return { status: 200, text: JSON.stringify({ data: { app: { byId } } }) };
}

/** Runs the check on a fake transport; `token: undefined` given explicitly means unset. */
async function check(
  answer: Answer | (() => Promise<Answer>),
  options: { token?: string; file?: string } = {},
) {
  const token = 'token' in options ? options.token : TOKEN;
  const file = options.file ?? WITH_PROJECT;
  const out: string[] = [];
  const err: string[] = [];
  const requests: Request[] = [];
  const transport = async (request: Request) => {
    requests.push(request);
    return typeof answer === 'function' ? answer() : answer;
  };
  const code = await run({
    env: { EXPO_TOKEN: token },
    appJsonPath: file,
    transport,
    io: { out: (line) => out.push(line), err: (line) => err.push(line) },
  });
  return { code, out: out.join('\n'), err: err.join('\n'), requests };
}

describe('check-push-security.mjs (US-021n)', () => {
  it('passes when both settings are off, and sends the one query to Expo with the bearer', async () => {
    const result = await check(settings(false, false));
    expect(result.code).toBe(0);
    expect(result.out).toContain('Project @example/automatos-go: enhanced push security off');
    expect(result.out).toContain('Account example: enhanced push security off');
    expect(result.out).toContain('PASS');
    expect(result.err).toBe('');
    expect(result.requests).toHaveLength(1);
    const [request] = result.requests;
    expect(request.url).toBe('https://api.expo.dev/graphql');
    expect(request.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(request.headers['content-type']).toBe('application/json');
    expect(JSON.parse(request.body)).toEqual({
      query: QUERY,
      operationName: QUERY_NAME,
      variables: { appId: PROJECT_ID },
    });
  });

  it.each([
    ['the project', true, false],
    ['the account', false, true],
    ['both', true, true],
  ])('fails when %s has it on', async (_, projectOn, accountOn) => {
    const result = await check(settings(projectOn, accountOn));
    expect(result.code).toBe(1);
    expect(result.err).toContain(ON_MESSAGE);
    expect(result.out).not.toContain('PASS');
  });

  it.each([
    ['the project field is missing', settings(undefined, false)],
    ['the account field is missing', settings(false, undefined)],
    ['a field is not a boolean', settings('false', false)],
    ['there is no app', { status: 200, text: JSON.stringify({ data: { app: null } }) }],
    ['there is no data', { status: 200, text: '{}' }],
  ])('fails, naming the query, when %s', async (_, answer) => {
    const result = await check(answer);
    expect(result.code).toBe(1);
    expect(result.err).toContain(QUERY_NAME);
    expect(result.err).toContain('lacks app.byId.pushSecurityEnabled');
  });

  it.each([
    ['401 with GraphQL errors', 401, JSON.stringify({ errors: [{ message: 'Unauthorized' }] })],
    ['500 with an HTML page', 500, '<html>bad gateway</html>'],
    ['a redirect', 302, ''],
  ])('fails on an HTTP error: %s', async (_, status, text) => {
    const result = await check({ status, text });
    expect(result.code).toBe(1);
    expect(result.err).toContain(`${QUERY_NAME}: Expo answered HTTP ${status}`);
  });

  it('fails on a GraphQL error with HTTP 200, quoting Expo', async () => {
    const text = JSON.stringify({
      data: null,
      errors: [{ message: 'Entity not authorized: AppEntity' }],
    });
    const result = await check({ status: 200, text });
    expect(result.code).toBe(1);
    expect(result.err).toContain(`${QUERY_NAME} failed: Entity not authorized: AppEntity`);
  });

  it('fails when the answer is not JSON or the request throws', async () => {
    const notJson = await check({ status: 200, text: 'not json' });
    expect(notJson.code).toBe(1);
    expect(notJson.err).toContain(`${QUERY_NAME}: Expo's answer is not JSON`);
    const thrown = await check(() => Promise.reject(new Error('getaddrinfo ENOTFOUND')));
    expect(thrown.code).toBe(1);
    expect(thrown.err).toContain('getaddrinfo ENOTFOUND');
  });

  it.each([
    ['no extra', {}],
    ['no eas', { extra: { router: {} } }],
    ['an empty projectId', { extra: { eas: { projectId: '' } } }],
  ])("is skipped (0) with %s: 'skipped: no EAS project yet', nothing sent", async (_, expo) => {
    const result = await check(settings(true, true), { file: appJson(expo) });
    expect(result.code).toBe(0);
    expect(result.out).toBe(SKIPPED);
    expect(result.requests).toEqual([]);
  });

  it('fails on a projectId that is not an EAS project id, or an unreadable app.json', async () => {
    const bad = await check(settings(false, false), {
      file: appJson({ extra: { eas: { projectId: '../../graphql?x=1' } } }),
    });
    expect(bad.code).toBe(1);
    expect(bad.err).toContain('is not an EAS project id');
    expect(bad.requests).toEqual([]);
    const missing = await check(settings(false, false), { file: path.join(scratch, 'none.json') });
    expect(missing.code).toBe(1);
    expect(missing.err).toContain('could not read');
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['blank', '  \n'],
  ])('fails (1) with how to add the token when EXPO_TOKEN is %s; nothing sent', async (_, token) => {
    const result = await check(settings(false, false), { token });
    expect(result.code).toBe(1);
    expect(result.err).toBe(NO_TOKEN);
    expect(NO_TOKEN).toContain('"testflight" GitHub environment');
    expect(result.requests).toEqual([]);
  });

  it('never prints the token, even when Expo or the network echoes it', async () => {
    const echoed = `Bearer ${TOKEN} rejected`;
    const answers: (Answer | (() => Promise<Answer>))[] = [
      settings(false, false),
      settings(true, false),
      settings(undefined, false),
      { status: 401, text: JSON.stringify({ errors: [{ message: echoed }] }) },
      { status: 200, text: JSON.stringify({ errors: [{ message: echoed }] }) },
      () => Promise.reject(new Error(echoed)),
    ];
    for (const answer of answers) {
      for (const token of [TOKEN, `${TOKEN}\n`]) {
        const result = await check(answer, { token });
        expect(`${result.out}\n${result.err}`).not.toContain(TOKEN);
      }
    }
    const masked = await check({ status: 401, text: JSON.stringify({ errors: [{ message: echoed }] }) });
    expect(masked.err).toContain('Bearer [EXPO_TOKEN] rejected');
  });

  it("reads the repository's own app.json by default, which has the EAS project", () => {
    // without the id the check is skipped (exit 0): removing the committed EAS link fails here
    const expo = JSON.parse(readFileSync(APP_JSON_PATH, 'utf8')).expo;
    expect(readProjectId()).toBe(expo.extra.eas.projectId);
    expect(readProjectId()).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  });

  it('asks for the fields of Expo’s published schema, and nothing else', () => {
    expect(EXPO_GRAPHQL_URL).toBe('https://api.expo.dev/graphql');
    const fields = QUERY.replace(/\([^)]*\)/g, '').match(/[A-Za-z]+/g);
    expect(fields).toEqual([
      'query',
      QUERY_NAME,
      'app',
      'byId',
      'fullName',
      'pushSecurityEnabled',
      'ownerAccount',
      'name',
      'pushSecurityEnabled',
    ]);
    expect(QUERY).toContain('byId(appId: $appId)');
    expect(QUERY).toContain('($appId: String!)');
  });

  it('uses only Node built-ins and node:https, never fetch, and no URL from the environment', () => {
    const source = readRepoFile('scripts/release/check-push-security.mjs');
    const imports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map(([, from]) => from);
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.every((from) => from.startsWith('node:'))).toBe(true);
    expect(imports).toContain('node:https');
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect([...source.matchAll(/env\.([A-Z_]+)/g)].map(([, name]) => name)).toEqual([
      'EXPO_TOKEN',
      'EXPO_TOKEN',
    ]);
  });
});

// ── The default transport, on a fake https.request ────────────────────────────────────────

type Sent = { url: string; options: { method: string; headers: Record<string, string> }; body: string };

/** A fake https.request: records what is sent, then answers (or stays silent) as told. */
function fakeSend(answer: { status: number; chunks: string[] } | 'silent', sent: Sent[]) {
  return (url: string, options: Sent['options'], onAnswer: (incoming: PassThrough) => void) => {
    const outgoing = Object.assign(new EventEmitter(), {
      destroy: (error: Error) => outgoing.emit('error', error),
      end: (body: Buffer) => {
        sent.push({ url, options, body: body.toString('utf8') });
        if (answer === 'silent') {
          outgoing.emit('timeout');
          return;
        }
        const incoming = Object.assign(new PassThrough(), { statusCode: answer.status });
        onAnswer(incoming);
        answer.chunks.forEach((chunk) => incoming.write(chunk));
        incoming.end();
      },
    });
    return outgoing;
  };
}

const viaFake = (answer: Parameters<typeof fakeSend>[0], sent: Sent[] = []) =>
  httpsTransport(buildRequest(PROJECT_ID, TOKEN), {
    timeoutMs: 5,
    send: fakeSend(answer, sent) as never,
  });

describe('httpsTransport (the request the workflow really sends)', () => {
  it('POSTs the body with its length to the fixed address and returns the answer', async () => {
    const sent: Sent[] = [];
    const answer = await viaFake({ status: 200, chunks: ['{"data":', '{}}'] }, sent);
    expect(answer).toEqual({ status: 200, text: '{"data":{}}' });
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe(EXPO_GRAPHQL_URL);
    expect(sent[0].options.method).toBe('POST');
    expect(sent[0].options.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(sent[0].options.headers['content-length']).toBe(String(Buffer.byteLength(sent[0].body)));
    expect(JSON.parse(sent[0].body).variables).toEqual({ appId: PROJECT_ID });
  });

  it('returns a redirect as its status, never following it', async () => {
    const sent: Sent[] = [];
    const answer = await viaFake({ status: 301, chunks: [] }, sent);
    expect(answer.status).toBe(301);
    expect(sent).toHaveLength(1);
  });

  it('refuses an answer over MAX_ANSWER_BYTES and drops a silent socket', async () => {
    const big = 'x'.repeat(64 * 1024);
    const chunks = Array.from({ length: MAX_ANSWER_BYTES / big.length + 1 }, () => big);
    await expect(viaFake({ status: 200, chunks })).rejects.toThrow(/answer is over/);
    await expect(viaFake('silent')).rejects.toThrow(/no answer from Expo within/);
  });
});

// ── The workflow ───────────────────────────────────────────────────────────────────────────

type Step = { uses?: string; run?: string; with?: Record<string, unknown>; env?: unknown };
type Job = {
  if?: string;
  environment?: unknown;
  'runs-on'?: string;
  env?: unknown;
  steps: Step[];
};

const WORKFLOW_PATH = '.github/workflows/push-security.yml';
const workflowText = readRepoFile(WORKFLOW_PATH);
const workflow = parse(workflowText) as {
  name: string;
  on: Record<string, unknown>;
  permissions: unknown;
  env?: unknown;
  jobs: Record<string, Job>;
};
const ciUses = (
  parse(readRepoFile('.github/workflows/ci.yml')) as { jobs: Record<string, Job> }
).jobs.verify.steps.flatMap((step) => (step.uses ? [step.uses] : []));

describe('.github/workflows/push-security.yml (KR13)', () => {
  const jobs = Object.values(workflow.jobs);
  const [job] = jobs;

  it("is 'Expo push security', on push to main, a daily schedule and dispatch, never a PR", () => {
    expect(workflow.name).toBe('Expo push security');
    expect(Object.keys(workflow.on).sort()).toEqual(['push', 'schedule', 'workflow_dispatch']);
    expect(workflow.on.push).toEqual({ branches: ['main'] });
    const schedule = workflow.on.schedule as { cron: string }[];
    expect(schedule).toHaveLength(1);
    expect(schedule[0].cron).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
  });

  it('reads the repository only, in the testflight environment, on main only', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(jobs).toHaveLength(1);
    expect(job.environment).toBe('testflight');
    expect(job.if).toBe("github.ref == 'refs/heads/main'");
    expect(job['runs-on']).toBe('ubuntu-latest');
  });

  it('pins checkout and setup-node as ci.yml does, Node 22, no stored git credentials', () => {
    const uses = job.steps.flatMap((step) => (step.uses ? [step.uses] : []));
    expect(uses).toEqual(['actions/checkout@v4', 'actions/setup-node@v4']);
    expect(uses.every((action) => ciUses.includes(action))).toBe(true);
    expect(job.steps[0].with).toEqual({ 'persist-credentials': false });
    expect(job.steps[1].with).toEqual({ 'node-version': 22 });
  });

  it("runs the workflow's own command: no token is exit 1, never a silent 0", () => {
    // the script runs only as node's main module, so a command it does not recognise would exit
    // 0 having checked nothing: this spawns exactly what the workflow runs, from the repo root
    const [command, ...args] = (job.steps.find((step) => step.run)?.run ?? '').split(' ');
    expect(command).toBe('node');
    const env = { ...process.env };
    delete env.EXPO_TOKEN;
    const result = spawnSync(process.execPath, args, { cwd: repoRoot(), encoding: 'utf8', env });
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe(NO_TOKEN);
    expect(result.stdout).toBe('');
  });

  it('installs nothing and hands EXPO_TOKEN to the one node step only', () => {
    const runs = job.steps.flatMap((step) => (step.run ? [step.run] : []));
    expect(runs).toEqual(['node scripts/release/check-push-security.mjs']);
    expect(workflowText).not.toMatch(/\b(npm|npx|yarn|pnpm|bun)\b/);
    expect(workflow.env).toBeUndefined();
    expect(job.env).toBeUndefined();
    const withSecrets = job.steps.filter((step) => JSON.stringify(step).includes('secrets.'));
    expect(withSecrets).toEqual([
      {
        name: 'Check Expo enhanced push security',
        env: { EXPO_TOKEN: '${{ secrets.EXPO_TOKEN }}' },
        run: 'node scripts/release/check-push-security.mjs',
      },
    ]);
    expect(workflowText.match(/secrets\./g)).toHaveLength(1);
  });
});

describe('docs/release/push-security.md', () => {
  const doc = readRepoFile('docs/release/push-security.md');

  const SCHEMA_NAMES = ['App.pushSecurityEnabled', 'Account.pushSecurityEnabled', 'AppQuery.byId'];
  const OUR_NAMES = [QUERY_NAME, 'scripts/release/check-push-security.mjs', WORKFLOW_PATH];
  it.each([...SCHEMA_NAMES, ...OUR_NAMES, 'OT-R10', 'D21'])('names %s', (text) => {
    expect(doc).toContain(text);
  });
});
