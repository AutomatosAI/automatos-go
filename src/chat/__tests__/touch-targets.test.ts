// The thread's small targets on the phone, read from source (vitest runs in node with no React
// renderer, and these files load React Native): an attachment chip's 30 pt remove button takes a
// 44 pt touch without the chip changing (the chip passes its slop, the row makes room for it).
// touchRoom is src/ui/__tests__/paint.test.ts's.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MIN_TOUCH, hitSlopFor } from '../../ui/paint';
import { ICON_BUTTON_SIZES } from '../../ui/variants';

const CHAT = path.resolve(__dirname, '..');
/** The code alone: comments stripped. */
const code = (file: string) =>
  readFileSync(path.join(CHAT, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('an attachment chip’s remove button', () => {
  const chips = code('attachments/AttachmentChips.tsx');

  it('stays the 30 pt button, reaching 44 with its slop', () => {
    const { box } = ICON_BUTTON_SIZES.sm;
    expect(chips).toMatch(/const REMOVE_SIZE = 'sm';/);
    expect(box + 2 * hitSlopFor(box, box).top).toBe(MIN_TOUCH);
    expect(box + 2 * hitSlopFor(box, box).left).toBe(MIN_TOUCH);
  });

  it('is reached through the chip above, below and after it, never before it', () => {
    expect(chips).toMatch(/const CHIP_SLOP = Object\.freeze\(\{ \.\.\.REMOVE_SLOP, left: 0 \}\);/);
    expect(chips).toMatch(/<View\s+hitSlop=\{CHIP_SLOP\}/);
  });

  it('has room in the row: padded to 44, the padding taken back, the last slop kept', () => {
    expect(chips).toMatch(/const ROW_ROOM = touchRoom\(REMOVE_BOX\);/);
    expect(chips).toMatch(/style=\{\{ marginVertical: ROW_ROOM\.marginVertical \}\}/);
    expect(chips).toMatch(/paddingVertical: ROW_ROOM\.paddingVertical,/);
    expect(chips).toMatch(/paddingRight: REMOVE_SLOP\.right,/);
  });
});
