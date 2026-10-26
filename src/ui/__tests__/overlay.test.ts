// The sheet's motion and backdrop, and the toast's placement, look and timing (overlay.ts). Colours
// are read from the tokens, never written here as literals (D-TOKENS).

import { describe, expect, it } from 'vitest';

import { tokensFor } from '../../styles/tokens';
import {
  BACKDROP_ALPHA,
  INITIAL_TOAST_STATE,
  SHEET_DURATION_MS,
  SHEET_EASING,
  SHEET_MAX_HEIGHT_RATIO,
  TOAST_DURATION_MS,
  TOAST_LOOKS,
  backdropColour,
  sheetBottomPadding,
  sheetMaxHeight,
  sheetMotion,
  sheetOffset,
  sheetOpacity,
  toastPlacement,
  toastReducer,
  type ToastState,
} from '../overlay';
import { tint } from '../paint';

const light = tokensFor('studio', 'light');
const dark = tokensFor('studio', 'dark');

describe('the sheet', () => {
  it("slides up in the handoff's 220 ms ease, to at most 84 % of the window", () => {
    expect(SHEET_DURATION_MS).toBe(220);
    expect(SHEET_EASING).toEqual([0.25, 0.1, 0.25, 1]);
    expect(SHEET_MAX_HEIGHT_RATIO).toBe(0.84);
    expect(sheetMotion(false)).toEqual({ slide: true, durationMs: 220 });
  });

  it('is at most 84 % of the window while the keyboard is down', () => {
    expect(sheetMaxHeight(667, 0, 20)).toBeCloseTo(667 * 0.84, 9);
    expect(sheetMaxHeight(844, 0, 47)).toBeCloseTo(844 * 0.84, 9);
  });

  it('keeps its top on screen with the keyboard up: window less keyboard less safe top', () => {
    // 375 x 667 with the 260 pt keyboard: 387 pt between the status bar and the keyboard
    expect(sheetMaxHeight(667, 260, 20)).toBe(387);
    expect(sheetMaxHeight(844, 336, 47)).toBe(461);
    // a short sheet's cap stays its 84 %
    expect(sheetMaxHeight(1000, 50, 20)).toBeCloseTo(840, 9);
    expect(sheetMaxHeight(300, 400, 20)).toBe(0);
  });

  it('leaves the home indicator’s inset under its content only while the keyboard is down', () => {
    expect(sheetBottomPadding(16, 34, 0)).toBe(50);
    expect(sheetBottomPadding(16, 34, 291)).toBe(16);
    expect(sheetBottomPadding(16, 0, 0)).toBe(16);
  });

  it('does not slide under Reduce Motion', () => {
    expect(sheetMotion(true).slide).toBe(false);
    for (const progress of [0, 0.5, 1]) expect(sheetOffset(progress, 600, false)).toBe(0);
  });

  it('sits its full height below the window when closed and at rest when open', () => {
    expect(sheetOffset(0, 600, true)).toBe(600);
    expect(sheetOffset(0.25, 600, true)).toBe(450);
    expect(sheetOffset(1, 600, true)).toBe(0);
  });

  it('clamps progress past either end (an easing overshoot never lifts it off the bottom)', () => {
    expect(sheetOffset(-0.2, 600, true)).toBe(600);
    expect(sheetOffset(1.2, 600, true)).toBe(0);
  });

  it('stays opaque while it slides, and cross-fades under Reduce Motion', () => {
    expect(sheetOpacity(0, true)).toBe(1);
    expect(sheetOpacity(0, false)).toBe(0);
    expect(sheetOpacity(0.5, false)).toBe(0.5);
    expect(sheetOpacity(2, false)).toBe(1);
  });

  it("fades the backdrop to the handoff's ink at 34 % in both schemes", () => {
    expect(BACKDROP_ALPHA).toBe(0.34);
    // the ink, hsl(30 12% 9%): Light's foreground, Dark's background
    expect(light.colours.foreground).toBe(dark.colours.background);
    expect(backdropColour(light.colours, 'light')).toBe(tint(light.colours.foreground, 0.34));
    expect(backdropColour(dark.colours, 'dark')).toBe(tint(dark.colours.background, 0.34));
    expect(backdropColour(dark.colours, 'dark')).toBe(backdropColour(light.colours, 'light'));
  });

  it('rounds its top with the 14 pt sheet radius', () => {
    expect(light.radii.sheet).toBe(14);
  });
});

describe('the toast', () => {
  it('shows for 2.4 s', () => {
    expect(TOAST_DURATION_MS).toBe(2400);
  });

  it('sits at the top on iOS and is a bottom snackbar on Android', () => {
    expect(toastPlacement('ios')).toBe('top');
    expect(toastPlacement('android')).toBe('bottom');
    expect(toastPlacement('web')).toBe('bottom');
  });

  it('is a bordered card with the tick on iOS and an ink snackbar on Android', () => {
    expect(TOAST_LOOKS.top).toMatchObject({
      background: 'card',
      border: 'border',
      radius: 'panel',
      icon: true,
    });
    expect(TOAST_LOOKS.bottom).toMatchObject({
      background: 'primary',
      border: null,
      tone: 'inverse',
      radius: 'control',
      icon: false,
    });
    expect(light.colours.primary).toBe(light.colours.foreground);
  });

  it('insets from the safe area as the prototype does', () => {
    expect(light.spacing[TOAST_LOOKS.top.edgeInset]).toBe(4);
    expect(light.spacing[TOAST_LOOKS.top.sideInset]).toBe(14);
    expect(light.spacing[TOAST_LOOKS.bottom.edgeInset]).toBe(14);
    expect(light.spacing[TOAST_LOOKS.bottom.sideInset]).toBe(12);
  });
});

describe('toastReducer', () => {
  const shown = (state: ToastState, message: string) =>
    toastReducer(state, { type: 'show', message });

  it('shows one toast with its own id', () => {
    const state = shown(INITIAL_TOAST_STATE, 'Answered — the agent is resuming.');
    expect(state.current).toEqual({ id: 1, message: 'Answered — the agent is resuming.' });
    expect(state.nextId).toBe(2);
  });

  it('replaces the toast on screen with a newer one', () => {
    const state = shown(shown(INITIAL_TOAST_STATE, 'first'), 'second');
    expect(state.current).toEqual({ id: 2, message: 'second' });
  });

  it('clears on its own expiry, but an older timer never ends a newer toast', () => {
    const first = shown(INITIAL_TOAST_STATE, 'first');
    const second = shown(first, 'second');
    expect(toastReducer(second, { type: 'expire', id: 1 })).toBe(second);
    expect(toastReducer(second, { type: 'expire', id: 2 }).current).toBeNull();
  });

  it('dismisses what is on screen and ignores a dismiss with nothing shown', () => {
    const state = shown(INITIAL_TOAST_STATE, 'saved');
    expect(toastReducer(state, { type: 'dismiss' }).current).toBeNull();
    expect(toastReducer(INITIAL_TOAST_STATE, { type: 'dismiss' })).toBe(INITIAL_TOAST_STATE);
  });

  it('shows nothing for a blank message and trims the rest', () => {
    expect(shown(INITIAL_TOAST_STATE, '   ')).toBe(INITIAL_TOAST_STATE);
    expect(shown(INITIAL_TOAST_STATE, '  Sent  ').current?.message).toBe('Sent');
  });

  it('never changes the state it was given', () => {
    const frozen = Object.freeze(shown(INITIAL_TOAST_STATE, 'first'));
    const next = toastReducer(frozen, { type: 'expire', id: 1 });
    expect(frozen.current).not.toBeNull();
    expect(next).not.toBe(frozen);
  });
});
