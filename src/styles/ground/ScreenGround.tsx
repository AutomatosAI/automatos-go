// The ground a Screen stands on (ground.ts): useGroundPlan reads the subtree's style and dress
// once; ScreenGround draws the part under the content (Play's glow, HUD's glow and grid, Arcade's
// and Candy's page) and ScreenOverlay the part over it (HUD's scanlines; Arcade draws nothing over
// the content, its scanlines are inside its windows, and nor does Candy). Studio draws neither:
// its ground is the Screen's own background colour.

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MascotName } from '../../core/frozen/lib/mascot/types';
import { useDress } from '../dress/use-dress';
import { useStyle } from '../theme';
import { groundPlan, type GroundPlan } from './ground';
import { HudOverlay } from './HudOverlay';
import { PlayGlow } from './PlayGlow';
import type { ScreenKind } from './spots';

export function useGroundPlan(kind: ScreenKind, state: MascotName): GroundPlan {
  const style = useStyle();
  const { ground } = useDress();
  return useMemo(() => groundPlan({ style, ground, kind, state }), [style, ground, kind, state]);
}

/** A palette's flat page colour under the content, hidden from accessibility. */
function FlatPage({ page }: { readonly page: string }) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: page }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Arcade's page and Candy's (on a shared screen) are each the palette's page colour, flat. */
const ArcadePage = FlatPage;
const CandyPage = FlatPage;

export function ScreenGround({ plan }: { readonly plan: GroundPlan }) {
  if (plan.kind === 'play-glow') return <PlayGlow plan={plan.plan} />;
  if (plan.kind === 'hud-grid') return <HudOverlay plan={plan.plan} layer="ground" />;
  if (plan.kind === 'arcade-page') return <ArcadePage page={plan.page} />;
  if (plan.kind === 'candy-page') return <CandyPage page={plan.page} />;
  return null;
}

export function ScreenOverlay({ plan }: { readonly plan: GroundPlan }) {
  if (plan.kind === 'hud-grid') return <HudOverlay plan={plan.plan} layer="scanlines" />;
  return null;
}
