import { describe, expect, it } from 'vitest';

import { checkReleaseEnv } from '../check-release-env';

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
});
