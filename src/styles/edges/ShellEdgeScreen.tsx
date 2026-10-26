// The gate's edge screens, handed in (US-016j), as ShellStyleSync hands in StyleSync: the root
// layout (app/_layout.tsx) puts GateEdge in EdgeScreenSlot, and the signed-in layout
// (app/(app)/_layout.tsx) gives ShellEdgeScreen to the gate as its `edge`
// (src/app-state/AppGate.tsx), so the gate's 'error' and 'not_running' are the style's edge
// screens. The signed-in layout imports only this file, which loads React and nothing native: the
// connect kit's shell test (src/app-state/__tests__/shell-bar.test.ts) renders the real layout and
// gate in node over a fixed set of mocks, and the edge screens' chain (the style store, Skia,
// expo-video) cannot load there. With no slot above it, ShellEdgeScreen shows the gate's own state
// (`fallback`).

import { createContext, useContext, type ComponentType, type ReactNode } from 'react';

import type { GateEdgeProps } from '../../app-state/AppGate';

const SlotContext = createContext<ComponentType<GateEdgeProps> | null>(null);

type EdgeScreenSlotProps = {
  /** The component that draws the gate's error and Not running: GateEdge. */
  readonly edge: ComponentType<GateEdgeProps>;
  readonly children?: ReactNode;
};

export function EdgeScreenSlot({ edge, children }: EdgeScreenSlotProps) {
  return <SlotContext.Provider value={edge}>{children}</SlotContext.Provider>;
}

/** The slot's edge screen for the gate's state, or the gate's own state with no slot. */
export function ShellEdgeScreen(props: GateEdgeProps) {
  const Edge = useContext(SlotContext);
  return Edge ? <Edge {...props} /> : <>{props.fallback}</>;
}
