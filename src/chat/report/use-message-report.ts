// Report this on one thread's Auto messages (US-009c): the session's gate (the foundation's
// canReport: the server lists report_content and the role may report) and the target of the one
// ReportSheet the thread mounts. It only wires: which message offers it is report.ts; the sheet,
// its draft and its POST are the foundation's.

import { useCallback, useMemo, useState } from 'react';

import type { ReportTarget } from '../../api/reports';
import { useAppSession } from '../../app-state/session';
import type { ReportSheetProps } from '../../ui';
import { canReport } from '../../ui/report';
import type { ThreadReport } from './report';

export type MessageReport = {
  readonly report: ThreadReport;
  /** The ReportSheet's props: closed (target null) until a message is chosen, and while gated. */
  readonly sheet: ReportSheetProps;
};

export function useMessageReport(): MessageReport {
  const { client, discovery, workspace } = useAppSession();
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const close = useCallback(() => setTarget(null), []);
  const allowed = canReport(discovery, workspace.role);
  const report = useMemo<ThreadReport>(() => ({ allowed, open: setTarget }), [allowed]);
  return {
    report,
    sheet: {
      target: allowed ? target : null,
      onClose: close,
      client,
      discovery,
      role: workspace.role,
    },
  };
}
