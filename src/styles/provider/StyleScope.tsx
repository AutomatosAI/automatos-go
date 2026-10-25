// A style for one subtree (PRD-001 §4.6): <StyleScope choice look> resolves its own ResolvedStyle
// from the app's inputs with this choice and, when given, this look — the picker's preview cards
// (US-016h) and the look pages' live previews (US-017e, US-018c) — so useStyle(), useLayout() and
// useTokens() inside it paint that style. The stored choice and looks are never touched.

import { useMemo, type ReactNode } from 'react';

import type { Look } from '../../core/web/lib/looks/types';
import type { HudLook } from '../hud/look-schema';
import type { StyleChoice } from '../registry/style-id';
import { StyleContext, useStyleRoot } from './context';
import { resolveStyle, scopeInput } from './resolve';

type StyleScopeProps = {
  readonly choice: StyleChoice;
  /** A Play look for Play, a HUD look for HUD; the phone's own look when omitted. */
  readonly look?: Look | HudLook;
  readonly children: ReactNode;
};

export function StyleScope({ choice, look, children }: StyleScopeProps) {
  const { input } = useStyleRoot();
  const style = useMemo(() => resolveStyle(scopeInput(input, choice, look)), [input, choice, look]);
  return <StyleContext.Provider value={style}>{children}</StyleContext.Provider>;
}
