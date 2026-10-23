// The consent sheet's words, pure (US-007c; D23, KC11): the heading, the sentence of strings.ts,
// every provider the server lists by the name it sends (Retell for Auto Live voice included, never
// filtered or grouped away) or, for a server that lists none, the unlisted sentence and its note.
// One way on, 'Agree and continue', and ONE way out: Sign out on the hosted server, Forget this
// server (asked first) on an own one. No 'Not now': the screens wait for the yes. ConsentSheet.tsx
// only lays this out.

import type { ServerSource } from '../api/server';
import { SHELL_COPY } from '../app-state/strings';
import { FORGET_SERVER_COPY } from '../connect/strings';
import type { AgreeableProviders } from './policy';
import { providerNames } from './providers';
import { CONSENT_COPY, CONSENT_SHEET_COPY } from './strings';

/** The sheet's one secondary action, per server source. */
export type ConsentLeave =
  | { readonly action: 'sign_out'; readonly label: string }
  /** Asked first (ForgetServer), naming the server. */
  | { readonly action: 'forget_server'; readonly label: string; readonly question: string };

export type ConsentSheetView = {
  readonly heading: string;
  readonly body: string;
  /** Every provider the server lists, by its name, in the sheet's order; none when unlisted. */
  readonly providers: readonly string[];
  /** Why no provider is named (an unlisted server); null when the server lists them. */
  readonly note: string | null;
  readonly agree: string;
  readonly leave: ConsentLeave;
};

export type ConsentSheetInput = {
  readonly providers: AgreeableProviders;
  /** The session's server: the hosted one signs out, an own one is forgotten. */
  readonly source: ServerSource;
  /** The server in words, for the forget question (src/connect/edges.ts). */
  readonly serverName: string;
};

function leaveFor(source: ServerSource, serverName: string): ConsentLeave {
  if (source === 'own') {
    return {
      action: 'forget_server',
      label: FORGET_SERVER_COPY.action,
      question: FORGET_SERVER_COPY.question(serverName),
    };
  }
  return { action: 'sign_out', label: SHELL_COPY.signOut };
}

export function consentSheetView({
  providers,
  source,
  serverName,
}: ConsentSheetInput): ConsentSheetView {
  const names = providerNames(providers);
  const listed = providers.kind === 'listed';
  return Object.freeze({
    heading: CONSENT_SHEET_COPY.heading,
    body: listed ? CONSENT_COPY.listed(names) : CONSENT_COPY.unlisted,
    providers: Object.freeze([...names]),
    note: listed ? null : CONSENT_COPY.unlistedNote,
    agree: CONSENT_SHEET_COPY.agree,
    leave: Object.freeze(leaveFor(source, serverName)),
  });
}
