// Expo enhanced push security check (US-021n, R19, KR13). Self-hosted Automatos servers send push
// through Expo's push service without an Expo access token, so Expo's "enhanced push security"
// must stay off (D21, PRD §4.10). This script asks Expo's GraphQL API for the setting on the EAS
// project and on the account that owns it, and fails when either is on.
//
//   EXPO_TOKEN=<an Expo access token> node scripts/release/check-push-security.mjs
//
// The fields are Expo's published schema (eas-cli packages/eas-cli/graphql.schema.json, read
// 26 Oct 2026): RootQuery.app → AppQuery.byId(appId: String!): App!, then App.pushSecurityEnabled:
// Boolean! and App.ownerAccount → Account.pushSecurityEnabled: Boolean!.
//
// Exit 0: both off, or app.json has no EAS project yet (skipped). Exit 1: a setting is on, there is
// no EXPO_TOKEN, or Expo's answer is an error or lacks a field. Node 22, no dependency; HTTP through
// node:https (the app's no-fetch lint rule covers scripts/). The token goes only in the
// Authorization header and is masked in everything printed. docs/release/push-security.md.

import { Buffer } from 'node:buffer';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import https from 'node:https';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Fixed, never read from the environment: the token goes to Expo and nowhere else. */
export const EXPO_GRAPHQL_URL = 'https://api.expo.dev/graphql';
export const APP_JSON_PATH = fileURLToPath(new URL('../../app.json', import.meta.url));
export const QUERY_NAME = 'AutomatosGoPushSecurity';
export const QUERY = [
  `query ${QUERY_NAME}($appId: String!) {`,
  '  app {',
  '    byId(appId: $appId) {',
  '      fullName',
  '      pushSecurityEnabled',
  '      ownerAccount {',
  '        name',
  '        pushSecurityEnabled',
  '      }',
  '    }',
  '  }',
  '}',
].join('\n');
export const ON_MESSAGE =
  'Expo enhanced push security is ON — self-hosted push breaks (D21). Turn it off in the EAS dashboard.';
export const SKIPPED = 'skipped: no EAS project yet';
export const NO_TOKEN =
  'EXPO_TOKEN is not set. Add an Expo access token as the secret EXPO_TOKEN of the "testflight" ' +
  'GitHub environment (main only, D50): docs/release/push-security.md, "Adding the token".';
/** How long the socket may stay silent before the request is dropped. */
export const TIMEOUT_MS = 30_000;
export const MAX_ANSWER_BYTES = 1024 * 1024;

const FIELDS = 'app.byId.pushSecurityEnabled and app.byId.ownerAccount.pushSecurityEnabled';
const EAS_PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ERRORS_SHOWN = 3;
const MAX_ERROR_CHARS = 200;
const MASK = '[EXPO_TOKEN]';

/**
 * @typedef {{ url: string, headers: Record<string, string>, body: string }} CheckRequest
 * @typedef {{ status: number, text: string }} CheckAnswer
 * @typedef {(request: CheckRequest) => Promise<CheckAnswer>} Transport
 * @typedef {{ out: (line: string) => void, err: (line: string) => void }} Io
 */

/** A check that cannot finish (exit 1). */
export class CheckError extends Error {}

const messageOf = (error) => (error instanceof Error ? error.message : String(error));

function readConfig(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new CheckError(`could not read ${file}: ${messageOf(error)}`);
  }
}

/** The EAS project id (app.json expo.extra.eas.projectId), or undefined when there is none. */
export function readProjectId(file = APP_JSON_PATH) {
  const id = readConfig(file)?.expo?.extra?.eas?.projectId ?? '';
  if (id === '') return undefined;
  if (typeof id !== 'string' || !EAS_PROJECT_ID.test(id)) {
    throw new CheckError(`${file}: expo.extra.eas.projectId is not an EAS project id`);
  }
  return id;
}

/**
 * The one request the check sends.
 * @returns {CheckRequest}
 */
export function buildRequest(projectId, token) {
  return {
    url: EXPO_GRAPHQL_URL,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query: QUERY, operationName: QUERY_NAME, variables: { appId: projectId } }),
  };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** GraphQL errors as one line ('' when there are none); Expo's own text, cut short. */
function errorsOf(body) {
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  return errors
    .slice(0, MAX_ERRORS_SHOWN)
    .map((entry) => String(entry?.message ?? JSON.stringify(entry)).slice(0, MAX_ERROR_CHARS))
    .join('; ');
}

const nameOr = (value, fallback) =>
  typeof value === 'string' && value.trim() !== '' ? value : fallback;

/** Throws a CheckError naming the query for an HTTP error, a GraphQL error or a non-JSON answer. */
function refuseFailed(answer, body) {
  const errors = errorsOf(body);
  if (answer.status < 200 || answer.status > 299) {
    const detail = errors ? `: ${errors}` : '';
    throw new CheckError(`${QUERY_NAME}: Expo answered HTTP ${answer.status}${detail}`);
  }
  if (body === undefined) throw new CheckError(`${QUERY_NAME}: Expo's answer is not JSON`);
  if (errors) throw new CheckError(`${QUERY_NAME} failed: ${errors}`);
}

/**
 * The two settings from Expo's answer. An HTTP error, a GraphQL error, an answer that is not JSON
 * or one that lacks a field throws a CheckError naming the query.
 * @param {CheckAnswer} answer
 */
export function readAnswer(answer) {
  const body = parseJson(answer.text);
  refuseFailed(answer, body);
  const app = body?.data?.app?.byId;
  const account = app?.ownerAccount;
  const isFlag = (value) => typeof value === 'boolean';
  if (!isFlag(app?.pushSecurityEnabled) || !isFlag(account?.pushSecurityEnabled)) {
    throw new CheckError(`${QUERY_NAME}: the answer lacks ${FIELDS}`);
  }
  return Object.freeze({
    project: nameOr(app.fullName, 'the project'),
    account: nameOr(account.name, 'its account'),
    projectOn: app.pushSecurityEnabled,
    accountOn: account.pushSecurityEnabled,
  });
}

const onOff = (on) => (on ? 'ON' : 'off');

/** @param {ReturnType<typeof readAnswer>} settings @param {Io} io */
function report(settings, io) {
  io.out(`Project ${settings.project}: enhanced push security ${onOff(settings.projectOn)}`);
  io.out(`Account ${settings.account}: enhanced push security ${onOff(settings.accountOn)}`);
  if (!settings.projectOn && !settings.accountOn) {
    io.out('PASS: Expo enhanced push security is off for the project and its account.');
    return 0;
  }
  io.err(ON_MESSAGE);
  return 1;
}

/** Collects one answer, refusing one over MAX_ANSWER_BYTES. */
function collect(incoming, resolve, reject) {
  const chunks = [];
  let size = 0;
  incoming.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_ANSWER_BYTES) {
      incoming.destroy(new CheckError(`Expo's answer is over ${MAX_ANSWER_BYTES} bytes`));
      return;
    }
    chunks.push(chunk);
  });
  incoming.on('error', reject);
  incoming.on('end', () =>
    resolve({ status: incoming.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }),
  );
}

/**
 * POSTs the request over node:https. A redirect is an HTTP error (never followed, so the token
 * never goes elsewhere); a silent socket is dropped after timeoutMs. `send` is https.request
 * (a test passes a fake).
 * @param {CheckRequest} request
 * @param {{ timeoutMs?: number, send?: typeof https.request }} [options]
 * @returns {Promise<CheckAnswer>}
 */
export function httpsTransport(request, { timeoutMs = TIMEOUT_MS, send = https.request } = {}) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(request.body, 'utf8');
    const headers = { ...request.headers, 'content-length': String(body.length) };
    const options = { method: 'POST', headers, timeout: timeoutMs };
    const outgoing = send(request.url, options, (incoming) => collect(incoming, resolve, reject));
    outgoing.on('timeout', () =>
      outgoing.destroy(new CheckError(`no answer from Expo within ${timeoutMs / 1000} s`)),
    );
    outgoing.on('error', reject);
    outgoing.end(body);
  });
}

/**
 * Every line printed with the token (raw and trimmed) replaced by a mask.
 * @param {Io} io
 * @returns {Io}
 */
export function masked(io, token) {
  const secrets = [...new Set([token, token?.trim()])].filter((value) => typeof value === 'string' && value !== '');
  const mask = (line) => secrets.reduce((text, secret) => text.split(secret).join(MASK), String(line));
  return { out: (line) => io.out(mask(line)), err: (line) => io.err(mask(line)) };
}

/**
 * The check: its exit code (0 off or skipped; 1 on, no token, or no usable answer).
 * @param {{ env?: Record<string, string | undefined>, appJsonPath?: string, transport?: Transport, io?: Io }} [options]
 * @returns {Promise<number>}
 */
export async function run(options = {}) {
  const env = options.env ?? process.env;
  const io = masked(options.io ?? defaultIo(), env.EXPO_TOKEN);
  try {
    const projectId = readProjectId(options.appJsonPath);
    if (projectId === undefined) {
      io.out(SKIPPED);
      return 0;
    }
    const token = env.EXPO_TOKEN?.trim();
    if (!token) {
      io.err(NO_TOKEN);
      return 1;
    }
    io.out(`Asking Expo (${QUERY_NAME}: ${FIELDS}) about EAS project ${projectId}`);
    const transport = options.transport ?? httpsTransport;
    return report(readAnswer(await transport(buildRequest(projectId, token))), io);
  } catch (error) {
    io.err(`FAIL: ${messageOf(error)} (see docs/release/push-security.md, "A red run")`);
    return 1;
  }
}

/** @returns {Io} */
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
