// The App Store Connect API, as the release scripts use it: a team API key from the environment,
// an ES256 token signed with it, and the few TestFlight reads and the one write the first release
// needs (docs/release/README.md, "First release").
//
// The key is named by the variables eas-cli reads (credentials/ios/appstore/resolveCredentials in
// eas-cli 27.10.0): EXPO_ASC_API_KEY_PATH (the .p8 file), EXPO_ASC_KEY_ID and EXPO_ASC_ISSUER_ID.
// A team key has an issuer id; an individual key, which has none, is not supported here. The
// key's contents, its id, the issuer and the signed token are never printed and never put in an
// error message. Requests go to Apple's fixed address over node:https (the app's no-fetch lint rule
// covers scripts/); a redirect is an error, never followed, so the token goes nowhere else.

import { Buffer } from 'node:buffer';
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import https from 'node:https';

/** Fixed, never read from the environment: the token goes to Apple and nowhere else. */
export const ASC_API = 'https://api.appstoreconnect.apple.com';
export const KEY_PATH_ENV = 'EXPO_ASC_API_KEY_PATH';
export const KEY_ID_ENV = 'EXPO_ASC_KEY_ID';
export const ISSUER_ENV = 'EXPO_ASC_ISSUER_ID';
export const AUDIENCE = 'appstoreconnect-v1';
/** Apple refuses a token that lives longer than 20 minutes; ten is plenty for one run. */
export const TOKEN_SECONDS = 600;
export const TIMEOUT_MS = 30_000;
export const MAX_ANSWER_BYTES = 2 * 1024 * 1024;
const MAX_DETAIL_CHARS = 200;

/** A request to App Store Connect that cannot finish, or an answer it cannot use. */
export class AscError extends Error {}

const messageOf = (error) => (error instanceof Error ? error.message : String(error));

/**
 * The key's three names, or the reason they cannot be used (never a value).
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: true, keyPath: string, keyId: string, issuerId: string } | { ok: false, why: string }}
 */
export function readAscKey(env) {
  const keyPath = env[KEY_PATH_ENV]?.trim();
  const keyId = env[KEY_ID_ENV]?.trim();
  const issuerId = env[ISSUER_ENV]?.trim();
  const unset = [
    [KEY_PATH_ENV, keyPath],
    [KEY_ID_ENV, keyId],
    [ISSUER_ENV, issuerId],
  ].filter(([, value]) => !value);
  if (unset.length === 3)
    return {
      ok: false,
      why: `no App Store Connect key (${KEY_PATH_ENV}, ${KEY_ID_ENV}, ${ISSUER_ENV} unset)`,
    };
  if (unset.length > 0) {
    return {
      ok: false,
      why: `the App Store Connect key is incomplete: ${unset.map(([name]) => name).join(', ')} unset`,
    };
  }
  return { ok: true, keyPath, keyId, issuerId };
}

const base64url = (value) => Buffer.from(value).toString('base64url');

/**
 * A token for the App Store Connect API: ES256 over the key's P-256 private key, its signature
 * the raw 64 bytes JWS uses (ieee-p1363), not DER.
 * @param {{ privateKeyPem: string, keyId: string, issuerId: string, now?: number }} key
 */
export function signToken({ privateKeyPem, keyId, issuerId, now = Date.now() }) {
  const issuedAt = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const claims = { iss: issuerId, iat: issuedAt, exp: issuedAt + TOKEN_SECONDS, aud: AUDIENCE };
  const body = `${header}.${base64url(JSON.stringify(claims))}`;
  let key;
  try {
    key = createPrivateKey(privateKeyPem);
  } catch {
    throw new AscError(`the file ${KEY_PATH_ENV} names is not a private key`);
  }
  const signature = sign('sha256', Buffer.from(body), { key, dsaEncoding: 'ieee-p1363' });
  return `${body}.${signature.toString('base64url')}`;
}

/** Reads the key file and signs a token; the file's contents stay in this function. */
export function tokenFromEnv(env, { readKey = (file) => readFileSync(file, 'utf8'), now } = {}) {
  const key = readAscKey(env);
  if (!key.ok) throw new AscError(key.why);
  let privateKeyPem;
  try {
    privateKeyPem = readKey(key.keyPath);
  } catch {
    throw new AscError(`could not read the file ${KEY_PATH_ENV} names`);
  }
  return signToken({ privateKeyPem, keyId: key.keyId, issuerId: key.issuerId, now });
}

/** Collects one answer, refusing one over MAX_ANSWER_BYTES. */
function collect(incoming, resolve, reject) {
  const chunks = [];
  let size = 0;
  incoming.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_ANSWER_BYTES) {
      incoming.destroy(
        new AscError(`App Store Connect's answer is over ${MAX_ANSWER_BYTES} bytes`),
      );
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
 * One request over node:https. `send` is https.request (a test passes a fake).
 * @param {{ method: string, url: string, headers: Record<string, string>, body?: string }} request
 * @returns {Promise<{ status: number, text: string }>}
 */
export function httpsTransport(request, { timeoutMs = TIMEOUT_MS, send = https.request } = {}) {
  return new Promise((resolve, reject) => {
    const body = request.body === undefined ? undefined : Buffer.from(request.body, 'utf8');
    const headers = body
      ? { ...request.headers, 'content-length': String(body.length) }
      : request.headers;
    const options = { method: request.method, headers, timeout: timeoutMs };
    const outgoing = send(request.url, options, (incoming) => collect(incoming, resolve, reject));
    outgoing.on('timeout', () =>
      outgoing.destroy(
        new AscError(`no answer from App Store Connect within ${timeoutMs / 1000} s`),
      ),
    );
    outgoing.on('error', reject);
    outgoing.end(body);
  });
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Apple's own error lines (code, title, detail), cut short: they never carry the token. */
function errorsOf(body) {
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  return errors
    .slice(0, 3)
    .map((entry) => [entry?.code, entry?.title, entry?.detail].filter(Boolean).join(': '))
    .map((line) => line.slice(0, MAX_DETAIL_CHARS))
    .join('; ');
}

/** The JSON body of a 2xx answer; anything else throws an AscError naming the call. */
function readAnswer(name, answer) {
  const body = parseJson(answer.text);
  if (answer.status < 200 || answer.status > 299) {
    const detail = errorsOf(body);
    throw new AscError(
      `${name}: App Store Connect answered HTTP ${answer.status}${detail ? ` (${detail})` : ''}`,
    );
  }
  if (body === undefined) throw new AscError(`${name}: App Store Connect's answer is not JSON`);
  return body;
}

/** A query string from plain pairs (Apple's names carry brackets, encoded here). */
function query(pairs) {
  return Object.entries(pairs)
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&');
}

// Apple answers hasAccessToAllBuilds with null for some groups (eas-cli #4528): only true counts.
const groupOf = (entry) =>
  Object.freeze({
    id: String(entry?.id ?? ''),
    name: String(entry?.attributes?.name ?? ''),
    internal: entry?.attributes?.isInternalGroup === true,
    allBuilds: entry?.attributes?.hasAccessToAllBuilds === true,
  });

const buildOf = (entry) =>
  entry === undefined
    ? undefined
    : Object.freeze({
        id: String(entry.id ?? ''),
        version: String(entry.attributes?.version ?? '?'),
        state: String(entry.attributes?.processingState ?? 'UNKNOWN'),
        expired: entry.attributes?.expired === true,
      });

/** One call: a request with the token, its answer read, every failure an AscError naming it. */
function caller(token, transport) {
  return async (name, method, route, body) => {
    const headers = { accept: 'application/json', authorization: `Bearer ${token}` };
    const request =
      body === undefined
        ? { method, url: `${ASC_API}${route}`, headers }
        : {
            method,
            url: `${ASC_API}${route}`,
            headers: { ...headers, 'content-type': 'application/json' },
            body: JSON.stringify(body),
          };
    try {
      return readAnswer(name, await transport(request));
    } catch (error) {
      throw error instanceof AscError ? error : new AscError(`${name}: ${messageOf(error)}`);
    }
  };
}

const appRoute = (appId, rest) => `/v1/apps/${encodeURIComponent(appId)}${rest}`;

async function readApp(call, appId) {
  const route = appRoute(appId, `?${query({ 'fields[apps]': 'name,bundleId' })}`);
  const attributes = (await call('read the app', 'GET', route))?.data?.attributes;
  return Object.freeze({
    name: String(attributes?.name ?? ''),
    bundleId: String(attributes?.bundleId ?? ''),
  });
}

/** The app's TestFlight groups, as eas-cli's build steps list them (GET /v1/betaGroups). */
async function listGroups(call, appId) {
  const route = `/v1/betaGroups?${query({ 'filter[app]': appId, limit: '200' })}`;
  const body = await call('list the TestFlight groups', 'GET', route);
  // a second page would hide a group, and --apply could then make a second one
  if (body?.links?.next) throw new AscError('list the TestFlight groups: over 200 groups');
  return Object.freeze((Array.isArray(body?.data) ? body.data : []).map(groupOf));
}

async function createInternalGroup(call, appId, name) {
  const data = {
    type: 'betaGroups',
    attributes: { name, isInternalGroup: true, hasAccessToAllBuilds: true },
    relationships: { app: { data: { type: 'apps', id: appId } } },
  };
  const body = await call('create the TestFlight group', 'POST', '/v1/betaGroups', { data });
  return groupOf(body?.data);
}

/** The newest build uploaded for the app, or undefined when it has none. */
async function newestBuild(call, appId) {
  const pairs = {
    'filter[app]': appId,
    sort: '-uploadedDate',
    limit: '1',
    'fields[builds]': 'version,processingState,expired',
  };
  const body = await call("read the app's newest build", 'GET', `/v1/builds?${query(pairs)}`);
  return buildOf(Array.isArray(body?.data) ? body.data[0] : undefined);
}

/**
 * A build's TestFlight state for internal testers (buildBetaDetail.internalBuildState, which
 * eas-cli's build steps read too): READY_FOR_BETA_TESTING or IN_BETA_TESTING when they can
 * install it; PROCESSING, PROCESSING_EXCEPTION, MISSING_EXPORT_COMPLIANCE,
 * IN_EXPORT_COMPLIANCE_REVIEW or EXPIRED when they cannot.
 */
async function internalState(call, buildId) {
  const route = `/v1/builds/${encodeURIComponent(buildId)}/buildBetaDetail`;
  const body = await call("read the build's TestFlight state", 'GET', route);
  return String(body?.data?.attributes?.internalBuildState ?? 'UNKNOWN');
}

async function testerCount(call, groupId) {
  const route = `/v1/betaGroups/${encodeURIComponent(groupId)}/relationships/betaTesters?limit=200`;
  const body = await call("count the group's testers", 'GET', route);
  const total = body?.meta?.paging?.total;
  if (typeof total === 'number') return total;
  return Array.isArray(body?.data) ? body.data.length : 0;
}

/**
 * The calls the scripts make. `token` is a signed token; `transport` sends one request.
 * @param {{ token: string, transport?: typeof httpsTransport }} options
 */
export function ascClient({ token, transport = httpsTransport }) {
  const call = caller(token, transport);
  return Object.freeze({
    app: (appId) => readApp(call, appId),
    groups: (appId) => listGroups(call, appId),
    createInternalGroup: (appId, name) => createInternalGroup(call, appId, name),
    newestBuild: (appId) => newestBuild(call, appId),
    internalState: (buildId) => internalState(call, buildId),
    testerCount: (groupId) => testerCount(call, groupId),
  });
}

/** The group that delivers every build: internal, with automatic distribution. */
export const deliveringGroup = (groups) =>
  groups.find((group) => group.internal && group.allBuilds);
