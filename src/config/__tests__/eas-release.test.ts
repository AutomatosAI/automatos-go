// Release plumbing (Gerard, 24 Oct): the committed EAS project link, the eas.json profiles the
// workflows name, and delivery on EAS Workflows (.eas/workflows) instead of GitHub Actions. A
// wrong link, trigger, profile, channel or environment ships to the wrong builds or spends an
// iOS build for nothing, so each is pinned. What the link resolves to after every config plugin
// (Expo.plist's EXUpdatesURL) is checked in app-config.test.ts with the introspected config.
// `yaml` is metro-config's YAML parser (Expo's bundler), already installed: no new dependency.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';

import easJson from '../../../eas.json';
import { EAS_OWNER, EAS_PROJECT_ID, EAS_UPDATES_URL, expo, PROJECT_ROOT } from './app-json';
import {
  beforeUpdateSteps,
  EXACT_MAIN,
  ORIGIN,
  OWN_MAIN,
  PUBLIC_ADDRESS,
  PUBLIC_MAIN,
  runHeadCheck,
  type HookStep,
} from './hook-shell';

const WORKFLOWS_DIR = '.eas/workflows';
// EAS rejects a workflow file over 16 KiB (docs.expo.dev/eas/workflows/syntax, 'Workflow files').
const MAX_WORKFLOW_BYTES = 16 * 1024;
const FINGERPRINT_HASH = '${{ needs.fingerprint.outputs.ios_fingerprint_hash }}';
const FOUND = '${{ needs.get_ios_build.outputs.build_id }}';
const NOT_FOUND = '${{ !needs.get_ios_build.outputs.build_id }}';
const RELEASE_CHECK = 'Check the release environment (no secret in an EXPO_PUBLIC_ value)';
const HEAD_CHECK = 'Stop if main has moved on (its own run ships this change too)';
// commit shas for the head check: this run's, an older one and a newer one
const SHA = 'a'.repeat(40);
const OLDER = 'b'.repeat(40);
const NEWER = 'c'.repeat(40);

const jobSchema = z
  .object({
    type: z.string(),
    needs: z.array(z.string()).optional(),
    if: z.string().optional(),
    environment: z.string().optional(),
    params: z.record(z.unknown()).optional(),
  })
  .passthrough();

const workflowSchema = z.object({
  name: z.string().min(1),
  on: z.record(z.unknown()),
  concurrency: z.object({ cancel_in_progress: z.boolean(), group: z.string() }),
  jobs: z.record(jobSchema),
});

type Workflow = z.infer<typeof workflowSchema>;

function workflowPath(file: string): string {
  return path.join(PROJECT_ROOT, WORKFLOWS_DIR, file);
}

function readWorkflow(file: string): Workflow {
  return workflowSchema.parse(parse(readFileSync(workflowPath(file), 'utf8')));
}

function stepNamed(steps: readonly HookStep[], name: string): HookStep {
  const step = steps.find((candidate) => candidate.name === name);
  if (!step) throw new Error(`publish_update has no "${name}" step`);
  return step;
}

const testflightProfile = easJson.build.testflight;

// The link is public (the project id ships inside every binary), so it is committed. Another
// owner, project id or update URL is another EAS project: it would never see this project's
// TestFlight builds or updates.
describe('app.json carries the EAS project link', () => {
  it('is owned by the gerard161 Expo account', () => {
    expect(expo.owner).toBe(EAS_OWNER);
  });

  it('names the Automatos Go EAS project', () => {
    expect(expo.extra.eas).toEqual({ projectId: EAS_PROJECT_ID });
  });

  it("points expo-updates at that project's update URL and nothing else", () => {
    expect(expo.updates).toEqual({ url: EAS_UPDATES_URL });
  });

  it('keeps the fingerprint runtime policy, so an update reaches only builds it runs on', () => {
    expect(expo.runtimeVersion).toEqual({ policy: 'fingerprint' });
  });
});

describe('.eas/workflows', () => {
  it('holds exactly the TestFlight delivery and the pull request check', () => {
    expect(readdirSync(path.join(PROJECT_ROOT, WORKFLOWS_DIR)).sort()).toEqual([
      'pr-check.yml',
      'testflight.yml',
    ]);
  });

  it.each(['pr-check.yml', 'testflight.yml'])('%s fits the 16 KiB workflow limit', (file) => {
    expect(statSync(workflowPath(file)).size).toBeLessThanOrEqual(MAX_WORKFLOW_BYTES);
  });

  it('GitHub Actions only checks: no second delivery path (testflight.yml is gone)', () => {
    // push-security.yml (A7 US-021n) reads one Expo setting; release-push-security.test.ts pins it
    const dir = path.join(PROJECT_ROOT, '.github/workflows');
    expect(readdirSync(dir).sort()).toEqual(['ci.yml', 'malware-scan.yml', 'push-security.yml']);
    // no GitHub workflow builds, updates or submits: no eas-cli, no Expo action
    const delivery = /expo\/expo-github-action|eas-cli|\beas\s+(build|update|submit|workflow)/i;
    readdirSync(dir).forEach((file) => {
      expect(readFileSync(path.join(dir, file), 'utf8'), file).not.toMatch(delivery);
    });
  });
});

describe('eas.json: the profiles the workflows name', () => {
  it('the testflight build profile is a store build on channel testflight, env preview', () => {
    expect(testflightProfile).toMatchObject({
      extends: 'production',
      channel: 'testflight',
      environment: 'preview',
    });
    // the testflight job takes store builds only: neither profile sets an internal distribution
    expect(testflightProfile).not.toHaveProperty('distribution');
    expect(easJson.build.production).not.toHaveProperty('distribution');
  });

  it('the testflight submit profile names the team and the App Store Connect app', () => {
    expect(easJson.submit.testflight.ios).toEqual({
      appleTeamId: 'KGVA9933BG',
      ascAppId: '6825362378',
    });
  });
});

describe('.eas/workflows/testflight.yml (every push to main)', () => {
  const workflow = readWorkflow('testflight.yml');
  const { jobs } = workflow;

  it('runs on pushes to main only and never cancels a running delivery', () => {
    expect(workflow.on).toEqual({ push: { branches: ['main'] } });
    expect(workflow.concurrency.cancel_in_progress).toBe(false);
  });

  it('fingerprints in the testflight profile environment, so the hash matches the build', () => {
    expect(jobs.fingerprint).toMatchObject({
      type: 'fingerprint',
      environment: testflightProfile.environment,
    });
  });

  it('looks up a testflight iOS build with that fingerprint, waiting for one in progress', () => {
    expect(jobs.get_ios_build).toMatchObject({
      type: 'get-build',
      needs: ['fingerprint'],
      params: {
        platform: 'ios',
        profile: 'testflight',
        fingerprint_hash: FINGERPRINT_HASH,
        wait_for_in_progress: true,
      },
    });
  });

  it('found: publishes an iOS update on the testflight channel in the same environment', () => {
    expect(jobs.publish_update).toMatchObject({
      type: 'update',
      needs: ['get_ios_build'],
      if: FOUND,
      environment: testflightProfile.environment,
      params: {
        channel: testflightProfile.channel,
        platform: 'ios',
        // no Sentry token in the repo or on EAS yet: no failing upload in every update log
        upload_sentry_sourcemaps: false,
      },
    });
  });

  // EAS concurrency cancels but never queues, so two pushes run side by side: without this an
  // older run that publishes last becomes the active update and phones run its older bundle.
  // main's head is read through the job's own checkout first, so a private copy of this
  // repository can read itself; the public address is the fallback. Before 15 Nov a head that
  // could not be read stopped the update, which in a private copy stopped every update: now it
  // publishes with a warning. A head that was read and has moved on still stops the run.
  describe("found: only main's head publishes (an older run stops before publishing)", () => {
    const steps = beforeUpdateSteps(jobs.publish_update.hooks);
    const { run } = stepNamed(steps, HEAD_CHECK);

    // Since 15 Nov the release check runs first: an update exports EXPO_PUBLIC_* values into the
    // bundle with no build, so no build hook ever checked them, and a secret in one shipped.
    it('runs after the release check, the last step before the update', () => {
      expect(steps.map((step) => step.name)).toEqual([RELEASE_CHECK, HEAD_CHECK]);
    });

    it('checks the testflight profile, whose environment is the one this job exports with', () => {
      const check = /^node scripts\/check-release-env\.js (\w+)$/.exec(
        stepNamed(steps, RELEASE_CHECK).run.trim(),
      );
      expect(check?.[1]).toBe('testflight');
      expect(easJson.build.testflight.environment).toBe(jobs.publish_update.environment);
    });

    it('reads the checkout first, then the public address, never waiting on a password prompt', () => {
      expect(run).toContain('${{ github.sha }}');
      expect(run).toContain('export GIT_TERMINAL_PROMPT=0');
      expect(run.indexOf(OWN_MAIN)).toBeGreaterThan(-1);
      expect(run.indexOf(PUBLIC_MAIN)).toBeGreaterThan(run.indexOf(OWN_MAIN));
      // git's own error lines can show a remote's address: neither read prints them
      expect(run.split(`${OWN_MAIN} 2>/dev/null`)).toHaveLength(2);
      expect(run.split(`${PUBLIC_MAIN} 2>/dev/null`)).toHaveLength(2);
      // each keeps only the line for exactly refs/heads/main (since 16 Nov)
      expect(run.split(`${OWN_MAIN} 2>/dev/null ${EXACT_MAIN}`)).toHaveLength(2);
      expect(run.split(`${PUBLIC_MAIN} 2>/dev/null ${EXACT_MAIN}`)).toHaveLength(2);
      expect(run).not.toContain('cut -f1');
      // the one stop is main having moved on
      expect(run.match(/exit 1/g)).toHaveLength(1);
      expect(run).toMatch(/\[ "\$head" = "\$sha" \] \|\| \{[^}]*exit 1; \}/);
    });

    // eas workflow:run has an empty github context: no sha to compare, the update goes out
    it('publishes a run started by hand (no sha) without asking git', () => {
      expect(runHeadCheck(run, '', { origin: SHA })).toEqual({ status: 0, asked: [], out: '' });
    });

    it.each([
      ['the checkout', { origin: SHA, public: OLDER }, [ORIGIN]],
      ['the public address', { public: SHA }, [ORIGIN, PUBLIC_ADDRESS]],
    ])('publishes when %s says this is main', (_, remotes, asked) => {
      expect(runHeadCheck(run, SHA, remotes)).toMatchObject({ status: 0, asked });
    });

    it.each([
      ['the checkout', { origin: NEWER, public: SHA }],
      ['the public address', { public: NEWER }],
    ])('stops when %s says main has moved on', (_, remotes) => {
      const result = runHeadCheck(run, OLDER, remotes);
      expect(result.status).toBe(1);
      expect(result.out).toContain(`main is at ${NEWER}, past ${OLDER}`);
    });

    // ls-remote's pattern also matches refs that only end in refs/heads/main, which anyone who
    // can push may create: before 16 Nov their lines joined main's and no head ever matched
    it.each([
      ['publishes', 'the checkout', SHA, { origin: SHA, lookAlike: NEWER }],
      ['publishes', 'the public address', SHA, { public: SHA, lookAlike: NEWER }],
      ['stops', 'the checkout', OLDER, { origin: NEWER, lookAlike: OLDER }],
    ])("%s by main's own line when %s also lists a look-alike ref", (verdict, _, sha, remotes) => {
      const result = runHeadCheck(run, sha, remotes);
      expect(result.status).toBe(verdict === 'publishes' ? 0 : 1);
      // one head, on one line: the look-alike's sha is in neither verdict
      const stop = `main is at ${NEWER}, past ${OLDER}: that run publishes both.\n`;
      expect(result.out).toBe(verdict === 'stops' ? stop : '');
    });

    it("publishes with a loud warning when main's head cannot be read at all", () => {
      const result = runHeadCheck(run, SHA, {});
      expect(result).toMatchObject({ status: 0, asked: [ORIGIN, PUBLIC_ADDRESS] });
      expect(result.out).toContain("WARNING: could not read main's head");
      expect(result.out).toContain(`publishing ${SHA} without knowing it is main's head`);
      expect(result.out).toContain('older update can land after the newer run');
      expect(result.out).not.toContain('fatal');
    });
  });

  it('not found: builds iOS with the testflight profile', () => {
    expect(jobs.build_ios).toMatchObject({
      type: 'build',
      needs: ['get_ios_build'],
      if: NOT_FOUND,
      params: { platform: 'ios', profile: 'testflight' },
    });
  });

  // EAS refuses the testflight job with an EAS build_id on the free plan (run 01a16b62, 24 Oct):
  // the submit job is the same upload as eas submit and runs on every plan.
  it('sends that build to TestFlight with the submit job and the testflight submit profile', () => {
    expect(jobs.submit_testflight).toEqual({
      name: 'Send the build to TestFlight',
      needs: ['build_ios'],
      type: 'submit',
      params: {
        build_id: '${{ needs.build_ios.outputs.build_id }}',
        profile: 'testflight',
      },
    });
  });

  it('has no other jobs', () => {
    expect(Object.keys(jobs).sort()).toEqual([
      'build_ios',
      'fingerprint',
      'get_ios_build',
      'publish_update',
      'submit_testflight',
    ]);
  });
});

describe('.eas/workflows/pr-check.yml (pull requests to main)', () => {
  const workflow = readWorkflow('pr-check.yml');
  const { jobs } = workflow;
  const types = Object.values(jobs).map((job) => job.type);

  it('runs on pull requests to main', () => {
    expect(workflow.on).toEqual({ pull_request: { branches: ['main'] } });
  });

  it('is cheap: a fingerprint, a lookup and comments, never a build, update or submit', () => {
    expect([...types].sort()).toEqual([
      'fingerprint',
      'get-build',
      'github-comment',
      'github-comment',
    ]);
  });

  it('makes the same lookup as the delivery, without waiting', () => {
    expect(jobs.fingerprint.environment).toBe(testflightProfile.environment);
    expect(jobs.get_ios_build.params).toEqual({
      platform: 'ios',
      profile: 'testflight',
      fingerprint_hash: FINGERPRINT_HASH,
    });
  });

  it('comments exactly one verdict: over the air when found, a native build when not', () => {
    expect(jobs.comment_ota).toMatchObject({ if: FOUND, needs: ['fingerprint', 'get_ios_build'] });
    expect(jobs.comment_native).toMatchObject({
      if: NOT_FOUND,
      needs: ['fingerprint', 'get_ios_build'],
    });
    expect(String(jobs.comment_ota.params?.payload)).toContain('over-the-air update');
    expect(String(jobs.comment_native.params?.payload)).toContain('native iOS build');
  });
});
