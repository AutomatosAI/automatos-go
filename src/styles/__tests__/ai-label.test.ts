import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  AI_LABEL_PAUSED_TEXT as VENDORED_PAUSED_TEXT,
  UNNAMED_AGENT,
} from '../../core/web/lib/ai-label/copy';
import {
  AI_LABEL_PAUSED_TEXT,
  EDGE_TOLERANCE,
  MIN_LABEL_SIZE,
  aiLabelHiddenReason,
  aiLabelVisibilityReducer,
  aiLabelWords,
  initialAiLabelVisibility,
  type AiLabelVisibility,
  type LabelBox,
} from '../ai-label-state';

const WINDOW = { width: 402, height: 874 };
const BESIDE_COMPOSER: LabelBox = { x: 14, y: 790, width: 96, height: 20 };

describe('the AI label words', () => {
  it('says Auto is an AI when no other agent answers', () => {
    expect(aiLabelWords(null)).toBe('Auto is an AI');
    expect(aiLabelWords(undefined)).toBe('Auto is an AI');
  });

  it("says the picked agent's name", () => {
    expect(aiLabelWords({ name: 'Relay' })).toBe('Relay is an AI');
    expect(aiLabelWords({ name: '  Scout  ' })).toBe('Scout is an AI');
  });

  it('still says an unnamed agent is an AI', () => {
    expect(UNNAMED_AGENT).toBe('This agent');
    for (const name of [undefined, null, '', '   ']) {
      expect(aiLabelWords({ name })).toBe('This agent is an AI');
    }
  });

  it("pauses the composer with the web's own words", () => {
    expect(AI_LABEL_PAUSED_TEXT).toBe(VENDORED_PAUSED_TEXT);
  });
});

describe('aiLabelHiddenReason', () => {
  it('sees a label laid out inside the window', () => {
    expect(aiLabelHiddenReason(BESIDE_COMPOSER, WINDOW)).toBeNull();
  });

  it('is hidden before it is laid out, or when it is not measurable', () => {
    expect(aiLabelHiddenReason(null, WINDOW)).toBe('detached');
    expect(aiLabelHiddenReason({ ...BESIDE_COMPOSER, x: Number.NaN }, WINDOW)).toBe('detached');
  });

  it('is hidden when shrunk below a readable size', () => {
    expect(aiLabelHiddenReason({ ...BESIDE_COMPOSER, height: 0 }, WINDOW)).toBe('size');
    expect(aiLabelHiddenReason({ ...BESIDE_COMPOSER, width: MIN_LABEL_SIZE - 1 }, WINDOW)).toBe(
      'size',
    );
    expect(
      aiLabelHiddenReason(
        { ...BESIDE_COMPOSER, width: MIN_LABEL_SIZE, height: MIN_LABEL_SIZE },
        WINDOW,
      ),
    ).toBeNull();
  });

  it('is hidden when any part lies outside the window', () => {
    const below = { ...BESIDE_COMPOSER, y: WINDOW.height - 10 };
    const left = { ...BESIDE_COMPOSER, x: -20 };
    const right = { ...BESIDE_COMPOSER, x: WINDOW.width - 50 };
    const above = { ...BESIDE_COMPOSER, y: -BESIDE_COMPOSER.height };
    for (const box of [below, left, right, above]) {
      expect(aiLabelHiddenReason(box, WINDOW)).toBe('window');
    }
  });

  it('forgives a point of rounding at the edge', () => {
    const flush = {
      ...BESIDE_COMPOSER,
      y: WINDOW.height - BESIDE_COMPOSER.height + EDGE_TOLERANCE,
    };
    expect(aiLabelHiddenReason(flush, WINDOW)).toBeNull();
    expect(aiLabelHiddenReason({ ...flush, y: flush.y + 1 }, WINDOW)).toBe('window');
    expect(aiLabelHiddenReason({ ...BESIDE_COMPOSER, x: -EDGE_TOLERANCE }, WINDOW)).toBeNull();
  });
});

describe('the visibility reducer', () => {
  const start = initialAiLabelVisibility(WINDOW);

  it('starts hidden, so the composer waits for the first measurement', () => {
    expect(start).toEqual({ box: null, window: WINDOW, visible: false });
  });

  it('turns visible on a layout inside the window', () => {
    const laidOut = aiLabelVisibilityReducer(start, { type: 'layout', box: BESIDE_COMPOSER });
    expect(laidOut.visible).toBe(true);
    expect(laidOut.box).toEqual(BESIDE_COMPOSER);
  });

  it('re-checks the last box when the window changes (rotation, split view)', () => {
    const laidOut = aiLabelVisibilityReducer(start, { type: 'layout', box: BESIDE_COMPOSER });
    const shorter = aiLabelVisibilityReducer(laidOut, {
      type: 'window',
      window: { width: 874, height: 402 },
    });
    expect(shorter.visible).toBe(false);
    const back = aiLabelVisibilityReducer(shorter, { type: 'window', window: WINDOW });
    expect(back.visible).toBe(true);
  });

  it('turns hidden when the label is pushed off screen or detached', () => {
    const laidOut = aiLabelVisibilityReducer(start, { type: 'layout', box: BESIDE_COMPOSER });
    const pushed = aiLabelVisibilityReducer(laidOut, {
      type: 'layout',
      box: { ...BESIDE_COMPOSER, y: WINDOW.height + 40 },
    });
    expect(pushed.visible).toBe(false);
    expect(aiLabelVisibilityReducer(laidOut, { type: 'detach' })).toEqual(start);
  });

  it('returns new state and leaves the old one alone', () => {
    const frozen: AiLabelVisibility = Object.freeze({ ...start });
    const next = aiLabelVisibilityReducer(frozen, { type: 'layout', box: BESIDE_COMPOSER });
    expect(next).not.toBe(frozen);
    expect(frozen.visible).toBe(false);
  });
});

describe('ai-label.tsx keeps its colours fixed', () => {
  const source = readFileSync(path.resolve(__dirname, '..', 'ai-label.tsx'), 'utf8');

  it('reads no tokens, theme, look or style', () => {
    expect(source).not.toMatch(/from '\.\/(tokens|theme|theme-choice)'/);
    expect(source).not.toMatch(/useTokens|useTheme|looks?\//);
  });

  it('defines its own colours and paints only with them', () => {
    expect(source).toMatch(/export const AI_LABEL_COLOURS = Object\.freeze\(\{/);
    const colourProps = source.match(/(color|borderColor|backgroundColor): [^,}\n]+/g) ?? [];
    expect(colourProps.length).toBeGreaterThan(0);
    for (const prop of colourProps) expect(prop.trim()).toMatch(/AI_LABEL_COLOURS\.\w+$/);
  });

  it('says the same words to VoiceOver as on screen, as text', () => {
    expect(source).toContain('accessibilityRole="text"');
    expect(source).toContain('accessibilityLabel={words}');
  });

  it('keeps Dynamic Type on', () => {
    expect(source).not.toMatch(/allowFontScaling=\{false\}|maxFontSizeMultiplier/);
    expect(source.match(/\{\.\.\.TEXT_SCALING\}/g)).toHaveLength(2);
  });
});
