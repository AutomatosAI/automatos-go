import { describe, expect, it } from 'vitest';

import { ENV_NAMES, env, parseEnv } from '../env';

describe('parseEnv', () => {
  it('turns missing values into empty strings', () => {
    expect(parseEnv({})).toEqual({
      clerkPublishableKey: '',
      apiUrl: '',
      webUrl: '',
      sentryDsn: '',
    });
  });

  it('accepts empty values', () => {
    expect(
      parseEnv({ apiUrl: '', webUrl: '', sentryDsn: '', clerkPublishableKey: '' }).apiUrl,
    ).toBe('');
  });

  it('keeps well-formed values, trimmed', () => {
    const parsed = parseEnv({
      clerkPublishableKey: ' pk_test_abc ',
      apiUrl: 'https://api.automatos.app',
      webUrl: 'https://ui.automatos.app ',
      sentryDsn: 'https://key@o0.ingest.de.sentry.io/0',
    });
    expect(parsed).toEqual({
      clerkPublishableKey: 'pk_test_abc',
      apiUrl: 'https://api.automatos.app',
      webUrl: 'https://ui.automatos.app',
      sentryDsn: 'https://key@o0.ingest.de.sentry.io/0',
    });
  });

  it('accepts an http URL (a local development server)', () => {
    expect(parseEnv({ apiUrl: 'http://192.168.1.20:8000' }).apiUrl).toBe(
      'http://192.168.1.20:8000',
    );
  });

  it('rejects a malformed URL, naming the variable', () => {
    expect(() => parseEnv({ apiUrl: 'not a url' })).toThrow(ENV_NAMES.apiUrl);
  });

  it('rejects a non-http scheme', () => {
    expect(() => parseEnv({ webUrl: 'javascript:alert(1)' })).toThrow(ENV_NAMES.webUrl);
  });

  it('rejects a Clerk key that is not a publishable key, without echoing it', () => {
    let message = '';
    try {
      parseEnv({ clerkPublishableKey: 'sk_live_secret' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(ENV_NAMES.clerkPublishableKey);
    expect(message).not.toContain('sk_live_secret');
  });

  it('names every malformed variable at once', () => {
    expect(() => parseEnv({ apiUrl: 'nope', sentryDsn: 'ftp://x' })).toThrow(
      /EXPO_PUBLIC_API_URL.*EXPO_PUBLIC_SENTRY_DSN/,
    );
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(parseEnv({}))).toBe(true);
  });
});

describe('env', () => {
  it('is parsed and frozen at import', () => {
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.keys(env).sort()).toEqual(Object.keys(ENV_NAMES).sort());
  });
});
