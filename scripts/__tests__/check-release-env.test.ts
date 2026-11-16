import { describe, expect, it } from 'vitest';

import { isServerAddress as appIsServerAddress } from '../../src/lib/env';
import { isEuDsn as appIsEuDsn } from '../../src/observability/options';
import { checkReleaseEnv, isEuDsn, isServerAddress } from '../check-release-env';

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

  // a secret in an EXPO_PUBLIC_ value fails these too: check-release-env-secrets.test.ts
  it('skips development and local builds, but for a secret', () => {
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

/** Addresses the build hook and the app must judge alike (src/lib/env.ts isServerAddress). */
const ADDRESS_CASES = [
  'https://api.automatos.app',
  'https://api.automatos.app/',
  'https://api.automatos.app:8443',
  'HTTPS://API.AUTOMATOS.APP',
  'https:api.automatos.app',
  'https://api.auto\tmatos.app',
  'https://%61pi.automatos.app',
  'https://api.automatos.app:443',
  'https://api.automatos.app/.',
  'http://api.automatos.app',
  'http://192.168.1.20:8000',
  'https://user:secret@api.automatos.app',
  'https://user@api.automatos.app',
  'https://api.automatos.app/api',
  'https://api.automatos.app/?next=x',
  'https://api.automatos.app/#x',
  'https://api.automatos.app\\@elsewhere.test',
  'javascript:alert(1)',
  'https://',
  'not a url',
  'https://b\u00fccher.example',
  'https://\uff11\uff12\uff17.\uff10.\uff10.\uff11',
  'https://0x7f.0.0.1',
  'https://2130706433',
  'https://[::1]:8443',
  'https://api.automatos.app.',
];

describe('a hosted address the app would refuse at launch', () => {
  const RELEASE = false;
  const BAD = 'https://alice:secret@api.automatos.app/api';

  it.each(ADDRESS_CASES)('the build hook and the app judge %s alike', (value) => {
    expect(isServerAddress(value)).toBe(appIsServerAddress(value, RELEASE));
  });

  it('accepts the bare https address and refuses the rest of the cases', () => {
    const accepted = ADDRESS_CASES.filter((value) => isServerAddress(value));
    expect(accepted).toEqual([
      'https://api.automatos.app',
      'https://api.automatos.app/',
      'https://api.automatos.app:8443',
      'https://[::1]:8443',
    ]);
  });

  it.each(['production', 'preview', 'testflight'])(
    'fails a %s build, naming the variable and never the value',
    (profile) => {
      const { errors } = checkReleaseEnv({ ...COMPLETE, EXPO_PUBLIC_API_URL: BAD }, profile);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('EXPO_PUBLIC_API_URL');
      expect(errors[0]).not.toContain('secret');
      expect(errors[0]).not.toContain('alice');
      expect(errors[0]).not.toContain('automatos.app');
    },
  );

  it('checks both addresses, and plain http is refused in a release build', () => {
    const env = {
      ...COMPLETE,
      EXPO_PUBLIC_API_URL: 'http://api.automatos.app',
      EXPO_PUBLIC_WEB_URL: 'https://studio.automatos.app/app',
    };
    const { errors } = checkReleaseEnv(env, 'testflight');
    expect(errors.map((message) => message.split(' ')[0])).toEqual([
      'EXPO_PUBLIC_API_URL',
      'EXPO_PUBLIC_WEB_URL',
    ]);
  });

  it('says nothing for a good address, an unset one, or a profile it does not check', () => {
    expect(checkReleaseEnv(COMPLETE, 'testflight').errors).toEqual([]);
    expect(checkReleaseEnv({ ...COMPLETE, EXPO_PUBLIC_WEB_URL: '' }, 'preview').errors).toEqual([]);
    expect(checkReleaseEnv({ ...COMPLETE, EXPO_PUBLIC_API_URL: BAD }, 'development')).toEqual({
      errors: [],
      warnings: [],
    });
  });
});
