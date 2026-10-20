// TestFlight delivery decision — the one place testflight.yml decides between
// waiting, an over-the-air update and a native build. Plain Node, no
// dependencies: it runs before anything but `npm ci --ignore-scripts`.
//
//   wait    a testflight iOS build is already new / queued / building — never
//           start a second one (D48: two quick merges must not cost two builds)
//   update  the tree's fingerprint matches the last finished build — JS only,
//           ship over the air (minutes, no build quota)
//   build   no finished build yet, a different fingerprint, or one we could not
//           compare — a native build (~25 min, one of the 15 iOS builds a month)
//
// CLI (used by .github/workflows/testflight.yml; prints the decision):
//   node scripts/testflight-decide.js --in-progress false --last-finished-id <id> \
//     --fingerprints-identical true|false|'' --requested auto|update|build

const { parseArgs } = require('node:util');

const REQUESTS = new Set(['auto', 'update', 'build']);

/**
 * Pure decision. `fingerprintsIdentical` is null when no comparison was made.
 * @param {{inProgress: boolean, lastFinishedId: string | null,
 *          fingerprintsIdentical: boolean | null, requested: 'auto' | 'update' | 'build'}} input
 * @returns {'wait' | 'build' | 'update'}
 */
function decide({ inProgress, lastFinishedId, fingerprintsIdentical, requested }) {
  if (inProgress) return 'wait';
  if (requested === 'update' || requested === 'build') return requested;
  if (!lastFinishedId) return 'build';
  return fingerprintsIdentical === true ? 'update' : 'build';
}

function parseBoolean(name, value) {
  if (value === 'true') return true;
  if (value === 'false' || value === '' || value === undefined) return false;
  throw new Error(`--${name} must be true or false, got "${value}"`);
}

function parseOptionalBoolean(name, value) {
  if (value === '' || value === undefined) return null;
  return parseBoolean(name, value);
}

/** argv (without node and the script) → the decide() input; throws on bad input. */
function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'in-progress': { type: 'string' },
      'last-finished-id': { type: 'string' },
      'fingerprints-identical': { type: 'string' },
      requested: { type: 'string' },
    },
    strict: true,
  });
  const requested = values.requested || 'auto';
  if (!REQUESTS.has(requested)) {
    throw new Error(`--requested must be one of auto, update, build, got "${requested}"`);
  }
  return {
    inProgress: parseBoolean('in-progress', values['in-progress']),
    lastFinishedId: values['last-finished-id'] || null,
    fingerprintsIdentical: parseOptionalBoolean(
      'fingerprints-identical',
      values['fingerprints-identical'],
    ),
    requested,
  };
}

// CLI output goes to stdout/stderr directly (eslint's no-console holds here too).
function main() {
  try {
    process.stdout.write(`${decide(parseCli(process.argv.slice(2)))}\n`);
  } catch (error) {
    process.stderr.write(`[testflight-decide] ${error.message}\n`);
    process.exit(2);
  }
}

module.exports = { decide, parseCli };

if (require.main === module) main();
