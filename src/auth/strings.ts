// User-facing copy for sign-in and what the signed-in role allows (one strings module per feature).

export const AUTH_COPY = Object.freeze({
  /** A build made without EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY (AuthRoot.tsx). */
  notConfiguredTitle: 'Sign-in is not configured in this build',
  notConfiguredMessage:
    "This build of Automatos Go was made without its sign-in settings, so it can't sign anyone in.",
  /** The server offers no sign-in mode this version knows (select.ts). */
  unsupportedServer: 'This server needs a newer Automatos Go',
});

export const ROLE_COPY = Object.freeze({
  /** Under a viewer's read-only chat, in place of the composer (D17). */
  viewerReadOnly: 'Ask your workspace owner for editor access to talk to Auto',
});
