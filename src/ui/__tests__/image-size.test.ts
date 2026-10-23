// Images are sized on both sides, read from the source (vitest runs no React Native renderer).
// A bundled image's own pixel size is a default under its style; with height + aspectRatio alone
// iOS let the width win and the home header's 20 pt sail mark drew about 290 × 358 pt on a phone.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const read = (relative: string) => readFileSync(path.join(ROOT, relative), 'utf8');

/** Every .tsx under a folder, tests excluded. */
function components(dir: string): readonly string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((entry) => {
    const relative = path.join(dir, entry);
    if (entry === '__tests__') return [];
    if (statSync(path.join(ROOT, relative)).isDirectory()) return components(relative);
    return entry.endsWith('.tsx') ? [relative] : [];
  });
}

describe('images are sized on both sides', () => {
  it('no file that draws an <Image> sizes anything with aspectRatio', () => {
    const drawers = [...components('src'), ...components('app')].filter((file) =>
      /<Image\b/.test(read(file)),
    );
    expect(drawers.length).toBeGreaterThan(0);
    for (const file of drawers) {
      expect(read(file), file).not.toMatch(/aspectRatio\s*:/);
    }
  });

  it("the home header's brand mark fixes its width and its height", () => {
    const header = read('src/chat/home/HomeHeader.tsx');
    expect(header).toMatch(/mark: \{ width: MARK_HEIGHT \* MARK_ASPECT, height: MARK_HEIGHT \}/);
    expect(header).toContain('resizeMode="contain"');
  });
});
