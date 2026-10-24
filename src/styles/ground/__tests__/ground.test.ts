// The ground a Screen stands on per style, and the Screen primitive's order, read from its source
// (vitest runs no React Native renderer): the ground under the content, the scanlines over it, the
// status bar in the style's tone.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { dressOf } from '../../dress/dress';
import { HUD, HUD_STYLES, PLAY, PLAY_STYLES, STUDIO_STYLES } from '../../dress/__tests__/fixtures';
import type { ResolvedStyle } from '../../provider/resolve';
import { groundPlan, statusBarStyle } from '../ground';

function planFor(style: ResolvedStyle, kind: Parameters<typeof groundPlan>[0]['kind'] = 'page') {
  return groundPlan({ style, ground: dressOf(style).ground, kind, state: 'idle' });
}

describe('groundPlan', () => {
  it('leaves Studio and an installed theme on their plain background', () => {
    for (const style of STUDIO_STYLES) expect(planFor(style)).toEqual({ kind: 'plain' });
  });

  it("gives every Play look its page glow, and none where Ember's phone draws none", () => {
    for (const style of PLAY_STYLES) {
      const plan = planFor(style);
      expect(plan.kind).toBe('play-glow');
      if (plan.kind === 'play-glow') expect(plan.plan?.spot.alpha).toBe(0.16);
    }
    expect(planFor(PLAY, 'conversations')).toEqual({ kind: 'play-glow', plan: null });
  });

  it('gives every HUD look its glow, grid and scanlines on every screen', () => {
    for (const style of HUD_STYLES) expect(planFor(style).kind).toBe('hud-grid');
    expect(planFor(HUD, 'chat')).toEqual(planFor(HUD, 'lost'));
  });

  it('stops the glow crossfade under Reduce Motion', () => {
    const still = { ...PLAY, motion: { loops: false, reason: 'reduce-motion' } } as const;
    const plan = planFor(still, 'chat');
    expect(plan.kind === 'play-glow' && plan.plan?.fadeMs).toBe(0);
  });

  it('falls back to plain if a dress and a style ever disagree', () => {
    const studio = STUDIO_STYLES[0];
    expect(groundPlan({ style: studio, ground: 'play-glow', kind: 'page', state: 'idle' })).toEqual({
      kind: 'plain',
    });
  });
});

describe('statusBarStyle', () => {
  it('writes light on a dark tone and dark on a light one', () => {
    expect(statusBarStyle('dark')).toBe('light');
    expect(statusBarStyle('light')).toBe('dark');
  });

  it('follows each style: HUD always light, Play by its ground', () => {
    for (const style of HUD_STYLES) expect(statusBarStyle(style.tone)).toBe('light');
    const daylight = PLAY_STYLES.find((style) => style.playLook?.id === 'daylight');
    expect(daylight && statusBarStyle(daylight.tone)).toBe('dark');
  });
});

describe('the Screen primitive', () => {
  const source = readFileSync(path.resolve(__dirname, '../../../ui/Screen.tsx'), 'utf8');

  it('sets the status bar to the tone, then the ground, the content and the scanlines', () => {
    const order = [
      '<StatusBar style={statusBarStyle(tone)} />',
      '<ScreenGround plan={plan} />',
      '<SafeAreaView',
      '<ScreenOverlay plan={plan} />',
    ].map((part) => source.indexOf(part));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("keeps every prop it had and adds the screen's kind and Auto's state", () => {
    for (const prop of ['children', 'edges?', 'scroll?', 'padding?', 'style?', 'ground?', 'autoState?']) {
      expect(source).toContain(`readonly ${prop}:`);
    }
  });
});
