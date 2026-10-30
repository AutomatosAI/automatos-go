// Report this (D15) on an Arcade line, as A2's thread offers it (AutoMessage.tsx is the reference):
// the accessible action is the same object for as long as Report this is offered and calls the
// newest onReport, so a line memoised on it is not drawn again on every frame of another reply.

import { useLayoutEffect, useMemo, useRef } from 'react';

import { reportAccessibility, type ReportAccessibility } from '../../../chat/report/report';

export function useReportActions(onReport: (() => void) | undefined): ReportAccessibility {
  const latest = useRef(onReport);
  useLayoutEffect(() => {
    latest.current = onReport;
  });
  const offered = onReport !== undefined;
  return useMemo(
    () => reportAccessibility(offered ? () => latest.current?.() : undefined),
    [offered],
  );
}
