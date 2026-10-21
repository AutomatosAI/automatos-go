// Release-env guard — runs on the EAS build server as the `eas-build-pre-install`
// hook, before anything is compiled. EXPO_PUBLIC_* values are inlined at build
// time, and `.env` is gitignored, so a cloud build only sees what the EAS
// environment (`eas env:create`) holds. Without this check a store build with
// no Clerk key or no hosted server compiles fine and ships a sign-in screen that
// cannot sign anyone in — exactly what App Review rejects as incomplete.
//
// production: missing must-haves FAIL the build. preview and testflight: they warn only, so a
// device-pass build can still be made against test keys.

const REQUIRED = [
  {
    name: 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
    why: 'hosted sign-in (Clerk)',
    // a test-instance key in a store build: every user lands in the dev instance
    productionPrefix: 'pk_live_',
  },
  { name: 'EXPO_PUBLIC_API_URL', why: 'the hosted Automatos API (the built-in server)' },
  { name: 'EXPO_PUBLIC_WEB_URL', why: "hosted Studio ('Create an account in Studio')" },
];

const RECOMMENDED = [
  { name: 'EXPO_PUBLIC_SENTRY_DSN', why: 'error reporting (Sentry EU) stays off without it' },
];

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

/**
 * Pure check over an env map — returns `{ errors, warnings }` as message lists.
 * `errors` is only ever non-empty for a strict (store-bound) profile.
 */
function checkReleaseEnv(env, profile) {
  if (!CHECKED_PROFILES.has(profile)) return { errors: [], warnings: [] };
  const strict = STRICT_PROFILES.has(profile);
  const problems = REQUIRED.flatMap((item) => requiredProblems(env, item, strict));
  const unset = RECOMMENDED.filter((item) => !isSet(env, item.name)).map(
    (item) => `${item.name} is not set — ${item.why}.`,
  );
  return strict
    ? { errors: problems, warnings: unset }
    : { errors: [], warnings: [...problems, ...unset] };
}

// CLI output goes to stdout/stderr directly: eslint's no-console holds everywhere
// but src/lib/logger.ts, and a build hook has no app logger.
function say(stream, message) {
  stream.write(`[release-env] ${message}\n`);
}

function main() {
  const profile = process.env.EAS_BUILD_PROFILE ?? '';
  const { errors, warnings } = checkReleaseEnv(process.env, profile);
  for (const message of warnings) say(process.stderr, `warning: ${message}`);
  if (errors.length === 0) {
    say(process.stdout, `ok for profile "${profile || 'none'}"`);
    return;
  }
  for (const message of errors) say(process.stderr, `error: ${message}`);
  say(
    process.stderr,
    `set the missing values with \`eas env:create --environment ${profile}\` ` +
      '(see README, human steps) and rebuild.',
  );
  process.exit(1);
}

module.exports = { checkReleaseEnv };

if (require.main === module) main();
