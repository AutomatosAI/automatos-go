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

const WORKFLOWS_DIR = '.eas/workflows';
// EAS rejects a workflow file over 16 KiB (docs.expo.dev/eas/workflows/syntax, 'Workflow files').
const MAX_WORKFLOW_BYTES = 16 * 1024;
const FINGERPRINT_HASH = '${{ needs.fingerprint.outputs.ios_fingerprint_hash }}';
const FOUND = '${{ needs.get_ios_build.outputs.build_id }}';
const NOT_FOUND = '${{ !needs.get_ios_build.outputs.build_id }}';

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
    expect(readdirSync(path.join(PROJECT_ROOT, '.github/workflows')).sort()).toEqual([
      'ci.yml',
      'malware-scan.yml',
    ]);
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
  it("found: only main's head publishes (an older run stops before publishing)", () => {
    const hook = z
      .object({ before_update: z.array(z.object({ name: z.string(), run: z.string() })).length(1) })
      .parse(jobs.publish_update.hooks);
    const { run } = hook.before_update[0];
    expect(run).toContain('${{ github.sha }}');
    expect(run).toContain(
      'git ls-remote https://github.com/AutomatosAI/automatos-go.git refs/heads/main',
    );
    expect(run).toMatch(/\[ "\$head" = "\$sha" \] \|\| \{[^}]*exit 1; \}/);
    // eas workflow:run has an empty github context: no sha to compare, the update goes out
    expect(run).toContain('[ -n "$sha" ] || exit 0');
  });

  it('not found: builds iOS with the testflight profile', () => {
    expect(jobs.build_ios).toMatchObject({
      type: 'build',
      needs: ['get_ios_build'],
      if: NOT_FOUND,
      params: { platform: 'ios', profile: 'testflight' },
    });
  });

  it('sends that build to TestFlight with the testflight submit profile and a changelog', () => {
    expect(jobs.submit_testflight).toMatchObject({
      type: 'testflight',
      needs: ['build_ios'],
      params: {
        build_id: '${{ needs.build_ios.outputs.build_id }}',
        profile: 'testflight',
        // a changelog makes the job wait for Apple's processing; the limit is chosen, not default
        wait_processing_timeout_seconds: 1800,
      },
    });
    expect(String(jobs.submit_testflight.params?.changelog)).toContain('github.commit_message');
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
