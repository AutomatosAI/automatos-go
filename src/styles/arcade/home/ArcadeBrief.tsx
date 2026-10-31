// The day's brief on Arcade's handheld (PRD-268 §6.12.5, US-G06; D-ARC-7): OPEN BRIEF, under the
// dialogue's words and in the story's brief window, opens the whole brief in the foundation's Sheet.
// The sheet's content is the brief's own view (BriefCard.tsx BriefBody over use-brief-view.ts: the
// date, the greeting, Auto's Read, the sections with their counts, rows, actions and 'Show N more'),
// framed by an Arcade window and dressed by the style's primitives, so whatever the brief's view
// gains reaches Arcade unchanged. A row's action closes the sheet, then opens where the row goes
// (as HUD's sheet does). The brief stays in the sheet while it slides away.

import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { BriefBody } from '../../../brief/BriefCard';
import type { Brief } from '../../../brief/schema';
import { useFollowLink } from '../../../chat/components/follow-link';
import type { WebLinkTarget } from '../../../navigation/web-links';
import { Sheet } from '../../../ui';
import { ArcadeWindow } from '../parts/ArcadeWindow';

/** The window's padding around the brief's view. */
const BRIEF_SHEET = Object.freeze({ pad: 14 });

export type ArcadeBriefSheet = {
  /** OPEN BRIEF: shows this brief in the sheet. */
  readonly open: (brief: Brief) => void;
  /** The sheet, mounted beside the home's other sheets. */
  readonly sheet: ReactNode;
};

export function useArcadeBriefSheet(): ArcadeBriefSheet {
  const follow = useFollowLink();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [visible, setVisible] = useState(false);
  const open = useCallback((shown: Brief) => {
    setBrief(shown);
    setVisible(true);
  }, []);
  const close = useCallback(() => setVisible(false), []);
  const onLink = useCallback(
    (target: WebLinkTarget) => {
      close();
      follow(target);
    },
    [close, follow],
  );
  const sheet = (
    <Sheet visible={visible && brief !== null} onClose={close}>
      {brief ? (
        <ArcadeWindow contentStyle={styles.window}>
          <BriefBody brief={brief} onLink={onLink} />
        </ArcadeWindow>
      ) : null}
    </Sheet>
  );
  return { open, sheet };
}

const styles = StyleSheet.create({
  window: { padding: BRIEF_SHEET.pad },
});
