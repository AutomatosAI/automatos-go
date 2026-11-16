// The first release as code (scripts/release/first-release.mjs, docs/release/README.md "First
// release"), over a fake App Store Connect: nothing here talks to Apple. The token is signed with a
// key generated for the run and checked with its public half; the group is created only when no
// internal group with automatic distribution exists, never changed or deleted, and only with
// --apply; and no line printed holds the token, the key's id or the issuer.

import { generateKeyPairSync, verify } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { afterAll, describe, expect, it } from 'vitest';

import {
  ASC_API,
  AUDIENCE,
  MAX_ANSWER_BYTES,
  TOKEN_SECONDS,
  httpsTransport,
  readAscKey,
  signToken,
} from '../release/asc.mjs';
import { DEFAULT_GROUP, parseArgs, run } from '../release/first-release.mjs';
import {
  FAKE_APP_ID,
  FAKE_BUNDLE,
  FAKE_ISSUER,
  FAKE_KEY_ID,
  captureIo,
  fakeApp,
  fakeAsc,
  keyEnv,
  readKeyFrom,
  scratchFolder,
  testKey,
  type AscRequest,
  type AscState,
} from './release-fixtures';

const scratch = scratchFolder('release-first-release-');
afterAll(scratch.cleanup);
const key = testKey();
const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);
const APP = { name: 'Example Go', bundleId: FAKE_BUNDLE };
const DELIVERING = { id: 'g1', name: 'Team', internal: true, allBuilds: true };

async function release(
  state: AscState,
  argv: string[] = [],
  options: { root?: string; env?: Record<string, string> } = {},
) {
  const asc = fakeAsc(state);
  const captured = captureIo();
  const code = await run({
    argv,
    env: options.env ?? keyEnv(),
    root: options.root ?? fakeApp(scratch.dir),
    transport: asc.transport,
    readKey: readKeyFrom(key.pem),
    now: NOW,
    io: captured.io,
  });
  const printed = [...captured.out, ...captured.err].join('\n');
  return { code, out: captured.out, err: captured.err, printed, requests: asc.requests };
}

const posts = (requests: AscRequest[]) => requests.filter((r) => r.method !== 'GET');
const tokenOf = (requests: { headers: Record<string, string> }[]) =>
  requests[0]?.headers.authorization.replace(/^Bearer /, '') ?? '';

describe('the token (ES256, team key)', () => {
  const token = signToken({
    privateKeyPem: key.pem,
    keyId: FAKE_KEY_ID,
    issuerId: FAKE_ISSUER,
    now: NOW,
  });
  const [header, claims, signature] = token.split('.');
  const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

  it("names the key in its header and Apple's audience, issuer and lifetime in its claims", () => {
    expect(decode(header)).toEqual({ alg: 'ES256', kid: FAKE_KEY_ID, typ: 'JWT' });
    const issuedAt = Math.floor(NOW / 1000);
    expect(decode(claims)).toEqual({
      iss: FAKE_ISSUER,
      iat: issuedAt,
      exp: issuedAt + TOKEN_SECONDS,
      aud: AUDIENCE,
    });
    expect(TOKEN_SECONDS).toBeLessThanOrEqual(20 * 60);
  });

  it('is signed with the raw 64-byte signature JWS uses, which the public key verifies', () => {
    const raw = Buffer.from(signature, 'base64url');
    expect(raw).toHaveLength(64);
    const data = Buffer.from(`${header}.${claims}`);
    expect(verify('sha256', data, { key: key.publicKey, dsaEncoding: 'ieee-p1363' }, raw)).toBe(
      true,
    );
  });

  it('refuses a file that is not a private key, without quoting it', () => {
    expect(() => signToken({ privateKeyPem: 'not a key', keyId: 'k', issuerId: 'i' })).toThrow(
      'the file EXPO_ASC_API_KEY_PATH names is not a private key',
    );
  });

  it('refuses a key that is not EC P-256 (an RSA key here), without quoting it', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const rsaPem = String(privateKey.export({ type: 'pkcs8', format: 'pem' }));
    let message = '';
    try {
      signToken({ privateKeyPem: rsaPem, keyId: 'k', issuerId: 'i' });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toBe(
      'the file EXPO_ASC_API_KEY_PATH names is not an EC P-256 key, which every App Store Connect API key is',
    );
    expect(message).not.toContain(rsaPem.split('\n')[1]);
  });

  it('reads the names eas-cli reads, and says which are unset (never a value)', () => {
    expect(readAscKey({})).toEqual({
      ok: false,
      why: 'no App Store Connect key (EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID, EXPO_ASC_ISSUER_ID unset)',
    });
    const partial = readAscKey({ EXPO_ASC_API_KEY_PATH: '/k.p8', EXPO_ASC_KEY_ID: ' ' });
    expect(partial).toEqual({
      ok: false,
      why: 'the App Store Connect key is incomplete: EXPO_ASC_KEY_ID, EXPO_ASC_ISSUER_ID unset',
    });
    expect(readAscKey(keyEnv())).toMatchObject({
      ok: true,
      keyId: FAKE_KEY_ID,
      issuerId: FAKE_ISSUER,
    });
  });
});

describe('first-release.mjs: options', () => {
  it('is a dry run on the testflight profile and the group name eas-cli uses, by default', () => {
    expect(parseArgs([])).toEqual({ apply: false, profile: 'testflight', group: DEFAULT_GROUP });
    expect(DEFAULT_GROUP).toBe('Team (Expo)');
    expect(parseArgs(['--apply', '--group', 'Team', '--profile', 'beta'])).toEqual({
      apply: true,
      profile: 'beta',
      group: 'Team',
    });
  });

  it.each([[['--force']], [['--group']], [['--group', '--apply']], [['--profile', ' ']]])(
    'refuses %j with the usage',
    async (argv) => {
      const result = await release({ app: APP, groups: [] }, argv);
      expect(result.code).toBe(1);
      expect(result.err.join('\n')).toMatch(
        /^FAIL: .*usage: node scripts\/release\/first-release\.mjs/,
      );
      expect(result.requests).toEqual([]);
    },
  );
});

describe('first-release.mjs: an app App Store Connect already has', () => {
  it('finds the delivering group and does nothing else, even with --apply', async () => {
    const result = await release({ app: APP, groups: [DELIVERING], testers: { g1: 3 } }, [
      '--apply',
    ]);
    expect(result.code).toBe(0);
    expect(result.out).toEqual([
      `found: App Store Connect app "Example Go" (${FAKE_BUNDLE})`,
      'found: internal TestFlight group "Team" with automatic distribution',
      'found: "Team" has 3 tester(s)',
    ]);
    expect(posts(result.requests)).toEqual([]);
  });

  it('says what it would create on a dry run, and creates nothing', async () => {
    const result = await release({ app: APP, groups: [] });
    expect(result.code).toBe(0);
    expect(result.out).toContain(
      'found: no internal TestFlight group with automatic distribution (0 group(s) in all)',
    );
    expect(result.out).toContain(
      'would create: internal TestFlight group "Team (Expo)" with automatic distribution (run again with --apply)',
    );
    expect(posts(result.requests)).toEqual([]);
  });

  it('creates it with --apply, internal with automatic distribution, and names the testers step', async () => {
    const state: AscState = { app: APP, groups: [] };
    const result = await release(state, ['--apply']);
    expect(result.code).toBe(0);
    const [create] = posts(result.requests);
    expect(create.url).toBe(`${ASC_API}/v1/betaGroups`);
    expect(JSON.parse(create.body ?? '')).toEqual({
      data: {
        type: 'betaGroups',
        attributes: { name: 'Team (Expo)', isInternalGroup: true, hasAccessToAllBuilds: true },
        relationships: { app: { data: { type: 'apps', id: FAKE_APP_ID } } },
      },
    });
    expect(result.out).toContain(
      'created: internal TestFlight group "Team (Expo)" with automatic distribution',
    );
    expect(result.out).toContain('found: "Team (Expo)" has 0 tester(s)');
    expect(result.out.at(-1)).toMatch(
      /^to do: add the team's App Store Connect users to "Team \(Expo\)"/,
    );
  });

  it('is idempotent: a second --apply finds the group it made and creates nothing', async () => {
    const state: AscState = { app: APP, groups: [] };
    await release(state, ['--apply']);
    const again = await release(state, ['--apply']);
    expect(again.code).toBe(0);
    expect(posts(again.requests)).toEqual([]);
    expect(state.groups).toHaveLength(1);
  });

  it('creates one beside groups that do not deliver every build, and leaves them as they are', async () => {
    const others = [
      { id: 'x1', name: 'Friends', internal: false, allBuilds: false },
      { id: 'x2', name: 'Picked builds', internal: true, allBuilds: false },
    ];
    const result = await release({ app: APP, groups: [...others] }, ['--apply']);
    expect(result.code).toBe(0);
    expect(result.out).toContain(
      'found: no internal TestFlight group with automatic distribution (2 group(s) in all)',
    );
    expect(posts(result.requests)).toHaveLength(1);
    expect(result.requests.filter((r) => r.method === 'PATCH' || r.method === 'DELETE')).toEqual(
      [],
    );
  });

  it('stops when a group of that name exists without automatic distribution (the API cannot switch it on)', async () => {
    const same = { id: 'x3', name: 'Team (Expo)', internal: true, allBuilds: false };
    const result = await release({ app: APP, groups: [same] }, ['--apply']);
    expect(result.code).toBe(1);
    expect(result.err.join('\n')).toContain(
      'the group "Team (Expo)" exists but does not show as internal with automatic distribution',
    );
    expect(posts(result.requests)).toEqual([]);
  });

  it('stops on an internal group whose automatic distribution Apple answers as null, making no second one', async () => {
    const unknown = { id: 'x4', name: 'Team', internal: true, allBuilds: null };
    const result = await release({ app: APP, groups: [unknown] }, ['--apply']);
    expect(result.code).toBe(1);
    expect(result.err.join('\n')).toMatch(
      /^FAIL: check automatic distribution for group "Team" in App Store Connect/,
    );
    expect(posts(result.requests)).toEqual([]);
  });

  it('creates one beside an external group whose automatic distribution is null', async () => {
    const external = { id: 'x5', name: 'Friends', internal: false, allBuilds: null };
    const result = await release({ app: APP, groups: [external] }, ['--apply']);
    expect(result.code).toBe(0);
    expect(posts(result.requests)).toHaveLength(1);
  });

  it('stops when the groups run past one page, rather than make a second group', async () => {
    const result = await release({ app: APP, groups: [], morePages: true }, ['--apply']);
    expect(result.code).toBe(1);
    expect(result.err).toEqual(['FAIL: list the TestFlight groups: over 200 groups']);
    expect(posts(result.requests)).toEqual([]);
  });

  it("stops when eas.json's ascAppId is another app", async () => {
    const result = await release(
      { app: { name: 'Other', bundleId: 'com.example.other' }, groups: [] },
      ['--apply'],
    );
    expect(result.code).toBe(1);
    expect(result.err.join('\n')).toContain(
      `is the app com.example.other, not app.json's ${FAKE_BUNDLE}`,
    );
    expect(result.requests.map((r) => r.method)).toEqual(['GET']);
  });

  it("stops on App Store Connect's refusal, quoting Apple and nothing of the key", async () => {
    const result = await release({
      groups: [],
      failWith: { status: 401, title: 'Authentication credentials are missing or invalid.' },
    });
    expect(result.code).toBe(1);
    expect(result.err.join('\n')).toBe(
      'FAIL: read the app: App Store Connect answered HTTP 401 (NOT_AUTHORIZED: Authentication credentials are missing or invalid.)',
    );
  });
});

describe('first-release.mjs: what it needs before it asks', () => {
  it('points a new app at eas submit, which creates the app and its group, and asks nothing', async () => {
    const result = await release({ groups: [] }, ['--apply'], {
      root: fakeApp(scratch.dir, { ascAppId: null }),
    });
    expect(result.code).toBe(1);
    expect(result.out[0]).toBe(
      'found: no ascAppId in eas.json submit.testflight.ios: the app is not in App Store Connect yet.',
    );
    expect(result.out.join('\n')).toContain(
      'let the first eas submit create the app, so its internal TestFlight group comes with it',
    );
    expect(result.requests).toEqual([]);
  });

  it('says plainly when app.json has no bundle id, and asks nothing', async () => {
    const root = fakeApp(scratch.dir, { bundle: false });
    const result = await release({ app: APP, groups: [] }, [], { root });
    expect(result.code).toBe(1);
    expect(result.err).toEqual([
      'FAIL: app.json has no expo.ios.bundleIdentifier: set the bundle id before the first release',
    ]);
    expect(result.requests).toEqual([]);
  });

  it('names the unset key variables and asks nothing', async () => {
    const result = await release({ app: APP, groups: [] }, [], {
      env: { EXPO_ASC_KEY_ID: FAKE_KEY_ID },
    });
    expect(result.code).toBe(1);
    expect(result.err).toEqual([
      'FAIL: the App Store Connect key is incomplete: EXPO_ASC_API_KEY_PATH, EXPO_ASC_ISSUER_ID unset',
    ]);
    expect(result.requests).toEqual([]);
  });

  it('says it could not read the key file, without its path', async () => {
    const env = { ...keyEnv(), EXPO_ASC_API_KEY_PATH: '/elsewhere/secret-folder/key.p8' };
    const result = await release({ app: APP, groups: [] }, [], { env });
    expect(result.err).toEqual(['FAIL: could not read the file EXPO_ASC_API_KEY_PATH names']);
    expect(result.printed).not.toContain('secret-folder');
  });
});

describe('first-release.mjs: the token goes to Apple and nowhere else', () => {
  it('sends every request to App Store Connect with the bearer, and prints none of the key', async () => {
    const result = await release({ app: APP, groups: [], testers: {} }, ['--apply']);
    expect(result.requests.length).toBeGreaterThanOrEqual(3);
    const token = tokenOf(result.requests);
    expect(token.split('.')).toHaveLength(3);
    result.requests.forEach((request) => {
      expect(request.url.startsWith(`${ASC_API}/v1/`)).toBe(true);
      expect(request.headers.authorization).toBe(`Bearer ${token}`);
    });
    [token, ...token.split('.'), FAKE_KEY_ID, FAKE_ISSUER, key.pem.split('\n')[1]].forEach(
      (secret) => {
        expect(result.printed).not.toContain(secret);
      },
    );
  });
});

/** A fake https.request: answers with `status` and `chunks`, or never answers. */
function fakeSend(status: number, chunks: Buffer[] | 'silent') {
  return (
    _url: string,
    _options: unknown,
    onAnswer: (incoming: PassThrough & { statusCode: number }) => void,
  ) => {
    const outgoing = Object.assign(new EventEmitter(), {
      destroy: (error: Error) => outgoing.emit('error', error),
      end: () => {
        if (chunks === 'silent') {
          outgoing.emit('timeout');
          return;
        }
        const incoming = Object.assign(new PassThrough(), { statusCode: status });
        onAnswer(incoming);
        chunks.forEach((chunk) => incoming.write(chunk));
        incoming.end();
      },
    });
    return outgoing;
  };
}

describe('asc.mjs httpsTransport', () => {
  const request = { method: 'GET', url: `${ASC_API}/v1/apps/1`, headers: {} };

  it('gives a redirect back as its status, never following it', async () => {
    const send = fakeSend(302, []) as never;
    await expect(httpsTransport(request, { send })).resolves.toEqual({ status: 302, text: '' });
  });

  it('refuses an answer over its cap', async () => {
    const send = fakeSend(200, [Buffer.alloc(MAX_ANSWER_BYTES), Buffer.alloc(10)]) as never;
    await expect(httpsTransport(request, { send })).rejects.toThrow('over');
  });

  it('drops a silent socket', async () => {
    const send = fakeSend(200, 'silent') as never;
    await expect(httpsTransport(request, { send, timeoutMs: 5 })).rejects.toThrow(
      'no answer from App Store Connect',
    );
  });
});
