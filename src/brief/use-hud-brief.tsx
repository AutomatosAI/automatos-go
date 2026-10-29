// HUD's brief, wired (US-G06): while discovery lists `brief` and today's brief (the phone's local
// date) is the newest message with no turn live (hud-turn.ts hudBrief), the transcript slot shows it
// with OPEN BRIEF, and the sheet opens on it; the slot keeps Report this on the brief's message
// where the thread offers it. Otherwise nothing changes on HUD's home.

import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { canBrief } from '../api/capabilities';
import { useAppSession } from '../app-state/session';
import { usePhoneTimeZone } from '../cc/shell/use-shell';
import { useFollowLink } from '../chat/components/follow-link';
import type { ThreadState } from '../chat/controller/thread';
import type { ThreadReport } from '../chat/report/report';
import { hudBrief, plainText, reportableId } from '../styles/homes/hud-turn';
import { HudBriefSheet, HudBriefSlot } from './HudBrief';
import { localDateIn } from './on-open';

export type HudBrief = {
  /** The transcript's slot while the brief shows; undefined otherwise. */
  readonly slot: ReactNode | undefined;
  /** OPEN BRIEF's sheet, mounted beside HUD's other sheets. */
  readonly sheet: ReactNode;
};

/** Report this on the brief's message, where the thread offers it. */
function useReportOpener(state: ThreadState, messageId: string | null, report: ThreadReport) {
  const target = useMemo(
    () => (messageId && report.allowed ? reportableId(state, messageId) : null),
    [state, messageId, report.allowed],
  );
  const { open } = report;
  return useMemo(
    () => (target ? () => open({ target_type: 'message', target_id: target }) : undefined),
    [target, open],
  );
}

export function useHudBrief(state: ThreadState, report: ThreadReport): HudBrief {
  const offered = canBrief(useAppSession().discovery);
  const follow = useFollowLink();
  const today = localDateIn(new Date(), usePhoneTimeZone());
  const [open, setOpen] = useState(false);
  const shown = useMemo(() => (offered ? hudBrief(state, today) : null), [offered, state, today]);
  const brief = shown?.brief ?? null;
  const words = useMemo(() => (brief ? plainText(brief.prose) : ''), [brief]);
  const onReport = useReportOpener(state, shown?.messageId ?? null, report);
  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const slot = brief ? (
    <HudBriefSlot
      greeting={brief.greeting.trim()}
      words={words}
      onOpen={show}
      onReport={onReport}
    />
  ) : undefined;
  const sheet = <HudBriefSheet brief={brief} visible={open} onClose={close} onLink={follow} />;
  return { slot, sheet };
}
