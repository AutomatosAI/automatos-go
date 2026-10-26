// R20 as a test that keeps running in CI (US-021o): the build the team installs at WebSummit and
// every over-the-air update it receives read ONE EAS environment, so an update never swaps the
// EXPO_PUBLIC_* values (the Clerk key, the API, Studio, Sentry) under the build it lands on [D46];
// the production profile is the store's; the release constants App Store Connect reads are
// pinned; the build hook still refuses a Clerk test key in a store build. Delivery is EAS
// Workflows since 24 Oct: the kit's `eas update --environment` line in
// .github/workflows/testflight.yml no longer exists, so the update job's `environment` is read.
// A mismatch is an OWNER item in docs/release/testflight.md, never 'fixed' in eas.json or a
// workflow (not this kit's files, KR1). src/config/__tests__/eas-release.test.ts pins the
// workflows' shape; this file pins the facts testflight.md states.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';

import easJson from '../../../eas.json';
import { checkReleaseEnv } from '../../../scripts/check-release-env';
import { expo } from '../../config/__tests__/app-json';
import { ENV_NAMES } from '../../lib/env';
import { tableWithColumns } from './support/markdown';
import { readRepoFile, repoRoot } from './support/tree';

const TESTFLIGHT_DOC = 'docs/release/testflight.md';
const EAS_WORKFLOWS = '.eas/workflows';
const GITHUB_WORKFLOWS = '.github/workflows';
const BUNDLE_ID = 'com.automatos.app';
const ENV_TABLE = ['Name', 'preview', 'production'] as const;

const COMPLETE_ENV = {
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_abc',
  EXPO_PUBLIC_API_URL: 'https://api.example.test',
  EXPO_PUBLIC_WEB_URL: 'https://studio.example.test',
  EXPO_PUBLIC_SENTRY_DSN: 'https://key@o0.ingest.de.sentry.io/0',
};
const TEST_KEY_ENV = { ...COMPLETE_ENV, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_abc' };

const jobSchema = z
  .object({
    type: z.string(),
    environment: z.string().optional(),
    params: z.record(z.unknown()).optional(),
  })
  .passthrough();
const workflowSchema = z.object({ jobs: z.record(jobSchema) }).passthrough();
type Job = z.infer<typeof jobSchema>;

function easWorkflowJobs(file: string): Job[] {
  const text = readRepoFile(path.posix.join(EAS_WORKFLOWS, file));
  return Object.values(workflowSchema.parse(parse(text)).jobs);
}

function easWorkflowFiles(): string[] {
  return readdirSync(path.join(repoRoot(), EAS_WORKFLOWS)).filter((file) => file.endsWith('.yml'));
}

const jobsOfType = (jobs: readonly Job[], type: string) => jobs.filter((job) => job.type === type);
const unquote = (cell: string) => cell.replace(/`/g, '').trim();

const testflightProfile = easJson.build.testflight;
const productionProfile = easJson.build.production;
const deliveryJobs = easWorkflowJobs('testflight.yml');

describe('one EAS environment per TestFlight build and its updates (R20, D46)', () => {
  it('the delivery publishes exactly one update, on the testflight channel, in its environment', () => {
    const updates = jobsOfType(deliveryJobs, 'update');
    expect(updates).toHaveLength(1);
    const [update] = updates;
    expect(update.environment).toBe(testflightProfile.environment);
    expect(update.params?.channel).toBe(testflightProfile.channel);
  });

  it('every fingerprint the lookups compare is taken in that environment too', () => {
    const fingerprints = easWorkflowFiles().flatMap((file) =>
      jobsOfType(easWorkflowJobs(file), 'fingerprint').map((job) => ({ file, job })),
    );
    expect(fingerprints.length).toBeGreaterThanOrEqual(2);
    for (const { file, job } of fingerprints) {
      expect(job.environment, file).toBe(testflightProfile.environment);
    }
  });

  it('no other workflow publishes an update (no second environment on the channel)', () => {
    const others = easWorkflowFiles().filter((file) => file !== 'testflight.yml');
    for (const file of others) {
      expect(jobsOfType(easWorkflowJobs(file), 'update'), file).toEqual([]);
    }
    const github = readdirSync(path.join(repoRoot(), GITHUB_WORKFLOWS));
    expect(github).not.toContain('testflight.yml');
    for (const file of github) {
      const text = readRepoFile(path.posix.join(GITHUB_WORKFLOWS, file));
      expect(text, file).not.toMatch(/\beas\s+update\b|--environment\b/);
    }
  });
});

describe('eas.json: the store profile and the TestFlight profile', () => {
  it('production is channel production, environment production', () => {
    expect(productionProfile).toMatchObject({ channel: 'production', environment: 'production' });
  });

  it('testflight is the production build on its own channel and environment', () => {
    const { extends: base, channel, environment, ...rest } = testflightProfile;
    expect(base).toBe('production');
    expect(channel).toBe('testflight');
    expect(environment).toEqual(expect.any(String));
    // anything else it sets, it sets as production does: the build App Review gets is the same
    expect(productionProfile).toMatchObject(rest);
  });

  it('build numbers come from EAS (cli.appVersionSource remote)', () => {
    expect(easJson.cli.appVersionSource).toBe('remote');
  });
});

describe('app.json: what App Store Connect and Play read', () => {
  it('runtimeVersion policy fingerprint, so an update reaches only builds it runs on (D46)', () => {
    expect(expo.runtimeVersion).toEqual({ policy: 'fingerprint' });
  });

  it('declares no non-exempt encryption, so no build waits on the compliance question', () => {
    expect(expo.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
  });

  it('is an iPhone app (supportsTablet false)', () => {
    expect(expo.ios.supportsTablet).toBe(false);
  });

  it(`is ${BUNDLE_ID} on both platforms`, () => {
    expect(expo.ios.bundleIdentifier).toBe(BUNDLE_ID);
    expect(expo.android.package).toBe(BUNDLE_ID);
  });
});

describe('scripts/check-release-env.js: the Clerk key in a store build (PRD §8)', () => {
  it('fails a production build on a Clerk test key and passes it on pk_live_', () => {
    expect(checkReleaseEnv(TEST_KEY_ENV, 'production').errors).toEqual([
      expect.stringContaining('pk_live_'),
    ]);
    expect(checkReleaseEnv(COMPLETE_ENV, 'production')).toEqual({ errors: [], warnings: [] });
  });

  // testflight.md: the prefix is checked for production only, so a WebSummit build on the
  // development instance's key passes without a word (OT-R11 decides the key)
  it.each(['testflight', 'preview'])('says nothing about a test key for %s', (profile) => {
    expect(checkReleaseEnv(TEST_KEY_ENV, profile)).toEqual({ errors: [], warnings: [] });
  });

  it('checks every EXPO_PUBLIC_* value the app reads (src/lib/env.ts)', () => {
    const { errors, warnings } = checkReleaseEnv({}, 'production');
    const messages = [...errors, ...warnings].join('\n');
    for (const name of Object.values(ENV_NAMES)) expect(messages).toContain(name);
  });
});

describe(`${TESTFLIGHT_DOC} (OT-R11)`, () => {
  const doc = readFileSync(path.join(repoRoot(), TESTFLIGHT_DOC), 'utf8');
  // prose wraps at any space: compare sentences on one line
  const prose = doc.replace(/\s+/g, ' ');

  it("lists exactly the app's EXPO_PUBLIC_* names, with a value for preview and production", () => {
    const { rows } = tableWithColumns(doc, ENV_TABLE);
    expect(rows.map((row) => unquote(row.Name)).sort()).toEqual(Object.values(ENV_NAMES).sort());
    for (const row of rows) {
      expect(row.preview, row.Name).not.toBe('');
      expect(row.production, row.Name).not.toBe('');
    }
  });

  it('says which environment the WebSummit build and its updates read', () => {
    expect(prose).toContain(`builds with the \`${testflightProfile.environment}\` environment`);
    expect(prose).toContain(`updates are published with \`${testflightProfile.environment}\``);
  });

  it('puts both Clerk-key options and the owner step to Gerard', () => {
    expect(doc).toMatch(/### Option A: the `preview` environment carries the `pk_live_` key/);
    expect(doc).toMatch(/### Option B: the `testflight` profile and its updates move to/);
    expect(doc).toContain('## Owner steps (OT-R11)');
  });
});
