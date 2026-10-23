// App environment — EXPO_PUBLIC_* vars are inlined by Expo at build time, so
// each one is read by its full static name (Expo cannot inline a dynamic
// lookup). Values come from the EAS environment for cloud builds; README.md
// 'Environment' lists the names. Parsed once with zod at the boundary: an empty
// value is allowed (that feature reports "not configured"), a present value
// must be well formed.

import { z } from 'zod';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

export function isHttpUrl(value: string): boolean {
  try {
    return HTTP_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

const blank = z.literal('');

const httpUrlOrBlank = z
  .string()
  .trim()
  .pipe(z.union([blank, z.string().refine(isHttpUrl, 'must be an http(s) URL')]))
  .default('');

const clerkKeyOrBlank = z
  .string()
  .trim()
  .pipe(
    z.union([blank, z.string().regex(/^pk_(test|live)_/, 'must start with pk_test_ or pk_live_')]),
  )
  .default('');

const EnvSchema = z.object({
  /** Clerk publishable key for hosted sign-in — empty in builds without auth wiring */
  clerkPublishableKey: clerkKeyOrBlank,
  /** hosted Automatos API base URL (the built-in server; discovery is read from it) */
  apiUrl: httpUrlOrBlank,
  /** hosted Studio web URL — the base for links into Studio, opened in the system browser */
  webUrl: httpUrlOrBlank,
  /** Sentry DSN (EU region) — empty keeps error reporting off */
  sentryDsn: httpUrlOrBlank,
});

export type Env = Readonly<z.infer<typeof EnvSchema>>;
export type RawEnv = Partial<Record<keyof Env, string | undefined>>;

/** env field → the EXPO_PUBLIC_* name it is read from, for error messages */
export const ENV_NAMES: Readonly<Record<keyof Env, string>> = Object.freeze({
  clerkPublishableKey: 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
  apiUrl: 'EXPO_PUBLIC_API_URL',
  webUrl: 'EXPO_PUBLIC_WEB_URL',
  sentryDsn: 'EXPO_PUBLIC_SENTRY_DSN',
});

/** Pure parse; throws naming each malformed variable (never its value). */
export function parseEnv(raw: RawEnv): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const field = issue.path[0] as keyof Env;
      return `${ENV_NAMES[field] ?? String(field)} ${issue.message}`;
    });
    throw new Error(`Invalid build environment: ${problems.join('; ')}`);
  }
  return Object.freeze(result.data);
}

export const env: Env = parseEnv({
  clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  webUrl: process.env.EXPO_PUBLIC_WEB_URL,
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
});
