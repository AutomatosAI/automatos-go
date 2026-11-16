// Runs a workflow hook's shell script the way an EAS job does (sh -c, this run's sha in place of
// `${{ github.sha }}`), with a stand-in for git first on PATH, so eas-release.test.ts can check
// what publish_update's head check DOES, not only what its text says. The stand-in answers
// `git ls-remote <remote> refs/heads/main` from the remotes a test gives, notes which remotes it
// was asked, and fails as git does (an error line, status 128) for a remote it cannot read. Like
// git, it can also list refs that only end in refs/heads/main (a branch x/refs/heads/main, a tag
// named so), sorted around main's own line as ls-remote sorts them.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { z } from 'zod';

const SHA_PLACEHOLDER = '${{ github.sha }}';
export const ORIGIN = 'origin';
export const PUBLIC_ADDRESS = 'https://github.com/AutomatosAI/automatos-go.git';
export const OWN_MAIN = `git ls-remote ${ORIGIN} refs/heads/main`;
export const PUBLIC_MAIN = `git ls-remote ${PUBLIC_ADDRESS} refs/heads/main`;
/** What each read keeps of ls-remote's answer: the sha on the line for exactly refs/heads/main. */
export const EXACT_MAIN = `| awk '$2=="refs/heads/main"{print $1}'`;

const FAKE_GIT = [
  '#!/bin/sh',
  'echo "$2" >> "$FAKE_LOG"',
  'if [ "$2" = origin ]; then head="$FAKE_ORIGIN"; else head="$FAKE_PUBLIC"; fi',
  '[ -n "$head" ] || { echo "fatal: could not read from remote repository" >&2; exit 128; }',
  '[ -z "$FAKE_LOOK_ALIKE" ] || printf "%s\\trefs/heads/a/refs/heads/main\\n" "$FAKE_LOOK_ALIKE"',
  'printf "%s\\trefs/heads/main\\n" "$head"',
  '[ -z "$FAKE_LOOK_ALIKE" ] || printf "%s\\trefs/tags/refs/heads/main\\n" "$FAKE_LOOK_ALIKE"',
  '',
].join('\n');

const hookStepsSchema = z.object({
  before_update: z.array(z.object({ name: z.string(), run: z.string() })).min(1),
});

export type HookStep = z.infer<typeof hookStepsSchema>['before_update'][number];

/** publish_update's before_update steps, in the order EAS runs them. */
export function beforeUpdateSteps(hooks: unknown): readonly HookStep[] {
  return hookStepsSchema.parse(hooks).before_update;
}

/**
 * What main's head reads as through the checkout (origin) and from the public address, and the
 * sha of look-alike refs a remote that answers also lists.
 */
export type Remotes = {
  readonly origin?: string;
  readonly public?: string;
  readonly lookAlike?: string;
};

export type HookRun = {
  readonly status: number | null;
  /** The remotes git was asked for, in order. */
  readonly asked: readonly string[];
  /** stdout then stderr. */
  readonly out: string;
};

export function runHeadCheck(run: string, sha: string, remotes: Remotes): HookRun {
  const dir = mkdtempSync(path.join(tmpdir(), 'head-check-'));
  const log = path.join(dir, 'asked');
  try {
    writeFileSync(path.join(dir, 'git'), FAKE_GIT, { mode: 0o755 });
    writeFileSync(log, '');
    const result = spawnSync('sh', ['-c', run.replace(SHA_PLACEHOLDER, sha)], {
      encoding: 'utf8',
      env: {
        NODE_ENV: 'test',
        PATH: `${dir}${path.delimiter}${process.env.PATH ?? ''}`,
        FAKE_LOG: log,
        FAKE_ORIGIN: remotes.origin ?? '',
        FAKE_PUBLIC: remotes.public ?? '',
        FAKE_LOOK_ALIKE: remotes.lookAlike ?? '',
      },
    });
    const asked = readFileSync(log, 'utf8').split('\n').filter(Boolean);
    return { status: result.status, asked, out: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
