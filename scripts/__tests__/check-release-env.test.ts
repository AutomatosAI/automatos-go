import { describe, expect, it } from 'vitest';

import { isEuDsn as appIsEuDsn } from '../../src/observability/options';
import { checkReleaseEnv, isEuDsn } from '../check-release-env';

const US_DSN = 'https://key@o0.ingest.us.sentry.io/0';
/** DSNs the build hook and the app must judge alike (src/observability/options.ts isEuDsn). */
const DSN_CASES = [
  'https://key@o0.ingest.de.sentry.io/0',
  'https://key@O12.INGEST.DE.SENTRY.IO/34',
  'https://key:secret@o5.ingest.de.sentry.io:443/6',
  'http://key@o0.ingest.de.sentry.io/0',
  US_DSN,
  'https://key@o0.ingest.sentry.io/0',
  'https://key@sentry.io/0',
  'https://key@ingest.de.sentry.io/0',
  'https://key@o0.ingest.de.sentry.io.evil.test/0',
  'https://o0.ingest.de.sentry.io/0',
  'not a dsn',
];

const COMPLETE = {
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_abc',
  EXPO_PUBLIC_API_URL: 'https://api.automatos.app',
  EXPO_PUBLIC_WEB_URL: 'https://ui.automatos.app',
  EXPO_PUBLIC_SENTRY_DSN: 'https://key@o0.ingest.de.sentry.io/0',
};

describe('checkReleaseEnv', () => {
  it('passes a complete production env with no warnings', () => {
    expect(checkReleaseEnv(COMPLETE, 'production')).toEqual({ errors: [], warnings: [] });
  });

  it('fails production when a must-have is missing or blank', () => {
    const { errors } = checkReleaseEnv(
      { ...COMPLETE, EXPO_PUBLIC_API_URL: undefined, EXPO_PUBLIC_WEB_URL: '  ' },
      'production',
    );
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('EXPO_PUBLIC_API_URL');
    expect(errors[1]).toContain('EXPO_PUBLIC_WEB_URL');
  });

  it('fails production when the Clerk key is missing', () => {
    const { errors } = checkReleaseEnv(
      { ...COMPLETE, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: '' },
      'production',
    );
    expect(errors).toEqual([expect.stringContaining('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY')]);
  });

  it('fails production on a Clerk test key', () => {
    const { errors } = checkReleaseEnv(
      { ...COMPLETE, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_abc' },
      'production',
    );
    expect(errors).toEqual([expect.stringContaining('pk_live_')]);
  });

  it('only warns for preview, and accepts a test key there', () => {
    const result = checkReleaseEnv({ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_abc' }, 'preview');
    expect(result.errors).toEqual([]);
    expect(result.warnings.join('\n')).toContain('EXPO_PUBLIC_API_URL');
    expect(result.warnings.join('\n')).toContain('EXPO_PUBLIC_WEB_URL');
    expect(result.warnings.join('\n')).not.toContain('pk_live_');
  });

  it('only warns for testflight, even with nothing set', () => {
    const result = checkReleaseEnv({}, 'testflight');
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(4);
  });

  it('warns, never fails, on a missing Sentry DSN', () => {
    const { errors, warnings } = checkReleaseEnv(
      { ...COMPLETE, EXPO_PUBLIC_SENTRY_DSN: '' },
      'production',
    );
    expect(errors).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining('EXPO_PUBLIC_SENTRY_DSN')]);
  });

  it('skips development and local builds entirely', () => {
    expect(checkReleaseEnv({}, 'development')).toEqual({ errors: [], warnings: [] });
    expect(checkReleaseEnv({}, '')).toEqual({ errors: [], warnings: [] });
  });

  it("fails production on a DSN outside Sentry's EU region (D44)", () => {
    const { errors, warnings } = checkReleaseEnv(
      { ...COMPLETE, EXPO_PUBLIC_SENTRY_DSN: US_DSN },
      'production',
    );
    expect(errors).toEqual([expect.stringContaining('EXPO_PUBLIC_SENTRY_DSN')]);
    expect(errors[0]).toContain('.ingest.de.sentry.io');
    expect(errors[0]).not.toContain(US_DSN);
    expect(warnings).toEqual([]);
  });

  it('only warns for preview and testflight on a DSN outside the EU region', () => {
    for (const profile of ['preview', 'testflight']) {
      const { errors, warnings } = checkReleaseEnv(
        { ...COMPLETE, EXPO_PUBLIC_SENTRY_DSN: US_DSN },
        profile,
      );
      expect(errors).toEqual([]);
      expect(warnings).toEqual([expect.stringContaining('not a Sentry EU DSN')]);
    }
  });

  it('accepts an EU DSN in every profile, surrounding spaces included', () => {
    for (const profile of ['production', 'preview', 'testflight']) {
      const env = { ...COMPLETE, EXPO_PUBLIC_SENTRY_DSN: ' https://key@o9.ingest.de.sentry.io/1 ' };
      expect(checkReleaseEnv(env, profile)).toEqual({ errors: [], warnings: [] });
    }
  });

  it('never judges the DSN for development and local builds', () => {
    const env = { ...COMPLETE, EXPO_PUBLIC_SENTRY_DSN: US_DSN };
    expect(checkReleaseEnv(env, 'development')).toEqual({ errors: [], warnings: [] });
  });

  it('judges a DSN exactly as the app does', () => {
    for (const dsn of DSN_CASES) {
      expect({ dsn, eu: isEuDsn(dsn) }).toEqual({ dsn, eu: appIsEuDsn(dsn) });
    }
    expect(DSN_CASES.filter(isEuDsn)).toHaveLength(3);
  });

  it('keeps the D64 wording: Studio is linked into, never a place to create an account', () => {
    const { warnings } = checkReleaseEnv({}, 'preview');
    const webUrl = warnings.find((message) => message.includes('EXPO_PUBLIC_WEB_URL'));
    expect(webUrl).toContain('links into hosted Studio');
    expect(warnings.join('\n')).not.toMatch(/create an account|sign up/i);
  });
});
