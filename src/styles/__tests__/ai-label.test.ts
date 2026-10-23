// The AI label (D-AI-LABEL, D73, Gerard 23 Oct on build 7: "if required make it bloody small"): the
// vendored words; one muted caption line at the scale's smallest body size, read from the tokens
// and readable on every built-in style, Light and Dark (WCAG AA, the vendored contrastRatio); no
// pill, box or measuring left in ai-label.tsx; the thread opens with it, and the composer holds
// nothing for it (read from the source: vitest runs no React Native renderer).

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { UNNAMED_AGENT } from '../../core/web/lib/ai-label/copy';
import { AA_TEXT, contrastRatio } from '../../core/web/lib/look-kit/contrast';
import { AI_LABEL_TONE, AI_LABEL_TYPE, aiLabelWords } from '../ai-label-state';
import { STYLE_IDS, tokensFor, type ColourScheme } from '../tokens';
import { MIN_TEXT_SIZE, TYPE_SPECS } from '../type';

const ROOT = path.resolve(__dirname, '../../..');
const read = (relative: string) => readFileSync(path.join(ROOT, relative), 'utf8');
const SCHEMES: readonly ColourScheme[] = ['light', 'dark'];
const BODIES = ['body1', 'body2', 'body3', 'body4', 'body5', 'body6'] as const;

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

  it('keeps only the words, the face and the tone (no visibility rules, no paused words)', async () => {
    expect(Object.keys(await import('../ai-label-state')).sort()).toEqual([
      'AI_LABEL_TONE',
      'AI_LABEL_TYPE',
      'aiLabelWords',
    ]);
  });
});

describe('the AI label is small (D73)', () => {
  it('is Body 6, the smallest body size, still above the 11 pt floor', () => {
    expect(AI_LABEL_TYPE).toBe('body6');
    const spec = TYPE_SPECS[AI_LABEL_TYPE];
    expect(spec.size).toBe(11.5);
    expect(spec.size).toBe(Math.min(...BODIES.map((role) => TYPE_SPECS[role].size)));
    expect(spec.size).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
    expect(spec.family).toBe('sans');
    expect(spec.uppercase).toBeFalsy();
  });

  const LOOKS = STYLE_IDS.flatMap((style) => SCHEMES.map((scheme) => [style, scheme] as const));

  it('checks every built-in style, Studio included', () => {
    expect(STYLE_IDS).toContain('studio');
    expect(LOOKS).toHaveLength(STYLE_IDS.length * SCHEMES.length);
  });

  it.each(LOOKS)('reads at WCAG AA on the background in %s %s', (style, scheme) => {
    const { colours } = tokensFor(style, scheme);
    expect(contrastRatio(colours[AI_LABEL_TONE], colours.background)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });
});

describe('ai-label.tsx is one caption line', () => {
  const source = read('src/styles/ai-label.tsx');

  it('draws no pill, box or colour of its own, and measures nothing', () => {
    expect(source).not.toMatch(
      /AI_LABEL_COLOURS|#[0-9A-Fa-f]{3,8}\b|backgroundColor|borderWidth|borderRadius|measureInWindow|onLayout|useAiLabelVisible|AiLabelPaused/,
    );
    expect(source).toContain('colours[AI_LABEL_TONE]');
    expect(source).toContain('type[AI_LABEL_TYPE]');
    expect(source.match(/^export function /gm)).toHaveLength(1);
  });

  it('says the same words to VoiceOver as on screen, as text', () => {
    expect(source).toContain('accessibilityRole="text"');
    expect(source).toContain('accessibilityLabel={words}');
  });

  it('keeps Dynamic Type on', () => {
    expect(source).not.toMatch(/allowFontScaling=\{false\}|maxFontSizeMultiplier/);
    expect(source.match(/\{\.\.\.TEXT_SCALING\}/g)).toHaveLength(1);
  });
});

describe('where the AI label sits', () => {
  it('opens every thread, as the list’s first row', () => {
    const list = read('src/chat/components/MessageList.tsx');
    expect(list).toContain('ListHeaderComponent={ThreadCaption}');
    expect(list).toContain('<AiLabel />');
  });

  it('is gone from the composer, and so is its fence', () => {
    expect(read('src/chat/composer/Composer.tsx')).not.toMatch(/AiLabel/);
    expect(existsSync(path.join(ROOT, 'src/chat/composer/use-label-fence.ts'))).toBe(false);
  });
});
