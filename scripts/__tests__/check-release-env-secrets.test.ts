// A secret in an EXPO_PUBLIC_ value (scripts/check-release-env.js): such values are written into
// the JavaScript every phone downloads, so one that is a secret fails every profile, the update
// job's too. Every made-up value here is built at run time from pieces, so this file holds nothing
// a secret scanner would flag. A message names the variable and the kind of thing, never the
// value or any part of it.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkReleaseEnv, profileFrom, PUBLIC_TOKEN_NAMES } from '../check-release-env';

const SCRIPT = path.resolve(__dirname, '../check-release-env.js');
const BODY = 'x'.repeat(24);
/** A made-up value: the pieces of a prefix, then a body of x's. */
const madeUp = (...pieces: string[]) => `${pieces.join('')}${BODY}`;
/** A made-up cloud access key id: its four capitals, then 16 more. */
const accessKeyId = (...pieces: string[]) => `${pieces.join('')}${'X'.repeat(16)}`;

const COMPLETE = {
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: madeUp('pk_', 'live_'),
  EXPO_PUBLIC_API_URL: 'https://api.automatos.app',
  EXPO_PUBLIC_WEB_URL: 'https://ui.automatos.app',
  EXPO_PUBLIC_SENTRY_DSN: 'https://key@o0.ingest.de.sentry.io/0',
};
const EVERY_PROFILE = ['production', 'preview', 'testflight', 'development', '', 'unknown'];
const EXTRA = 'EXPO_PUBLIC_EXTRA';

const SECRET_KEY = "a sign-in or payment provider's secret key";
const MODEL_KEY = "a model provider's API key";
const CODE_HOST = "a code host's access token";
const CHAT = "a chat platform's bot or user token";
const CLOUD = 'a cloud access key id';

/** [the value's prefix, in pieces; the kind the message names]. */
const VALUE_CASES: readonly (readonly [readonly string[], string])[] = [
  [['sk_', 'live_'], SECRET_KEY],
  [['sk_', 'test_'], SECRET_KEY],
  [['rk_', 'live_'], "a payment provider's restricted key"],
  [['rk_', 'test_'], "a payment provider's restricted key"],
  [['wh', 'sec_'], 'a webhook signing secret'],
  [['sk-', 'ant-'], MODEL_KEY],
  [['sk-', 'proj-'], MODEL_KEY],
  [['sk-', 'or-'], MODEL_KEY],
  [['gh', 'p_'], CODE_HOST],
  [['github', '_pat_'], CODE_HOST],
  [['gh', 'o_'], CODE_HOST],
  [['xo', 'xb-'], CHAT],
  [['xo', 'xp-'], CHAT],
  [['ak_', 'srv_'], "the platform's server key"],
  [['-----', 'BEGIN'], 'a PEM block'],
];

/** The one error a variable gives, checked to name it and the kind and to hold none of the value. */
function oneLeak(env: Record<string, string>, profile: string, value: string, prefix: string) {
  const { errors } = checkReleaseEnv(env, profile);
  expect(errors).toHaveLength(1);
  expect(errors[0]).not.toContain(value);
  expect(errors[0]).not.toContain(prefix);
  expect(errors[0]).not.toContain('xxxx');
  return errors[0];
}

describe('an EXPO_PUBLIC_ value that begins like a secret', () => {
  it.each(VALUE_CASES)(
    '%j fails every profile, naming the variable and its kind',
    (pieces, kind) => {
      const value = madeUp(...pieces);
      for (const profile of EVERY_PROFILE) {
        const message = oneLeak({ ...COMPLETE, [EXTRA]: value }, profile, value, pieces.join(''));
        expect(message.startsWith(`${EXTRA} looks like ${kind}`), profile).toBe(true);
        expect(message).toContain('rotate it');
      }
    },
  );

  it.each([
    ['AK', 'IA'],
    ['AS', 'IA'],
  ])('a cloud access key id (%s%s and 16 more) fails every profile', (...pieces) => {
    const value = accessKeyId(...pieces);
    for (const profile of EVERY_PROFILE) {
      const message = oneLeak({ ...COMPLETE, [EXTRA]: value }, profile, value, pieces.join(''));
      expect(message).toContain(CLOUD);
    }
  });

  it('is found with spaces or quotes pasted around it', () => {
    const value = madeUp('sk_', 'live_');
    for (const pasted of [`  ${value}  `, `"${value}"`, `'${value}'`]) {
      expect(oneLeak({ ...COMPLETE, [EXTRA]: pasted }, 'testflight', value, 'sk_live_')).toContain(
        SECRET_KEY,
      );
    }
  });

  it('is found in the publishable key variable itself (a secret key pasted there)', () => {
    const value = madeUp('sk_', 'live_');
    const env = { ...COMPLETE, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: value };
    expect(oneLeak(env, 'testflight', value, 'sk_live_')).toContain(SECRET_KEY);
    const { errors } = checkReleaseEnv(env, 'production');
    expect(errors[0]).toContain(`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY looks like ${SECRET_KEY}`);
    expect(errors.join('\n')).not.toContain(value);
  });
});

const GENERIC_KEY = 'a secret API key';
const CLOUD_API_KEY = "a cloud platform's API key";
const HEADER_TOKEN = 'a token from an Authorization header';
const WEB_TOKEN = 'a signed token (a JSON Web Token)';
/** A made-up JSON Web Token: three base64url parts, the first begun as a token's header is. */
const webToken = () =>
  [`${'ey'}${'J'}${'h'.repeat(20)}`, 'p'.repeat(20), 's'.repeat(20)].join('.');
/** A made-up cloud platform API key: its four letters, then 35 more. */
const cloudApiKey = (...pieces: string[]) => `${pieces.join('')}${'X'.repeat(35)}`;

// Since 16 Nov: the shapes a list of prefixes missed.
describe('a generic key, a cloud API key, a bearer token and a JSON Web Token', () => {
  it.each([
    [madeUp('sk', '-'), 'sk-', GENERIC_KEY],
    [`${'sk'}-${'a1_B-'.repeat(4)}`, 'sk-', GENERIC_KEY],
    [cloudApiKey('AI', 'za'), 'AIza', CLOUD_API_KEY],
    [madeUp('Bear', 'er '), 'Bearer ', HEADER_TOKEN],
    [madeUp('bear', 'er  '), 'bearer', HEADER_TOKEN],
    [webToken(), 'eyJ', WEB_TOKEN],
    [`${webToken().split('.').slice(0, 2).join('.')}.`, 'eyJ', WEB_TOKEN],
  ])('%#: fails every profile, naming the variable and the kind only', (value, prefix, kind) => {
    for (const profile of EVERY_PROFILE) {
      const message = oneLeak({ ...COMPLETE, [EXTRA]: value }, profile, value, prefix);
      expect(message.startsWith(`${EXTRA} looks like ${kind}`), profile).toBe(true);
    }
  });

  it("names a model provider's key as before, not the generic kind", () => {
    const value = madeUp('sk-', 'ant-');
    expect(oneLeak({ ...COMPLETE, [EXTRA]: value }, 'testflight', value, 'sk-ant-')).toContain(
      MODEL_KEY,
    );
  });

  it('passes what only begins the same: too short, no token, two parts', () => {
    const env = {
      ...COMPLETE,
      EXPO_PUBLIC_A: `${'sk'}-${'x'.repeat(19)}`,
      EXPO_PUBLIC_B: `${'AI'}${'za'}${'X'.repeat(34)}`,
      EXPO_PUBLIC_C: 'Bearer',
      EXPO_PUBLIC_D: 'bearer-of-news',
      EXPO_PUBLIC_E: webToken().split('.').slice(0, 2).join('.'),
      EXPO_PUBLIC_F: 'sky-blue',
    };
    expect(checkReleaseEnv(env, 'development').errors).toEqual([]);
  });

  it('allows a JSON Web Token only under a listed name, and lists none today', () => {
    expect(PUBLIC_TOKEN_NAMES).toEqual([]);
    const listed = 'EXPO_PUBLIC_ANON_TOKEN';
    const env = { ...COMPLETE, [listed]: webToken(), [EXTRA]: webToken() };
    const { errors } = checkReleaseEnv(env, 'testflight', [listed]);
    expect(errors).toEqual([expect.stringContaining(`${EXTRA} looks like ${WEB_TOKEN}`)]);
    const key = madeUp('sk_', 'live_');
    const secretThere = checkReleaseEnv({ ...COMPLETE, [listed]: key }, 'testflight', [listed]);
    expect(secretThere.errors).toEqual([
      expect.stringContaining(`${listed} looks like ${SECRET_KEY}`),
    ]);
    const unlisted = checkReleaseEnv({ ...COMPLETE, [listed]: webToken() }, 'testflight');
    expect(unlisted.errors).toEqual([expect.stringContaining(`${listed} looks like ${WEB_TOKEN}`)]);
  });

  it('still passes a publishable key and a DSN as they are issued', () => {
    const env = {
      ...COMPLETE,
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: `${'pk_'}${'live_'}${'Y2xlcmsuZXhhbXBsZS5jb20k'}`,
      EXPO_PUBLIC_SENTRY_DSN: `https://${'0f'.repeat(16)}@o4507.ingest.de.sentry.io/4508`,
    };
    for (const profile of EVERY_PROFILE) {
      expect(checkReleaseEnv(env, profile).errors, profile).toEqual([]);
    }
  });
});

describe('an EXPO_PUBLIC_ name that says it is a secret', () => {
  it.each([
    ['EXPO_PUBLIC_PAYMENTS_SECRET_KEY', 'SECRET'],
    ['EXPO_PUBLIC_OAUTH_client_secret', 'SECRET'],
    ['EXPO_PUBLIC_SIGNING_PRIVATE_KEY', 'PRIVATE_KEY'],
    ['EXPO_PUBLIC_ADMIN_PASSWORD', 'PASSWORD'],
    ['EXPO_PUBLIC_SENTRY_AUTH_TOKEN', 'AUTH_TOKEN'],
  ])('%s fails every profile (it says %s)', (name, word) => {
    const value = `plain-${'y'.repeat(12)}`;
    for (const profile of EVERY_PROFILE) {
      const { errors } = checkReleaseEnv({ ...COMPLETE, [name]: value }, profile);
      expect(errors).toEqual([
        expect.stringContaining(`${name} is named as a secret (it says ${word})`),
      ]);
      expect(errors[0]).not.toContain(value);
    }
  });

  it('gives one message when the value gives it away too: what the value looks like', () => {
    const value = madeUp('sk_', 'live_');
    const env = { ...COMPLETE, EXPO_PUBLIC_PAYMENTS_SECRET_KEY: value };
    expect(oneLeak(env, 'preview', value, 'sk_live_')).toContain(SECRET_KEY);
  });

  it('lists each variable once, in name order', () => {
    const env = {
      ...COMPLETE,
      EXPO_PUBLIC_B_PASSWORD: 'plain',
      EXPO_PUBLIC_A_TOKEN: madeUp('gh', 'p_'),
    };
    const { errors } = checkReleaseEnv(env, 'development');
    expect(errors.map((message) => message.split(' ')[0])).toEqual([
      'EXPO_PUBLIC_A_TOKEN',
      'EXPO_PUBLIC_B_PASSWORD',
    ]);
  });
});

describe('what is not a secret passes', () => {
  it.each(EVERY_PROFILE)('a publishable key, a DSN and the addresses pass for "%s"', (profile) => {
    expect(checkReleaseEnv(COMPLETE, profile).errors).toEqual([]);
    const testKey = { ...COMPLETE, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: madeUp('pk_', 'test_') };
    expect(checkReleaseEnv(testKey, profile === 'production' ? 'preview' : profile).errors).toEqual(
      [],
    );
  });

  it('a word that begins like a cloud key id, a blank secret name, an unset one', () => {
    const env = {
      ...COMPLETE,
      EXPO_PUBLIC_REGION: 'ASIA',
      EXPO_PUBLIC_AREA: 'ASIA_PACIFIC',
      EXPO_PUBLIC_CLIENT_SECRET: '   ',
      EXPO_PUBLIC_ADMIN_PASSWORD: undefined,
    };
    expect(checkReleaseEnv(env, 'development').errors).toEqual([]);
  });

  it('a secret outside EXPO_PUBLIC_: never written into the bundle, so not this check', () => {
    const env = {
      ...COMPLETE,
      SENTRY_AUTH_TOKEN: madeUp('tok', 'en_'),
      SECRET: madeUp('sk_', 'live_'),
    };
    expect(checkReleaseEnv(env, 'production')).toEqual({ errors: [], warnings: [] });
  });
});

describe('the profile, and the script as the hooks run it', () => {
  it('takes the first argument when given (an update job), else EAS_BUILD_PROFILE', () => {
    const build = { EAS_BUILD_PROFILE: 'production' };
    expect(profileFrom(['node', SCRIPT, 'testflight'], build)).toBe('testflight');
    expect(profileFrom(['node', SCRIPT], build)).toBe('production');
    expect(profileFrom(['node', SCRIPT, '  '], build)).toBe('production');
    expect(profileFrom(['node', SCRIPT], {})).toBe('');
  });

  // only the given values, never this shell's: an EXPO_PUBLIC_ value set here would change the run
  const runScript = (args: string[], env: Record<string, string>) =>
    spawnSync(process.execPath, [SCRIPT, ...args], {
      encoding: 'utf8',
      env: { NODE_ENV: 'test', ...env },
    });

  it('the update job: fails on a secret, says to rotate it, and never prints it', () => {
    const value = madeUp('sk_', 'live_');
    const result = runScript(['testflight'], { ...COMPLETE, [EXTRA]: value });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`error: ${EXTRA} looks like ${SECRET_KEY}`);
    expect(result.stderr).toContain('rotate each one');
    expect(result.stderr).not.toContain('set the missing values');
    expect(`${result.stdout}${result.stderr}`).not.toContain(BODY);
  });

  it('the update job: passes a clean environment for the profile it names', () => {
    const result = runScript(['testflight'], COMPLETE);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('[release-env] ok for profile "testflight"\n');
  });

  it('the build hook, no argument: still reads EAS_BUILD_PROFILE and fails production as before', () => {
    const env = { ...COMPLETE, EXPO_PUBLIC_API_URL: '', EAS_BUILD_PROFILE: 'production' };
    const result = runScript([], env);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('EXPO_PUBLIC_API_URL is not set');
    expect(result.stderr).toContain('eas env:create --environment production');
  });

  it("uses Node's built-ins only, so the update job's hook needs no install", () => {
    const source = readFileSync(SCRIPT, 'utf8');
    const required = [...source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
      (match) => match[1],
    );
    expect(required.filter((name) => !name.startsWith('node:'))).toEqual([]);
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
