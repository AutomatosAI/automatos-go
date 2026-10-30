// Is the brief card on screen? (PRD-268 §6.12.5, US-G06): Studio's needs strip shrinks to its count
// while the card is on screen, so the two never repeat each other. Home provides it around its
// thread and strip (HomeScreen); the thread's list says what it shows (MessageList's viewable rows,
// model.ts briefOnScreen) and the strip reads it. Outside the provider (the chat route, Play, HUD)
// the thread says nothing and the strip, which is home's only, never shrinks.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type BriefOnScreen = {
  readonly onScreen: boolean;
  readonly report: (onScreen: boolean) => void;
};

const BriefOnScreenContext = createContext<BriefOnScreen | null>(null);

const NOBODY_LISTENS = (): void => undefined;

export function BriefOnScreenProvider({ children }: { readonly children: ReactNode }) {
  const [onScreen, setOnScreen] = useState(false);
  const value = useMemo(() => ({ onScreen, report: setOnScreen }), [onScreen]);
  return <BriefOnScreenContext.Provider value={value}>{children}</BriefOnScreenContext.Provider>;
}

/** The strip's read: true while the thread shows the brief card. */
export function useBriefOnScreen(): boolean {
  return useContext(BriefOnScreenContext)?.onScreen ?? false;
}

/** The thread's report; a no-op outside home. */
export function useReportBriefOnScreen(): (onScreen: boolean) => void {
  return useContext(BriefOnScreenContext)?.report ?? NOBODY_LISTENS;
}
