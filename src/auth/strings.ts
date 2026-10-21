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

/**
 * The sign-in screens (src/auth/screens). Sign-in only (D5, D6): no pointer anywhere to making an
 * account, here or in Studio (LEAD-20OCT-SIGNUP); an unknown address is refused in Clerk's words.
 */
export const SIGN_IN_SCREEN_COPY = Object.freeze({
  /** The eyebrow role sets it in capitals. */
  eyebrow: 'Automatos Go',
  title: 'Sign in to Automatos',
  lead: 'Sign in with your Automatos account',
  emailLabel: 'Email',
  emailPlaceholder: 'you@company.com',
  sendCode: 'Email me a code',
  usePassword: 'Use my password',
  passkey: 'Sign in with a passkey',
  passkeyHint: "Opens your phone's passkey sheet.",
  /** Above the field on every step after the choice, then the address. */
  account: 'Account',
  passwordLabel: 'Password',
  signIn: 'Sign in',
  codeLabel: 'Code',
  backupCodeLabel: 'Backup code',
  verify: 'Verify',
  resend: 'Send a new code',
  startAgain: 'Start again',
  emailCodePrompt: 'We emailed you a sign-in code.',
  secondFactorTitle: "Confirm it's you",
  errorTitle: "Couldn't sign you in",
  /** While Clerk activates the session and the shell takes over. */
  completing: 'Signing you in…',
});

/** What the second-factor step asks for, by strategy (the academy's words). */
export const SECOND_FACTOR_PROMPTS = Object.freeze({
  email_code: 'We emailed you a verification code.',
  phone_code: 'We texted you a verification code.',
  totp: 'Enter the code from your authenticator app.',
  backup_code: 'Enter one of your backup codes.',
});

export const ROLE_COPY = Object.freeze({
  /** Under a viewer's read-only chat, in place of the composer (D17). */
  viewerReadOnly: 'Ask your workspace owner for editor access to talk to Auto',
});
