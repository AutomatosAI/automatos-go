// User-facing copy for the AI-provider consent sheet (one strings module per folder; D23, KC11).
// It names what goes to the providers and nothing broader (KC16); nothing about billing (D8).

const WHAT_GOES =
  'What you send to Auto and your agents — messages, answers, notes and attachments — goes to them so they can reply.';

/** 'A', 'A and B', 'A, B and C': every name, in the sheet's order. */
export function namesList(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export const CONSENT_COPY = Object.freeze({
  /** The server lists its providers: each one by name. */
  listed: (names: readonly string[]) =>
    `Auto answers using AI models from ${namesList(names)}. ${WHAT_GOES}`,
  /** The server does not list them (before PRD-266 W3): no name is made up. */
  unlisted: `Auto answers using AI models from the AI providers this workspace uses, for chat and, where it is available, Auto Live voice. ${WHAT_GOES}`,
  unlistedNote: "This server doesn't list them yet.",
});

/** The consent sheet (ConsentSheet.tsx): the AI label beside the heading is the foundation's. */
export const CONSENT_SHEET_COPY = Object.freeze({
  heading: 'Before you talk to Auto',
  /** Above the list of the server's providers, each by the name it sends. */
  providersLabel: 'AI providers',
  agree: 'Agree and continue',
  agreeHint: 'Saves your agreement on this phone and opens Auto',
});
