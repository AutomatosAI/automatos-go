// What the release scripts read about the app from its own committed files (docs/release/README.md,
// "First release" and "State check"): the EAS link and the bundle id from app.json, the App Store
// Connect app from eas.json's submit profile, and the EAS environment names from
// docs/release/eas-env.json. Nothing here is written into a script: a copy of the template keeps
// these scripts as they are and its own app.json, eas.json and eas-env.json give its values.
//
// Paths are resolved from this file, so the scripts read the app they sit in, from any working
// directory (an app inside a monorepo folder too). Node's built-ins only.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The app's own folder: two levels above scripts/release/. */
export const APP_ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** The submit profile and the delivery workflow the template releases with. */
export const DEFAULT_PROFILE = 'testflight';
export const DEFAULT_WORKFLOW = 'testflight.yml';
/** The committed list of the EAS environment names the app needs, per environment. */
export const EAS_ENV_LIST = 'docs/release/eas-env.json';

const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;
const ENVIRONMENT = /^[a-z][a-z0-9-]*$/;

/** A file the scripts read is missing, unreadable or not what it should be. */
export class ProjectError extends Error {}

const messageOf = (error) => (error instanceof Error ? error.message : String(error));

function readJson(root, file) {
  try {
    return JSON.parse(readFileSync(path.join(root, file), 'utf8'));
  } catch (error) {
    throw new ProjectError(`could not read ${file}: ${messageOf(error)}`);
  }
}

const text = (value) => (typeof value === 'string' && value.trim() !== '' ? value : undefined);

/** The submit profile's iOS block, following `extends` as eas.json does. */
function submitIos(eas, profile, seen = new Set()) {
  const entry = eas?.submit?.[profile];
  if (entry === undefined || seen.has(profile)) return {};
  const base = text(entry.extends)
    ? submitIos(eas, entry.extends, new Set([...seen, profile]))
    : {};
  return { ...base, ...(entry.ios ?? {}) };
}

/**
 * The app as the release scripts see it. `ascAppId` is undefined for an app that does not exist in
 * App Store Connect yet (a new app: docs/release/README.md, "First release").
 * @param {{ root?: string, profile?: string }} [options]
 */
export function readProject({ root = APP_ROOT, profile = DEFAULT_PROFILE } = {}) {
  const expo = readJson(root, 'app.json')?.expo ?? {};
  const ios = submitIos(readJson(root, 'eas.json'), profile);
  return Object.freeze({
    name: text(expo.name),
    slug: text(expo.slug),
    owner: text(expo.owner),
    projectId: text(expo.extra?.eas?.projectId),
    bundleId: text(expo.ios?.bundleIdentifier),
    profile,
    ascAppId: text(ios.ascAppId),
  });
}

function namesOf(environment, names) {
  if (!Array.isArray(names) || names.length === 0) {
    throw new ProjectError(`${EAS_ENV_LIST}: "${environment}" lists no names`);
  }
  const wrong = names.filter((name) => typeof name !== 'string' || !ENV_NAME.test(name));
  if (wrong.length > 0) {
    throw new ProjectError(`${EAS_ENV_LIST}: "${environment}" has a name that is not one`);
  }
  if (new Set(names).size !== names.length) {
    throw new ProjectError(`${EAS_ENV_LIST}: "${environment}" lists a name twice`);
  }
  return Object.freeze([...names]);
}

/**
 * The names each EAS environment must hold, from docs/release/eas-env.json: names only, never a
 * value.
 * @returns {Readonly<Record<string, readonly string[]>>}
 */
export function readEnvList({ root = APP_ROOT } = {}) {
  const environments = readJson(root, EAS_ENV_LIST)?.environments;
  if (typeof environments !== 'object' || environments === null || Array.isArray(environments)) {
    throw new ProjectError(`${EAS_ENV_LIST}: no "environments" object`);
  }
  const entries = Object.entries(environments);
  if (entries.length === 0) throw new ProjectError(`${EAS_ENV_LIST}: no environment listed`);
  entries.forEach(([environment]) => {
    if (!ENVIRONMENT.test(environment)) {
      throw new ProjectError(`${EAS_ENV_LIST}: "${environment}" is not an EAS environment name`);
    }
  });
  return Object.freeze(
    Object.fromEntries(
      entries.map(([environment, names]) => [environment, namesOf(environment, names)]),
    ),
  );
}
