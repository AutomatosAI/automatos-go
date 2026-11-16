// The licence list as data (docs/app-standard.md rule 8.3): the shape scripts/generate-licences.mjs
// writes to licences.json, and what Settings → Licences shows from it, a row per package and the
// sheet of one. Pure, so LicencesScreen.tsx and LicenceSheet.tsx only lay it out. The file itself is
// read by load-licences.ts, and only when the screen opens.

import { LICENCES_COPY } from './strings';

/** One package the app ships, as licences.json lists it. */
export type LicencePackage = Readonly<{
  name: string;
  version: string;
  /** What its package.json declares ('MIT', '(MIT OR CC0-1.0)'); null when it declares none. */
  licence: string | null;
  /** The key of its licence text in `texts`; null when the package ships no licence file. */
  text: string | null;
}>;

/** licences.json: the packages by name, and each distinct licence text once, by key. */
export type LicenceData = Readonly<{
  note: string;
  packages: readonly LicencePackage[];
  texts: Readonly<Record<string, string>>;
}>;

/** One row of the list: the package's name over its version and licence. */
export type LicenceRowView = Readonly<{
  /** name@version: one row per installed version. */
  id: string;
  title: string;
  summary: string;
  entry: LicencePackage;
}>;

/** The sheet for one package: its name, version and licence, then its text or why there is none. */
export type LicenceSheetView = Readonly<{
  title: string;
  meta: string;
  /** The licence file's text; null when the package ships none. */
  text: string | null;
  /** Said instead of a text: the package ships no licence file. Null when there is a text. */
  note: string | null;
}>;

const SEPARATOR = ' · ';

/** The licence as a person reads it: the declared id, or that none is declared. */
export function licenceLabel(entry: LicencePackage): string {
  return entry.licence ?? LICENCES_COPY.noLicence;
}

/** '1.2.3 · MIT'. */
export function licenceSummary(entry: LicencePackage): string {
  return `${entry.version}${SEPARATOR}${licenceLabel(entry)}`;
}

/** The list's rows, in the file's order (by name, then version). */
export function licenceRows(data: LicenceData): readonly LicenceRowView[] {
  return Object.freeze(
    data.packages.map((entry) => ({
      id: `${entry.name}@${entry.version}`,
      title: entry.name,
      summary: licenceSummary(entry),
      entry,
    })),
  );
}

/** A package's licence text, or null when it ships none (or the key names no text). */
export function licenceText(data: LicenceData, entry: LicencePackage): string | null {
  if (entry.text === null) return null;
  return Object.prototype.hasOwnProperty.call(data.texts, entry.text)
    ? data.texts[entry.text]
    : null;
}

function noTextNote(entry: LicencePackage): string {
  return entry.licence === null
    ? LICENCES_COPY.noFileOrLicence
    : LICENCES_COPY.noFile(entry.licence);
}

/** What the sheet shows for one package. */
export function licenceSheetView(data: LicenceData, entry: LicencePackage): LicenceSheetView {
  const text = licenceText(data, entry);
  return Object.freeze({
    title: entry.name,
    meta: licenceSummary(entry),
    text,
    note: text === null ? noTextNote(entry) : null,
  });
}
