// App environment — EXPO_PUBLIC_* vars are inlined by Expo at build time, so
// each one is read by its full static name (Expo cannot inline a dynamic
// lookup). Values come from the EAS environment for cloud builds; README.md
// 'Environment' lists the names. Parsed once with zod at the boundary: an empty
// value is allowed (that feature reports "not configured"), a present value
// must be well formed.
//
// The two addresses a build is given (the hosted API and hosted Studio) are held to a narrow
// form, because every hosted request and every link into Studio starts from them: https, a host
// and an optional port, and no user name, password, path, query or fragment. http is accepted in
// a development build only, for a server on the same network or this machine. A server a person pairs their phone
// with is another matter (src/connect): there http on a home network is allowed on purpose, and
// isHttpUrl is the check for it.

import { z } from 'zod';

import { httpAllowedTo, isPlainHost } from './host-text';

/** True in a development build only (Metro sets it); a release build and a test run are not one. */
const IS_DEVELOPMENT = typeof __DEV__ !== 'undefined' && __DEV__;

const HTTPS = 'https:';
const HTTP = 'http:';
const ROOT_PATH = '/';
/** What never belongs in a server's address: a user name, a query, a fragment, a backslash. */
const NEVER_IN_AN_ADDRESS: readonly string[] = ['@', '?', '#', '\\'];

/** Why an address was refused. It follows the variable's name; the value is never repeated. */
export const SERVER_ADDRESS_FAULT =
  'must be the https address of the server and nothing more: no user name or password, no path, no query and no fragment (http is accepted in a development build only)';

const HTTP_PROTOCOLS = new Set([HTTP, HTTPS]);

export function isHttpUrl(value: string): boolean {
  try {
    return HTTP_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

function parsedUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null; // not an address at all
  }
}

/** The value as it is used: without the one slash an address may end with. */
function withoutLastSlash(value: string): string {
  return value.endsWith(ROOT_PATH) ? value.slice(0, -1) : value;
}

/**
 * Whether a value is an address a build may be given for a hosted server: https (or http, in a
 * development build), with nothing before the host and nothing after it but an optional port and
 * one slash. The marks of a user name, a query and a fragment are looked for in the text itself,
 * so an address that hides one from the parser is refused too. And the value must be written as
 * the parser reads it (its origin): the text itself is what every request is built on, so a form
 * the parser forgives (`https:host`, a tab in the host, capitals, a host in percent signs, the
 * default port written out) is refused. The host must also be written plainly (host-text.ts
 * isPlainHost), because the parser that checks it at launch is not the one the phone connects
 * with; and http, in a development build, reaches only this machine or a home network.
 */
export function isServerAddress(value: string, development: boolean): boolean {
  if (NEVER_IN_AN_ADDRESS.some((mark) => value.includes(mark))) return false;
  const url = parsedUrl(value);
  if (url === null) return false;
  // development http reaches only this machine or a home network (host-text.ts httpAllowedTo, the
  // rule pairing and the client ask): a bearer never goes in clear across the internet
  const http = development && url.protocol === HTTP && httpAllowedTo(url.hostname, { development });
  if (!(url.protocol === HTTPS || http) || url.hostname === '' || url.pathname !== ROOT_PATH) {
    return false;
  }
  return url.origin === withoutLastSlash(value) && isPlainHost(url.hostname);
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

function envSchema(development: boolean) {
  const serverAddressOrBlank = z
    .string()
    .trim()
    .pipe(
      z.union([
        blank,
        z.string().refine((value) => isServerAddress(value, development), SERVER_ADDRESS_FAULT),
      ]),
    )
    .default('');
  return z.object({
    /** Clerk publishable key for hosted sign-in — empty in builds without auth wiring */
    clerkPublishableKey: clerkKeyOrBlank,
    /** hosted Automatos API base URL (the built-in server; discovery is read from it) */
    apiUrl: serverAddressOrBlank,
    /** hosted Studio web URL — the base for links into Studio, opened in the system browser */
    webUrl: serverAddressOrBlank,
    /** Sentry DSN (EU region) — empty keeps error reporting off */
    sentryDsn: httpUrlOrBlank,
  });
}

export type Env = Readonly<z.infer<ReturnType<typeof envSchema>>>;
export type RawEnv = Partial<Record<keyof Env, string | undefined>>;

/** env field → the EXPO_PUBLIC_* name it is read from, for error messages */
export const ENV_NAMES: Readonly<Record<keyof Env, string>> = Object.freeze({
  clerkPublishableKey: 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
  apiUrl: 'EXPO_PUBLIC_API_URL',
  webUrl: 'EXPO_PUBLIC_WEB_URL',
  sentryDsn: 'EXPO_PUBLIC_SENTRY_DSN',
});

/**
 * Pure parse; throws naming each malformed variable (never its value). `development` is the
 * build's own answer unless a test says otherwise.
 */
export function parseEnv(raw: RawEnv, development: boolean = IS_DEVELOPMENT): Env {
  const result = envSchema(development).safeParse(raw);
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
