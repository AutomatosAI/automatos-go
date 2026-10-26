// The shell's StyleSync, handed in (US-016j): the root layout (app/_layout.tsx) puts StyleSync in
// StyleSyncSlot, and the signed-in layout (app/(app)/_layout.tsx) renders ShellStyleSync beside its
// screens, after the bootstrap and the consent step, where the session's client is reachable. The
// signed-in layout imports only this file, which loads React and nothing native: the connect kit's
// shell test (src/app-state/__tests__/shell-bar.test.ts) renders the real layout in node over a
// fixed set of mocks, and StyleSync's chain (expo-file-system, MMKV, the style store) cannot load
// there. With no slot above it, ShellStyleSync renders nothing.

import { createContext, useContext, type ComponentType, type ReactNode } from 'react';

const SlotContext = createContext<ComponentType | null>(null);

type StyleSyncSlotProps = {
  /** The component the shell mounts once: StyleSync. */
  readonly sync: ComponentType;
  readonly children?: ReactNode;
};

export function StyleSyncSlot({ sync, children }: StyleSyncSlotProps) {
  return <SlotContext.Provider value={sync}>{children}</SlotContext.Provider>;
}

/** The slot's StyleSync, once for the signed-in shell. */
export function ShellStyleSync() {
  const Sync = useContext(SlotContext);
  return Sync ? <Sync /> : null;
}
