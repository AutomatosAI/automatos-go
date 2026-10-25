// The ground a Screen stands on (ground.ts): useGroundPlan reads the subtree's style and dress
// once; ScreenGround draws the part under the content (Play's glow, HUD's glow and grid) and
// ScreenOverlay the part over it (HUD's scanlines). Studio draws neither: its ground is the
// Screen's own background colour.

import { useMemo } from 'react';

import type { MascotName } from '../../core/web/lib/mascot/types';
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

export function ScreenGround({ plan }: { readonly plan: GroundPlan }) {
  if (plan.kind === 'play-glow') return <PlayGlow plan={plan.plan} />;
  if (plan.kind === 'hud-grid') return <HudOverlay plan={plan.plan} layer="ground" />;
  return null;
}

export function ScreenOverlay({ plan }: { readonly plan: GroundPlan }) {
  if (plan.kind === 'hud-grid') return <HudOverlay plan={plan.plan} layer="scanlines" />;
  return null;
}
