// The Account screen's rows (PRD-001 §4.5 "Settings shows the server, the edition, the workspace and
// the role", §4.7): what the signed-in session is, in words. The server and the edition are the
// server section's (src/connect/edges.ts serverSectionView, US-006h); these are the workspace, the
// role and the app version. Pure, so the screen only lays them out. The plan is never shown (D8)
// and nothing here deletes anything (D63).

import type { Server } from '../api/server';
import type { Workspace } from '../api/workspace';
import { ACCOUNT_COPY, EDITION_LABELS, ROLE_LABELS } from './strings';

export type AccountRow = { readonly label: string; readonly value: string };

export type AccountInput = {
  readonly workspace: Pick<Workspace, 'name' | 'role'>;
  /** The build's version (app.json "version"); blank when the config has none. */
  readonly appVersion: string | null | undefined;
};

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** The server as people know it: its host, without the scheme or a path. */
export function serverLabel(server: Pick<Server, 'apiUrl'>): string {
  const rest = server.apiUrl.replace(SCHEME, '');
  const end = rest.search(/[/?#]/);
  return end < 0 ? rest : rest.slice(0, end);
}

export function editionLabel(edition: string): string {
  return Object.prototype.hasOwnProperty.call(EDITION_LABELS, edition)
    ? EDITION_LABELS[edition]
    : edition;
}

export function accountRows({ workspace, appVersion }: AccountInput): readonly AccountRow[] {
  return Object.freeze([
    { label: ACCOUNT_COPY.workspace, value: workspace.name },
    { label: ACCOUNT_COPY.role, value: ROLE_LABELS[workspace.role] },
    { label: ACCOUNT_COPY.version, value: appVersion?.trim() || ACCOUNT_COPY.unknownVersion },
  ]);
}
