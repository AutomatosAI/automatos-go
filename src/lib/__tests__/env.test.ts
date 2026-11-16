import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ENV_NAMES, SERVER_ADDRESS_FAULT, env, isHttpUrl, isServerAddress, parseEnv } from '../env';

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

  it('accepts an http address in a development build only (a server on the same network)', () => {
    const local = 'http://192.168.1.20:8000';
    expect(parseEnv({ apiUrl: local }, true).apiUrl).toBe(local);
    expect(() => parseEnv({ apiUrl: local }, false)).toThrow(ENV_NAMES.apiUrl);
    expect(() => parseEnv({ apiUrl: local })).toThrow(ENV_NAMES.apiUrl); // a test run is no dev build
    expect(() => parseEnv({ webUrl: 'http://studio.example.test' }, false)).toThrow(
      ENV_NAMES.webUrl,
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

describe('the addresses a build is given', () => {
  const RELEASE = false;
  const DEVELOPMENT = true;

  it.each([
    'https://api.automatos.app',
    'https://api.automatos.app/',
    'https://api.automatos.app:8443',
    'https://studio.automatos.app',
    'https://[::1]:8443',
  ])('accepts %s', (value) => {
    expect(isServerAddress(value, RELEASE)).toBe(true);
    expect(isServerAddress(value, DEVELOPMENT)).toBe(true);
  });

  it.each([
    ['a user name and password', 'https://user:secret@api.automatos.app'],
    ['a user name alone', 'https://user@api.automatos.app'],
    ['a path', 'https://api.automatos.app/api'],
    ['a query', 'https://api.automatos.app/?next=https://elsewhere.test'],
    ['a fragment', 'https://api.automatos.app/#x'],
    ['a backslash', 'https://api.automatos.app\\@elsewhere.test'],
    ['another scheme', 'javascript:alert(1)'],
    ['a file', 'file:///etc/hosts'],
    ['no host', 'https://'],
    ['words', 'not a url'],
    ['no slashes after the scheme', 'https:api.automatos.app'],
    ['one slash after the scheme', 'https:/api.automatos.app'],
    ['capitals', 'HTTPS://API.AUTOMATOS.APP'],
    ['a tab in the host', 'https://api.auto\tmatos.app'],
    ['a control character before it', '\u0001https://api.automatos.app'],
    ['a host in percent signs', 'https://%61pi.automatos.app'],
    ['a short form of an IP address', 'https://127.1'],
    ['a non-ASCII host', 'https://b\u00fccher.example'],
    ['an IPv4 address in hex', 'https://0x7f.0.0.1'],
    ['the default port written out', 'https://api.automatos.app:443'],
    ['a dot path', 'https://api.automatos.app/.'],
    ['two slashes at the end', 'https://api.automatos.app//'],
  ])('refuses %s, in a release build and in a development one', (_what, value) => {
    expect(isServerAddress(value, RELEASE)).toBe(false);
    expect(isServerAddress(value, DEVELOPMENT)).toBe(false);
  });

  // A phone's URL is Expo's, with no Unicode: it keeps a host as it is written, so the parser's own
  // origin cannot be the only check there (parser differential, security review 16 Nov).
  describe('with a URL that keeps the host as written, as the one on a phone does', () => {
    class KeepsTheHost {
      readonly protocol: string;
      readonly hostname: string;
      readonly pathname: string;
      readonly origin: string;
      constructor(value: string) {
        const match = /^(https?:)\/\/(\[[^\]]*\]|[^/:]*)(:\d+)?(\/.*)?$/.exec(value);
        if (!match) throw new TypeError('Invalid URL');
        this.protocol = match[1] ?? '';
        this.hostname = match[2] ?? '';
        this.pathname = match[4] ?? '/';
        this.origin = `${this.protocol}//${this.hostname}${match[3] ?? ''}`;
      }
    }

    beforeEach(() => vi.stubGlobal('URL', KeepsTheHost));
    afterEach(() => vi.unstubAllGlobals());

    it.each([
      ['a full-width address', 'https://\uff11\uff12\uff17.\uff10.\uff10.\uff11'],
      ['a non-ASCII name', 'https://b\u00fccher.example'],
      ['capitals', 'https://API.automatos.app'],
      ['an IPv4 address in hex', 'https://0x7f.0.0.1'],
      ['an IPv4 address in fewer parts', 'https://127.1'],
    ])('refuses %s, which that URL would let through', (_what, value) => {
      expect(isServerAddress(value, RELEASE)).toBe(false);
    });

    it('still takes a plain name, a dotted quad in development and an IPv6 literal', () => {
      expect(isServerAddress('https://api.automatos.app', RELEASE)).toBe(true);
      expect(isServerAddress('http://192.168.1.20:8000', DEVELOPMENT)).toBe(true);
      expect(isServerAddress('https://[::1]:8443', RELEASE)).toBe(true);
    });
  });

  it('accepts plain http in a development build only', () => {
    expect(isServerAddress('http://192.168.1.20:8000', DEVELOPMENT)).toBe(true);
    expect(isServerAddress('http://192.168.1.20:8000', RELEASE)).toBe(false);
    expect(isServerAddress('http://localhost:8000', RELEASE)).toBe(false);
  });

  it('holds development http to this machine and a home network, never a public name', () => {
    for (const value of [
      'http://192.168.1.20:8000',
      'http://10.0.0.2:8000',
      'http://172.16.4.1',
      'http://automatos.local:8000',
      'http://localhost:8000',
      'http://127.0.0.1:8000',
      'http://[::1]:8000',
    ]) {
      expect(isServerAddress(value, DEVELOPMENT), value).toBe(true);
    }
    for (const value of [
      'http://api.automatos.app',
      'http://52.95.110.1:8000',
      'http://100.64.1.1:8000',
      'http://169.254.169.254',
      'http://nas',
      'http://[2600::1]:8000',
    ]) {
      expect(isServerAddress(value, DEVELOPMENT), value).toBe(false);
    }
  });

  it('names the variable and the rule, never the value', () => {
    const value = 'https://user:secret@api.automatos.app';
    const refused = () => parseEnv({ apiUrl: value }, RELEASE);
    expect(refused).toThrow(`${ENV_NAMES.apiUrl} ${SERVER_ADDRESS_FAULT}`);
    expect(refused).not.toThrow(/secret/);
  });

  it("leaves the crash reporter's address to its own rule: it carries a key before the host", () => {
    const dsn = 'https://abc123@o1.ingest.de.sentry.io/42';
    expect(parseEnv({ sentryDsn: dsn }, RELEASE).sentryDsn).toBe(dsn);
  });

  it('a paired server may still be plain http: isHttpUrl is unchanged', () => {
    expect(isHttpUrl('http://192.168.1.20:8000')).toBe(true);
    expect(isHttpUrl('https://home.example.test/base')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
  });
});
