// User-facing copy for Settings → About and the licence list (docs/app-standard.md rule 8.3). The
// package names, versions, licence ids and texts are the packages' own (licences.json); these are
// the words around them. No product name: the template's copies show the same words.

export const LICENCES_COPY = Object.freeze({
  /** The section's name in Settings, after Privacy & legal. */
  section: 'About',
  /** The row in Settings → About that opens the list. */
  row: 'Licences',
  rowHint: 'Lists the open-source software this app is built from, with each licence.',
  back: 'Back',
  eyebrow: 'Settings',
  title: 'Licences',
  /** Under the title: how many packages there are, and what a row does. */
  lede: (count: number) =>
    `This app is built from ${count} open-source packages. Open one to read its licence.`,
  /** Each package row's hint. */
  packageHint: 'Shows its licence.',
  /** A package that declares no licence: one the licence audit lets ship, with its reason. */
  noLicence: 'No licence declared',
  /** The sheet, for a package with no licence file of its own: it names the declared licence. */
  noFile: (licence: string) => `This package ships no licence file. Its licence is ${licence}.`,
  /** The sheet, for a package with neither a licence file nor a declared licence. */
  noFileOrLicence: 'This package ships no licence file and declares no licence.',
  /** The sheet's close button. */
  close: 'Close',
});
