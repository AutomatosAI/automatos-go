// The composer's AI label check (D-AI-LABEL), over the foundation's useAiLabelVisible. That hook
// reads false both before its first measurement and when the label is hidden, so a composer gated on
// it alone would flash the paused alert on every screen it opens (the web checks on mount, at once).
// This adapter adds `checked`: true while the label is seen, and for good from LABEL_SETTLE_MS after
// its first layout; until then composerState holds the composer off without a notice.
// FOUNDATION GAP: useAiLabelVisible (src/styles/ai-label.tsx) does not say whether it has measured.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { useAiLabelVisible, type AiLabelTracking } from '../../styles/ai-label';
import { LABEL_SETTLE_MS } from './composer-state';

export type LabelFence = {
  readonly visible: boolean;
  /** The first measurement is in (or should have been): a hidden label is now really hidden. */
  readonly checked: boolean;
  /** Pass straight to AiLabel's `track`. */
  readonly track: AiLabelTracking;
};

export function useLabelFence(): LabelFence {
  const label = useAiLabelVisible();
  const { ref, onLayout } = label.track;
  const [laidOut, setLaidOut] = useState(false);
  const [settled, setSettled] = useState(false);
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayout(event);
      setLaidOut(true);
    },
    [onLayout],
  );
  useEffect(() => {
    if (!laidOut) return undefined;
    const timer = setTimeout(() => setSettled(true), LABEL_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [laidOut]);
  const track = useMemo(() => ({ ref, onLayout: handleLayout }), [ref, handleLayout]);
  return { visible: label.visible, checked: settled || label.visible, track };
}
