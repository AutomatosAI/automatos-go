// User-facing copy for sign-in and what the signed-in role allows (one strings module per feature).

export const AUTH_COPY = Object.freeze({
  /** A build made without EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY (AuthRoot.tsx). */
  notConfiguredTitle: 'Sign-in is not configured in this build',
  notConfiguredMessage:
    "This build of Automatos Go was made without its sign-in settings, so it can't sign anyone in.",
  /** The server offers no sign-in mode this version knows (select.ts). */
  unsupportedServer: 'This server needs a newer Automatos Go',
});

/** Words the sign-in step machine gives a step (sign-in-machine.ts); refusals are the server's. */
export const SIGN_IN_COPY = Object.freeze({
  needEmail: 'Enter the email address of your Automatos account.',
  needPassword: 'Enter your password.',
  needCode: 'Enter the code.',
  codeResent: 'A new code is on its way.',
  passkeyUnavailable:
    "Passkeys aren't available on this phone. Use an email code or your password.",
  /** The passkey sheet failed without words from Clerk (no passkey for Automatos, a system error). */
  passkeyFailed: "Your passkey didn't work. Try again, or use an email code or your password.",
  /** The tenant asks for a second factor this app has no screen for (e.g. only email_link). */
  unsupportedFactor: "This account needs a verification step Automatos Go can't complete yet.",
  /** Clerk asked for a step outside sign-in (a new password, a Protect check, …). */
  incomplete: "Sign-in couldn't be completed. Start again.",
});

export const ROLE_COPY = Object.freeze({
  /** Under a viewer's read-only chat, in place of the composer (D17). */
  viewerReadOnly: 'Ask your workspace owner for editor access to talk to Auto',
});
