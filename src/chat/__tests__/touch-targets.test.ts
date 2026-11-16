// The thread's small targets on the phone, read from source (vitest runs in node with no React
// renderer, and these files load React Native): an attachment chip's 30 pt remove button takes a
// 44 pt touch without the chip changing (the chip passes its slop, the row makes room for it); a
// receipt's link reaches toward 44 pt without reaching a link beside it; the Mission card's 'Filed'
// link is padded toward 44 pt with the padding taken back. touchRoom and stackedSlop are
// src/ui/__tests__/paint.test.ts's.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { STYLE_CONTROLS } from '../../styles/tokens/controls';
import { MIN_TOUCH, hitSlopFor } from '../../ui/paint';

const CHAT = path.resolve(__dirname, '..');
/** The code alone: comments stripped. */
const code = (file: string) =>
  readFileSync(path.join(CHAT, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('an attachment chip’s remove button', () => {
  const chips = code('attachments/AttachmentChips.tsx');

  it('stays the 30 pt button in every style, reaching 44 with its slop', () => {
    expect(chips).toMatch(/const REMOVE_SIZE = 'sm';/);
    expect(chips).toMatch(/useStyle\(\)\.controls\.iconButton\[REMOVE_SIZE\]\.box/);
    for (const controls of Object.values(STYLE_CONTROLS)) {
      const { box } = controls.iconButton.sm;
      expect(box).toBe(30);
      expect(box + 2 * hitSlopFor(box, box).top).toBe(MIN_TOUCH);
      expect(box + 2 * hitSlopFor(box, box).left).toBe(MIN_TOUCH);
    }
  });

  it('is reached through the chip above, below and after it, never before it', () => {
    expect(chips).toMatch(/const slop = hitSlopFor\(box, box\);/);
    expect(chips).toMatch(/chip: \{ \.\.\.slop, left: 0 \}/);
    expect(chips).toMatch(/<View\s+hitSlop=\{chipSlop\}/);
    expect(chips).toMatch(/chipSlop=\{room\.chip\}/);
  });

  it('has room in the row: padded to 44, the padding taken back, the last slop kept', () => {
    expect(chips).toMatch(/row: touchRoom\(box\)/);
    expect(chips).toMatch(/style=\{\{ marginVertical: room\.row\.marginVertical \}\}/);
    expect(chips).toMatch(/paddingVertical: room\.row\.paddingVertical,/);
    expect(chips).toMatch(/paddingRight: room\.slop\.right,/);
  });
});

describe('a receipt’s link', () => {
  const receipts = code('components/ReceiptsCard.tsx');

  it('takes stackedSlop: toward 44 pt, half the gap toward a link beside it', () => {
    expect(receipts).toMatch(/hitSlop=\{slop\}/);
    expect(receipts).toMatch(/stackedSlop\(type\[LINE_ROLE\]\.lineHeight, gap, \{/);
    expect(receipts).toMatch(/above: Boolean\(lines\[index - 1\]\?\.link\),/);
    expect(receipts).toMatch(/below: Boolean\(lines\[index \+ 1\]\?\.link\),/);
  });
});

describe('the Mission card’s Filed link', () => {
  it('is padded toward 44 pt with the padding taken back', () => {
    const card = code('cards/MissionSuggestionCard.tsx');
    expect(card).toMatch(/style=\{touchRoom\(type\.label\.lineHeight\)\}/);
  });
});
