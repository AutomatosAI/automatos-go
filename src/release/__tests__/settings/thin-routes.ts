// The thin-route audit's allowed list (thin-routes.test.ts, rule 4.4): the route files under app/
// that cannot be thin, each with its reason. A listed file that is gone, or that is now thin,
// fails the audit.

import { frozen } from './types';

/** Route files that cannot be thin, each with its reason. */
export const NOT_THIN: Readonly<Record<string, string>> = frozen({
  'app/(app)/chat/index.tsx':
    "an alias: routes.chatWithTicket is /chat?ticket=<row id>, which no [id] segment matches, so the file re-exports the [id] route's default and holds nothing of its own",
});
