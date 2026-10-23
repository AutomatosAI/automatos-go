// The sign-in screens' shape, read from the source (vitest runs no React Native renderer): every
// step US-005c names is a component of its own, the routes mount the screen, sign-in is the only
// way in (no sign-up, social or Apple path), and nothing in the app points at making an account
// (LEAD-20OCT-SIGNUP), in Studio or anywhere else.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SECOND_FACTOR_PROMPTS, SIGN_IN_COPY, SIGN_IN_SCREEN_COPY } from '../../strings';

const ROOT = path.resolve(__dirname, '../../../..');
const SCREENS_DIR = path.resolve(__dirname, '..');
const read = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), 'utf8');

const SCREENS = readdirSync(SCREENS_DIR)
  .filter((file) => file.endsWith('.tsx'))
  .map((file) => ({
    name: path.basename(file, '.tsx'),
    source: readFileSync(path.join(SCREENS_DIR, file), 'utf8'),
  }));

/** Hand-written app code: src (not the vendored core) and the routes, tests left out. */
function appSources(dir: string): readonly string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      const skipped = entry === '__tests__' || full.endsWith(path.join('src', 'core', 'web'));
      return skipped ? [] : appSources(full);
    }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

const ACCOUNT_CREATION = /create (an|one|your|a new) account|no account\?|sign(ing)? up\b/i;
const OTHER_WAYS_IN = /useSignUp|signUp\.|useSSO|oauth_|expo-apple-authentication|SignInWithApple/;

describe('src/auth/screens: one component per step', () => {
  it('has every step US-005c names', () => {
    const names = SCREENS.map((screen) => screen.name);
    for (const name of [
      'SignInScreen',
      'IdentifyStep',
      'EmailCodeStep',
      'PasswordStep',
      'PasskeyButton',
      'SecondFactorStep',
    ]) {
      expect(names).toContain(name);
    }
  });

  it('exports exactly one component per file, named after the file', () => {
    for (const { name, source } of SCREENS) {
      expect(source.match(/^export function [A-Z]\w*/gm), name).toEqual([
        `export function ${name}`,
      ]);
    }
  });

  it('takes its words from src/auth/strings.ts, never a literal in JSX text', () => {
    for (const { name, source } of SCREENS) {
      expect(source, name).not.toMatch(/>\s*[A-Za-z][^<>{}]*</);
    }
  });

  it('the second-factor step offers Send a new code only through the delivery rule', () => {
    const code = SCREENS.find((screen) => screen.name === 'CodeEntry')?.source ?? '';
    expect(code).toMatch(/entry\.canResend \?/);
    expect(code).toContain('SIGN_IN_SCREEN_COPY.resend');
  });
});

describe('the password field', () => {
  const password = () => SCREENS.find((screen) => screen.name === 'PasswordStep')?.source ?? '';

  it('is secure, and autofills only as the current password', () => {
    expect(password()).toMatch(/\bsecureTextEntry\b/);
    expect(password()).toContain('autoComplete="current-password"');
    expect(password()).toContain('textContentType="password"');
  });

  it('clears a refused password', () => {
    expect(password()).toContain("if (note?.tone === 'error') setPassword('');");
  });
});

describe('the sign-in routes', () => {
  it('app/(auth)/sign-in.tsx mounts SignInScreen', () => {
    expect(read('app', '(auth)', 'sign-in.tsx')).toMatch(/return <SignInScreen \/>/);
  });

  it('app/(auth)/_layout.tsx sends a signed-in user home and stacks the rest', () => {
    const layout = read('app', '(auth)', '_layout.tsx');
    expect(layout).toMatch(/if \(isSignedIn\) return <Redirect/);
    expect(layout).toContain('<Stack');
  });

  it('the passkey button runs the discoverable flow through the passkeys AuthRoot provides', () => {
    const identify = SCREENS.find((screen) => screen.name === 'IdentifyStep')?.source ?? '';
    expect(identify).toContain("send({ type: 'usePasskey' })");
    expect(read('src', 'auth', 'AuthRoot.tsx')).toContain('__experimental_passkeys={passkeys}');
  });
});

describe('sign-in only (D5, D6, LEAD-20OCT-SIGNUP)', () => {
  it("the lead line is 'Sign in with your Automatos account'", () => {
    expect(SIGN_IN_SCREEN_COPY.lead).toBe('Sign in with your Automatos account');
    const screen = SCREENS.find((s) => s.name === 'SignInScreen')?.source ?? '';
    expect(screen).toContain('SIGN_IN_SCREEN_COPY.lead');
  });

  it('no sign-in copy points at making an account', () => {
    const copy = [SIGN_IN_SCREEN_COPY, SIGN_IN_COPY, SECOND_FACTOR_PROMPTS].flatMap(Object.values);
    for (const text of copy) expect(text).not.toMatch(ACCOUNT_CREATION);
  });

  it('no app source points at making an account, or has another way in', () => {
    const files = [...appSources(path.join(ROOT, 'src')), ...appSources(path.join(ROOT, 'app'))];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, path.relative(ROOT, file)).not.toMatch(ACCOUNT_CREATION);
      expect(source, path.relative(ROOT, file)).not.toMatch(OTHER_WAYS_IN);
    }
  });

  it('the screens open no link into Studio', () => {
    for (const { name, source } of SCREENS) {
      expect(source, name).not.toMatch(/webUrl|Linking|openURL|WebBrowser/);
    }
  });

  it('README.md and CLAUDE.md describe EXPO_PUBLIC_WEB_URL as links into Studio', () => {
    for (const doc of ['README.md', 'CLAUDE.md']) {
      const line = read(doc)
        .split('\n')
        .find((text) => text.includes('`EXPO_PUBLIC_WEB_URL`'));
      expect(line, doc).toMatch(/links into Studio/);
      expect(line, doc).not.toMatch(/create an account/i);
    }
  });
});
