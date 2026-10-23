// The Deliverable page's hooks: they read the Deliverable with its content, the clock, the phone's
// timezone, the server's addresses and the gate's inputs, and hand them to detail.ts (pure). Open
// on a PDF, DOCX or XLSX downloads it with the client's own headers and shows it in the system
// viewer (open-file.ts), one press at a time; a link to another site goes to the system browser.
// A failure says why under the button in the taxonomy's words, and nothing is retried by itself.
// No stream and no poll (D-LIVE): a pull reads the Deliverable again.

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import type { ApiClient } from '../../api/client';
import { useAppSession } from '../../app-state/session';
import { logger } from '../../lib/logger';
import { openInBrowser } from '../open-studio';
import { useMinuteClock, usePhoneTimeZone } from '../shell/use-shell';
import { deliverableQuery } from './api';
import { deliverableDetailView, openFailureMessage, reportTarget, type DetailBody } from './detail';
import { authenticatedRequest } from './file-source';
import { openInSystemViewer, ViewerError } from './open-file';

/** The Deliverable, its page and what 'Report this' would file (null when the gate says no). */
export function useDeliverablePage(id: string) {
  const { client, workspace, discovery } = useAppSession();
  const query = useQuery(deliverableQuery(client, workspace.id, id));
  const now = useMinuteClock();
  const timeZone = usePhoneTimeZone();
  const { apiUrl, webUrl } = client.server;
  const data = query.data;
  const view = useMemo(
    () => (data ? deliverableDetailView(data, { clock: { now, timeZone }, apiUrl, webUrl }) : null),
    [data, now, timeZone, apiUrl, webUrl],
  );
  const role = workspace.role;
  return { query, view, report: reportTarget(id, discovery, role), client, discovery, role };
}

export type ViewerBody = Extract<DetailBody, { readonly kind: 'viewer' }>;

async function openBody(client: ApiClient, body: ViewerBody, title: string): Promise<void> {
  if (body.link.kind === 'external') {
    if (await openInBrowser(body.link.url)) return;
    throw new ViewerError(new Error('the system browser did not open the link'));
  }
  const request = await authenticatedRequest(client, body.link);
  await openInSystemViewer({ request, fileName: body.fileName, title });
}

export type SystemViewer = {
  readonly busy: boolean;
  /** Why the last press did not open the file, or null. */
  readonly failure: string | null;
  readonly open: () => void;
};

export function useSystemViewer(body: ViewerBody, title: string): SystemViewer {
  const { client } = useAppSession();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const open = useCallback(() => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    openBody(client, body, title)
      .catch((error: unknown) => {
        logger.warn('[cc/deliverables] the file did not open', error);
        setFailure(openFailureMessage(error));
      })
      .finally(() => setBusy(false));
  }, [busy, client, body, title]);
  return { busy, failure, open };
}
