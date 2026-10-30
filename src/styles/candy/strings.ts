// Candy's copy (one strings module per feature, §4.11): every word Candy says beyond the picker's
// name, tagline and look link (src/styles/strings.ts holds those, for its shared maps). Nothing
// commercial (D8), and nothing that points at making an account (D63). Pure: no React.

/** Make it sweet until Candy's look page lands (US-023m): what the page says meanwhile. */
// CANDY_STAND_IN US-023m
export const CANDY_LOOK_SOON_COPY = Object.freeze({
  eyebrow: 'Candy',
  title: 'Make it sweet',
  message: "Candy's palettes, roundness, glow and motion are coming in an update.",
  back: 'Back',
});

/** Save look's name for a saved look ('My look 2') and its line (spec.ts asNewLook). */
export const CANDY_LOOK_COPY = Object.freeze({
  savedName: (n: number) => `My look ${n}`,
  savedSub: (name: string) => `From ${name}`,
});
