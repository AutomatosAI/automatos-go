// Sign-in contracts with the server (D-NO-HARDCODE): every name the server must also know is here.

/**
 * The Clerk JWT template every Automatos Go session token is minted from (D39). It carries the
 * native-app marker the server's azp check accepts in place of a browser origin, so the app never
 * falls back to a template-less token: one would pass today and fail once CLERK_AZP_REQUIRED is on.
 */
export const MOBILE_TOKEN_TEMPLATE = 'mobile';
