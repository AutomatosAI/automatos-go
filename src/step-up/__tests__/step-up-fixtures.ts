// Fakes for the step-up tests: the LocalAuthentication port (each call recorded, the prompt held
// open until released), a storage that can refuse, and the installed module's typings read as text.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ENROLLED_LEVEL, type AuthResult } from '../policy';
import type { AuthOptions, LocalAuthPort } from '../step-up';

export type AuthCall =
  | Readonly<{ op: 'hardware' }>
  | Readonly<{ op: 'level' }>
  | Readonly<{ op: 'auth'; options: AuthOptions }>;

export type FakeAuthOptions = Partial<{
  hasHardware: boolean;
  level: number;
  /** The prompt's answer; an Error rejects it. */
  result: AuthResult | Error;
  /** The prompt stays open until release() is called. */
  held: boolean;
  /** hasHardwareAsync rejects. */
  hardwareThrows: boolean;
}>;

export function fakeAuth(options: FakeAuthOptions = {}) {
  const calls: AuthCall[] = [];
  let release: (result: AuthResult) => void = () => undefined;
  const answer = (): Promise<AuthResult> => {
    if (options.result instanceof Error) return Promise.reject(options.result);
    if (options.held) {
      return new Promise((resolve) => {
        release = resolve;
      });
    }
    return Promise.resolve(options.result ?? { success: true });
  };
  const port: LocalAuthPort = {
    hasHardwareAsync: async () => {
      calls.push({ op: 'hardware' });
      if (options.hardwareThrows) throw new Error('LAContext unavailable');
      return options.hasHardware ?? true;
    },
    getEnrolledLevelAsync: async () => {
      calls.push({ op: 'level' });
      return options.level ?? ENROLLED_LEVEL.BIOMETRIC_STRONG;
    },
    authenticateAsync: (authOptions: AuthOptions) => {
      calls.push({ op: 'auth', options: authOptions });
      return answer();
    },
  };
  return {
    port,
    calls,
    prompts: () => calls.filter((call) => call.op === 'auth').length,
    release: (result: AuthResult) => release(result),
  };
}

/** A storage the setting reads and writes; `refuse` makes either call throw. */
export function settingStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  const refuse = { read: false, write: false };
  return {
    items,
    refuse,
    storage: () => ({
      getItem: (key: string) => {
        if (refuse.read) throw new Error('storage locked');
        return items.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (refuse.write) throw new Error('storage full');
        items.set(key, value);
      },
    }),
  };
}

/** Lets every pending promise callback run. */
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const TYPES = path.resolve(
  __dirname,
  '../../../node_modules/expo-local-authentication/build/LocalAuthentication.types.d.ts',
);

/** The installed module's LocalAuthenticationError codes, as its typings declare them. */
export function installedErrorCodes(): string[] {
  const text = readFileSync(TYPES, 'utf8');
  const union = /type LocalAuthenticationError = ([^;]+);/.exec(text)?.[1] ?? '';
  return [...union.matchAll(/'([a-z_]+)'/g)].map((match) => match[1] ?? '');
}

/** The installed module's SecurityLevel members that carry a value (NAME = n). */
export function installedSecurityLevels(): Record<string, number> {
  const text = readFileSync(TYPES, 'utf8');
  const body = /enum SecurityLevel \{([\s\S]*?)\n\}/.exec(text)?.[1] ?? '';
  return Object.fromEntries(
    [...body.matchAll(/^\s*([A-Z_]+) = (\d+),?$/gm)].map((match) => [
      match[1] ?? '',
      Number(match[2]),
    ]),
  );
}
