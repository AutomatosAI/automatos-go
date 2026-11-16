// GitHub's actions run at a commit, never at a tag (the app standard's rule 14.1): a tag can be moved
// to other code after review, a commit cannot. Every `uses:` in the repository's own workflows names
// its action at a full 40-character commit sha, with the release that commit is written beside it
// (`actions/checkout@<sha> # v4.4.0`), so an update is a reviewed change to this file's subjects.
// malware-scan.yml is the one workflow no change edits (CLAUDE.md), so it is not held here: its own
// pins are its owner's. Each workflow is read twice, as lines (every line that says `uses:`) and as
// YAML (every step's and job's `uses`), so a step written some other way is not missed. ci.yml's
// job names are held too: branch protection reads them.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { PROJECT_ROOT } from './app-json';

const WORKFLOWS_DIR = '.github/workflows';
/** The workflow no change may edit (CLAUDE.md): what it pins is its owner's to change. */
const NEVER_EDITED = 'malware-scan.yml';
/** The job names branch protection requires (CLAUDE.md): renaming one unhooks the check. */
const CI_JOB_NAMES = ['typecheck · lint · test', 'expo-doctor · iOS bundle'];

/** owner/repo (and a path inside it) at a full commit sha, lower-case hex as GitHub writes it. */
const AT_A_COMMIT = /^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40}$/;
/** The release that commit is, as a comment after it: ` # v4.4.0`. */
const RELEASE_COMMENT = /^\s+#\s+v\d+\.\d+\.\d+\s*$/;
const USES_LINE = /^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/;

type Step = { uses?: unknown };
type Workflow = { jobs?: Record<string, { name?: unknown; uses?: unknown; steps?: Step[] }> };

/** What is wrong with each `uses:` line: not at a commit, or with no release beside it. */
function unpinnedLines(text: string): readonly string[] {
  return text.split('\n').flatMap((line) => {
    const match = USES_LINE.exec(line);
    if (match === null) return [];
    const [, action, rest] = match;
    if (!AT_A_COMMIT.test(action)) return [`${action}: not at a 40-character commit sha`];
    return RELEASE_COMMENT.test(rest) ? [] : [`${action}: no '# vX.Y.Z' release beside it`];
  });
}

/** Every `uses` the YAML holds, in steps and on jobs (a reusable workflow). */
function usesOf(workflow: Workflow): readonly unknown[] {
  return Object.values(workflow.jobs ?? {}).flatMap((job) => [
    ...(job.uses === undefined ? [] : [job.uses]),
    ...(job.steps ?? []).flatMap((step) => (step.uses === undefined ? [] : [step.uses])),
  ]);
}

function read(file: string): string {
  return readFileSync(path.join(PROJECT_ROOT, WORKFLOWS_DIR, file), 'utf8');
}

const held = readdirSync(path.join(PROJECT_ROOT, WORKFLOWS_DIR))
  .filter((file) => /\.ya?ml$/.test(file) && file !== NEVER_EDITED)
  .sort();

describe('the workflows run their actions at a commit, never at a tag (rule 14.1)', () => {
  it('holds every workflow but the one no change edits', () => {
    expect(held).toEqual(['ci.yml', 'push-security.yml']);
  });

  it.each(held)('%s: every uses line names a commit, with its release beside it', (file) => {
    const text = read(file);
    expect(text).toMatch(/uses:/);
    expect(unpinnedLines(text)).toEqual([]);
  });

  it.each(held)('%s: the YAML holds no uses the lines did not, and each is at a commit', (file) => {
    const text = read(file);
    const lines = text.split('\n').flatMap((line) => USES_LINE.exec(line)?.[1] ?? []);
    const uses = usesOf(parse(text) as Workflow);
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.every((action) => typeof action === 'string' && AT_A_COMMIT.test(action))).toBe(
      true,
    );
    expect([...uses].sort()).toEqual([...lines].sort());
  });

  it('refuses a tag, a branch, a short or upper-case sha, and a commit with no release beside it', () => {
    const sha = '11d5960a326750d5838078e36cf38b85af677262';
    expect(unpinnedLines(`      - uses: actions/checkout@${sha} # v4.4.0`)).toEqual([]);
    expect(unpinnedLines(`    uses: org/repo/.github/workflows/x.yml@${sha} # v1.0.0`)).toEqual([]);
    for (const line of [
      '      - uses: actions/checkout@v4',
      '      - uses: actions/checkout@main',
      `      - uses: actions/checkout@${sha.slice(0, 7)} # v4.4.0`,
      `      - uses: actions/checkout@${sha.toUpperCase()} # v4.4.0`,
      `      - uses: actions/checkout@${sha}`,
      `      - uses: actions/checkout@${sha} # latest`,
      '      - uses: docker://alpine:3',
      '      - uses: ./local-action',
    ]) {
      expect(unpinnedLines(line)).toHaveLength(1);
    }
  });
});

describe('ci.yml keeps the job names branch protection reads', () => {
  it('names its jobs exactly as the required checks', () => {
    const workflow = parse(read('ci.yml')) as Workflow;
    const names = Object.values(workflow.jobs ?? {}).map((job) => job.name);
    expect(names).toEqual(CI_JOB_NAMES);
  });
});
