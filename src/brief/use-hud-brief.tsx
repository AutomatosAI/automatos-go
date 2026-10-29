// HUD's brief, wired (US-G06): while discovery lists `brief` and the day's brief is the newest
// message with no turn live (hud-turn.ts hudBrief), the transcript slot shows it with OPEN BRIEF,
// and the sheet opens on it. Otherwise nothing changes on HUD's home.

import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { canBrief } from '../api/capabilities';
import { useAppSession } from '../app-state/session';
import { useFollowLink } from '../chat/components/follow-link';
import type { ThreadState } from '../chat/controller/thread';
import { hudBrief, plainText } from '../styles/homes/hud-turn';
import { HudBriefSheet, HudBriefSlot } from './HudBrief';

export type HudBrief = {
  /** The transcript's slot while the brief shows; undefined otherwise. */
  readonly slot: ReactNode | undefined;
  /** OPEN BRIEF's sheet, mounted beside HUD's other sheets. */
  readonly sheet: ReactNode;
};

export function useHudBrief(state: ThreadState): HudBrief {
  const offered = canBrief(useAppSession().discovery);
  const follow = useFollowLink();
  const [open, setOpen] = useState(false);
  const brief = useMemo(() => (offered ? hudBrief(state) : null), [offered, state]);
  const words = useMemo(() => (brief ? plainText(brief.prose) : ''), [brief]);
  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const slot = brief ? (
    <HudBriefSlot greeting={brief.greeting.trim()} words={words} onOpen={show} />
  ) : undefined;
  const sheet = <HudBriefSheet brief={brief} visible={open} onClose={close} onLink={follow} />;
  return { slot, sheet };
}
