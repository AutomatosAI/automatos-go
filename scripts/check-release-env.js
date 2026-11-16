// Release-env guard — runs on the EAS build server as the `eas-build-pre-install`
// hook, before anything is compiled. EXPO_PUBLIC_* values are inlined at build
// time, and `.env` is gitignored, so a cloud build only sees what the EAS
// environment (`eas env:create`) holds. Without this check a store build with
// no Clerk key or no hosted server compiles fine and ships a sign-in screen that
// cannot sign anyone in — exactly what App Review rejects as incomplete.
//
// production: missing must-haves FAIL the build. preview and testflight: they warn only, so a
// device-pass build can still be made against test keys. A Sentry DSN that is set but not in
// Sentry's EU region (D44) is one of them: the app refuses it (src/observability/options.ts
// isEuDsn, the same grammar as below), so a store build would ship with crash reports silently off.
//
// One thing fails every checked profile: a hosted address that is set but is not a bare https
// address. The app refuses it the moment it starts (src/lib/env.ts isServerAddress, the same rule
// as below), so such a build could only ever crash at launch.
//
// One thing fails EVERY profile, a development, unknown or empty one too: an EXPO_PUBLIC_ value
// that is a secret. Such values are written into the JavaScript that ships, so a secret in one
// goes to every phone (it has happened to this app once). It is found by the variable's name, or
// by the way its value begins. The message names the variable and what it looks like, never the
// value or any part of it.
//
// It also runs in the update job (.eas/workflows/testflight.yml publish_update), which exports a
// bundle with no build and so no build hook. An update job sets no EAS_BUILD_PROFILE, so the
// profile is taken from the first argument when one is given. Node's built-ins only: the hook
// needs no install.

const SENTRY_DSN = 'EXPO_PUBLIC_SENTRY_DSN';
/** The names Expo writes into the bundle: everything under it is public by design. */
const PUBLIC_PREFIX = 'EXPO_PUBLIC_';

/**
 * Words that, in an EXPO_PUBLIC_ name, say the value is a secret. Each names something that is
 * never public: SECRET (a secret key, a client or webhook secret), PRIVATE_KEY (the private half
 * of a key pair), PASSWORD, AUTH_TOKEN (a service's own token, such as the crash reporter's
 * source-map upload token, SENTRY_AUTH_TOKEN). Not KEY or TOKEN alone: a publishable key is public
 * and named so (EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY), as is a DSN.
 */
const SECRET_NAME_WORDS = ['SECRET', 'PRIVATE_KEY', 'PASSWORD', 'AUTH_TOKEN'];

/** Starts the value with one of the prefixes. */
function startsWithOne(prefixes) {
  return (value) => prefixes.some((prefix) => value.startsWith(prefix));
}

/** A long run of the characters keys and tokens are written in (base64url). */
const KEY_RUN = '[A-Za-z0-9_-]';

/**
 * The EXPO_PUBLIC_ names allowed to hold a JSON Web Token, empty by default. Some stacks hand out
 * a token that is public by design (an anonymous client key, say). A name goes here only with a
 * comment beside it saying what the token is and why it is public: every other token is someone's
 * session or a server's key.
 */
const PUBLIC_TOKEN_NAMES = [];

/**
 * How secret keys begin, by kind. A publishable key (pk_live_, pk_test_) and a DSN are public and
 * match none. A cloud access key id is matched with its length too (four capitals, then 16
 * capitals or digits), so a word such as a region name that happens to begin the same passes; a
 * generic sk- key and a cloud platform's API key likewise. The first kind a value matches is the
 * one named. A JSON Web Token is allowed only under a name in PUBLIC_TOKEN_NAMES.
 */
const SECRET_VALUE_SHAPES = [
  {
    kind: "a sign-in or payment provider's secret key",
    test: startsWithOne(['sk_live_', 'sk_test_']),
  },
  { kind: "a payment provider's restricted key", test: startsWithOne(['rk_live_', 'rk_test_']) },
  { kind: 'a webhook signing secret', test: startsWithOne(['whsec_']) },
  {
    kind: "a model provider's API key",
    test: startsWithOne(['sk-ant-', 'sk-proj-', 'sk-or-']),
  },
  { kind: "a code host's access token", test: startsWithOne(['ghp_', 'github_pat_', 'gho_']) },
  { kind: 'a cloud access key id', test: (value) => /^A(?:KI|SI)A[A-Z0-9]{16}/.test(value) },
  { kind: "a chat platform's bot or user token", test: startsWithOne(['xoxb-', 'xoxp-']) },
  { kind: "the platform's server key", test: startsWithOne(['ak_srv_']) },
  { kind: 'a PEM block (a private key or certificate)', test: startsWithOne(['-----BEGIN']) },
  {
    kind: 'a secret API key',
    test: (value) => new RegExp(`^sk-${KEY_RUN}{20,}`).test(value),
  },
  {
    kind: "a cloud platform's API key",
    test: (value) => new RegExp(`^AIza${KEY_RUN}{35}`).test(value),
  },
  { kind: 'a token from an Authorization header', test: (value) => /^bearer\s+\S/i.test(value) },
  {
    kind: 'a signed token (a JSON Web Token)',
    test: (value) => new RegExp(`^eyJ${KEY_RUN}*\\.${KEY_RUN}+\\.${KEY_RUN}*`).test(value),
    // allowed under a name in PUBLIC_TOKEN_NAMES
    publicUnderListedNames: true,
  },
];

const SHIPS_TO_EVERY_PHONE =
  ': an EXPO_PUBLIC_ value is written into the app every phone downloads, so it is never ' +
  'secret. Remove it from the EAS environment and rotate it where it was issued.';
/** Sentry's EU ingest hosts are o<org>.ingest.de.sentry.io (src/observability/options.ts). */
const EU_INGEST_HOST_SUFFIX = '.ingest.de.sentry.io';
// @sentry/core's DSN grammar (utils/dsn.js DSN_REGEX), as options.ts reads it: the host it checks
// is the host the SDK sends to.
const DSN_PATTERN = /^(?:(\w+):)\/\/(?:(\w+)(?::(\w+)?)?@)([\w.-]+)(?::(\d+))?\/(.+)/;

const REQUIRED = [
  {
    name: 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
    why: 'hosted sign-in (Clerk)',
    // a test-instance key in a store build: every user lands in the dev instance
    productionPrefix: 'pk_live_',
  },
  { name: 'EXPO_PUBLIC_API_URL', why: 'the hosted Automatos API (the built-in server)' },
  { name: 'EXPO_PUBLIC_WEB_URL', why: 'links into hosted Studio' },
];

/** The two addresses a build is given (src/lib/env.ts holds them to the same form at launch). */
const SERVER_ADDRESSES = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_WEB_URL'];
/** What never belongs in a server's address: a user name, a query, a fragment, a backslash. */
const NEVER_IN_AN_ADDRESS = ['@', '?', '#', '\\'];

const RECOMMENDED = [{ name: SENTRY_DSN, why: 'error reporting (Sentry EU) stays off without it' }];

const STRICT_PROFILES = new Set(['production']);
const CHECKED_PROFILES = new Set(['production', 'preview', 'testflight']);

function isSet(env, name) {
  return (env[name] ?? '').trim() !== '';
}

function requiredProblems(env, item, strict) {
  const value = (env[item.name] ?? '').trim();
  if (!value) return [`${item.name} is not set — needed for ${item.why}.`];
  const testKey = strict && item.productionPrefix && !value.startsWith(item.productionPrefix);
  return testKey
    ? [`${item.name} must be a production key (${item.productionPrefix}…) in a store build.`]
    : [];
}

/** True only for an https DSN whose host is a subdomain of Sentry's EU ingest host. */
function isEuDsn(dsn) {
  const match = DSN_PATTERN.exec(dsn);
  if (!match) return false;
  const [, protocol, , , host = ''] = match;
  return protocol === 'https' && host.toLowerCase().endsWith(EU_INGEST_HOST_SUFFIX);
}

/** https, a host and an optional port, and nothing more: src/lib/env.ts for a release build. */
function isServerAddress(value) {
  if (NEVER_IN_AN_ADDRESS.some((mark) => value.includes(mark))) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.hostname === '' || url.pathname !== '/') return false;
  // written as the parser reads it: the text itself is what every request is built on
  return url.origin === (value.endsWith('/') ? value.slice(0, -1) : value);
}

/** A hosted address that is set and is not one the app accepts: the variable's name, never its value. */
function addressProblems(env) {
  return SERVER_ADDRESSES.flatMap((name) => {
    const value = (env[name] ?? '').trim();
    if (!value || isServerAddress(value)) return [];
    return [
      `${name} must be the https address of the server and nothing more (no user name or ` +
        'password, no path, no query, no fragment): the app refuses it at launch.',
    ];
  });
}

function sentryRegionProblems(env) {
  const dsn = (env[SENTRY_DSN] ?? '').trim();
  if (!dsn || isEuDsn(dsn)) return [];
  return [
    `${SENTRY_DSN} is not a Sentry EU DSN (its host must end ${EU_INGEST_HOST_SUFFIX}, D44): ` +
      'the app sends no crash report with it.',
  ];
}

/** The value as it ships: without the spaces or quotes pasted around it. */
function bareValue(value) {
  return (value ?? '').trim().replace(/^["']+/, '');
}

/** True when the value has the shape, and the shape is not allowed under this name. */
function giveaway(shape, name, bare, publicTokenNames) {
  const allowed = shape.publicUnderListedNames === true && publicTokenNames.includes(name);
  return !allowed && shape.test(bare);
}

/** What one EXPO_PUBLIC_ variable gives away, if anything: by its value first, then its name. */
function secretProblem(name, value, publicTokenNames) {
  const bare = bareValue(value);
  if (!bare) return [];
  const shape = SECRET_VALUE_SHAPES.find((candidate) =>
    giveaway(candidate, name, bare, publicTokenNames),
  );
  if (shape) return [`${name} looks like ${shape.kind}${SHIPS_TO_EVERY_PHONE}`];
  const unprefixed = name.slice(PUBLIC_PREFIX.length).toUpperCase();
  const word = SECRET_NAME_WORDS.find((candidate) => unprefixed.includes(candidate));
  return word ? [`${name} is named as a secret (it says ${word})${SHIPS_TO_EVERY_PHONE}`] : [];
}

/** Every set EXPO_PUBLIC_ variable that is, or looks like, a secret: its name, never its value. */
function publicSecretProblems(env, publicTokenNames = PUBLIC_TOKEN_NAMES) {
  return Object.keys(env)
    .filter((name) => name.startsWith(PUBLIC_PREFIX))
    .sort()
    .flatMap((name) => secretProblem(name, env[name], publicTokenNames));
}

/**
 * Pure check over an env map — returns `{ errors, warnings }` as message lists. A secret in an
 * EXPO_PUBLIC_ value is an error in every profile, checked or not. For a profile that is not
 * strict (store-bound), `errors` holds besides only what the app itself would refuse at launch: a
 * hosted address that is not a bare https address. publicTokenNames is PUBLIC_TOKEN_NAMES; a
 * test may give another list.
 */
function checkReleaseEnv(env, profile, publicTokenNames = PUBLIC_TOKEN_NAMES) {
  const leaked = publicSecretProblems(env, publicTokenNames);
  if (!CHECKED_PROFILES.has(profile)) return { errors: leaked, warnings: [] };
  const strict = STRICT_PROFILES.has(profile);
  const problems = [
    ...REQUIRED.flatMap((item) => requiredProblems(env, item, strict)),
    ...sentryRegionProblems(env),
  ];
  const unset = RECOMMENDED.filter((item) => !isSet(env, item.name)).map(
    (item) => `${item.name} is not set — ${item.why}.`,
  );
  const refused = addressProblems(env);
  return strict
    ? { errors: [...leaked, ...problems, ...refused], warnings: unset }
    : { errors: [...leaked, ...refused], warnings: [...problems, ...unset] };
}

/** The profile to check: the first argument when one is given (an update job), else the build's. */
function profileFrom(argv, env) {
  const given = (argv[2] ?? '').trim();
  return given || (env.EAS_BUILD_PROFILE ?? '');
}

// CLI output goes to stdout/stderr directly: eslint's no-console holds everywhere
// but src/lib/logger.ts, and a build hook has no app logger.
function say(stream, message) {
  stream.write(`[release-env] ${message}\n`);
}

function main() {
  const profile = profileFrom(process.argv, process.env);
  const { errors, warnings } = checkReleaseEnv(process.env, profile);
  for (const message of warnings) say(process.stderr, `warning: ${message}`);
  if (errors.length === 0) {
    say(process.stdout, `ok for profile "${profile || 'none'}"`);
    return;
  }
  for (const message of errors) say(process.stderr, `error: ${message}`);
  const leaked = publicSecretProblems(process.env).length;
  if (leaked > 0) {
    say(
      process.stderr,
      `${leaked} EXPO_PUBLIC_ value(s) above may already be in a bundle that was built or ` +
        'published: rotate each one, whatever this run does.',
    );
  }
  if (errors.length > leaked) {
    say(
      process.stderr,
      `set the missing values with \`eas env:create --environment ${profile}\` ` +
        '(see README, human steps) and rebuild.',
    );
  }
  process.exit(1);
}

module.exports = { checkReleaseEnv, isEuDsn, isServerAddress, profileFrom, PUBLIC_TOKEN_NAMES };

if (require.main === module) main();
