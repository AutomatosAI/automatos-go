// Play's message box on a 375 pt phone, read from source (vitest runs in node with no React
// renderer, and PlayComposer loads React Native): Send is a 42 pt round icon button in Play's paint
// (lucide's arrow up), as Studio's composer and the voice button beside it, named 'Send' to
// VoiceOver; Stop is the same circle with Play's 10 x 10 square, named 'Stop' with its hint. No word
// is drawn in the button, so the field keeps its width. The paint is paint.test.ts's.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ICON_BUTTON_SIZES } from '../../../../ui/variants';
import { COMPANION, composerView, draftComposerState } from '../model';

const source = readFileSync(path.resolve(__dirname, '..', 'PlayComposer.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const button = source.match(/function ComposerButton[\s\S]*?\n}/)?.[0] ?? '';

describe("Play's send button", () => {
  it('is 42 pt, as Studio’s send and the voice button', () => {
    expect(COMPANION.composer.button).toBe(ICON_BUTTON_SIZES.lg.box);
    expect(COMPANION.composer.button).toBe(42);
    expect(COMPANION.composer.icon).toBe(ICON_BUTTON_SIZES.lg.icon);
  });

  it('is a circle in Play’s paint, with the arrow up to send and the square to stop', () => {
    expect(button).toMatch(/width: composer\.button,\s*height: composer\.button,/);
    expect(button).toMatch(/borderRadius: paint\.style\.radii\.full,/);
    expect(button).toMatch(/backgroundColor: fill,/);
    expect(button).toMatch(
      /<ArrowUp size=\{composer\.icon\} color=\{ink\} strokeWidth=\{ICON_STROKE\} \/>/,
    );
    expect(button).toMatch(/width: composer\.square,[\s\S]*?backgroundColor: ink,/);
    expect(source).toMatch(/from 'lucide-react-native\/icons\/arrow-up'/);
  });

  it('draws no word: VoiceOver hears Send, or Stop with its hint', () => {
    expect(button).not.toMatch(/<Text\b/);
    expect(button).toMatch(/accessibilityLabel=\{view\.label\}/);
    expect(button).toMatch(/accessibilityHint=\{view\.hint\}/);
    expect(composerView(draftComposerState('Hi')).label).toBe('Send');
    const stop = composerView({ buttonMode: 'stop', inputEditable: true });
    expect([stop.label, stop.square]).toEqual(['Stop', true]);
  });

  it('reaches 44 pt with its slop', () => {
    expect(source).toMatch(/const BUTTON_SLOP = hitSlopFor\(composer\.button, composer\.button\);/);
    expect(button).toMatch(/hitSlop=\{BUTTON_SLOP\}/);
  });
});
