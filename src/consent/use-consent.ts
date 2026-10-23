// The consent step for React (US-007c; D23, KC11): the record of this server and workspace, from
// the app's consent memory (memory.ts), and whether the bootstrap's workspace needs the sheet
// (policy.ts workspaceConsent: its role and its ai_providers). The workspace is the gate's query
// (GET /api/workspaces/current, read at launch, on resume and after a refusal: US-007a), so a list
// that changes on any later bootstrap, or a viewer promoted to editor, asks again with the new
// names. agree() saves what the sheet showed; the gate, reading the same memory, opens the screens.
// Only wiring.

import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { useAppSession } from '../app-state/session';
import { consentMemory } from './app-store';
import { consentRecordFor, workspaceConsent, type WorkspaceConsent } from './policy';
import type { ConsentRecord } from './store';

/** The record of this server and workspace; none while the workspace is not known yet. */
export function useConsentRecord(origin: string, workspaceId: string | null): ConsentRecord | null {
  const read = useCallback(
    () => (workspaceId === null ? null : consentMemory.read({ origin, workspaceId })),
    [origin, workspaceId],
  );
  return useSyncExternalStore(consentMemory.subscribe, read, read);
}

/** needed: the sheet comes before the screens (a person who can send, a list not yet agreed to). */
export type Consent = WorkspaceConsent & {
  /** 'Agree and continue': saves the record for this server and workspace. */
  readonly agree: () => void;
};

/** The ready session's consent: only under the (app) gate. */
export function useConsent(): Consent {
  const { server, workspace } = useAppSession();
  const record = useConsentRecord(server.apiUrl, workspace.id);
  const consent = useMemo(() => workspaceConsent(workspace, record), [workspace, record]);
  const agree = useCallback(() => {
    if (!consent.needed) return;
    const scope = { origin: server.apiUrl, workspaceId: workspace.id };
    consentMemory.agree(scope, consentRecordFor(consent.providers, new Date()));
  }, [consent, server.apiUrl, workspace.id]);
  return { ...consent, agree };
}
