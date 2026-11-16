// The licence list, read when Settings → Licences opens and never at launch. Metro bundles
// licences.json as a module of its own, and a module runs only when it is first required, so the
// require sits inside the function and nothing imports the file at the top of a module. Metro keeps
// the module once it has run: a second visit does not read it again.
//
// The file is generated (scripts/generate-licences.mjs) and its shape is held by
// scripts/__tests__/release-licences.test.ts, so it is typed here rather than parsed: it is the
// app's own bundled data, not an answer from outside.

import type { LicenceData } from './licences';

export function loadLicences(): LicenceData {
  return require('./licences.json') as LicenceData;
}
