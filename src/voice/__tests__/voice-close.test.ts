// The voice screen's menu square closes it (rule 4.2): the one hook with home as its fallback, as
// it was written by hand before: back when a screen is behind, home in its place when the screen
// was opened on its own. Closing does nothing else: the mic and the speech stop when the screen
// unmounts (quick-ask's 'mounted' scope detaches then), as they did. Where the hook goes is proved
// over a router in src/navigation's go-back.test.ts; here it is read from the source.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { stripComments } from '../../release/__tests__/support/code';

const FILE = path.resolve(__dirname, '../screen/use-voice-screen.ts');
const SCREEN = path.resolve(__dirname, '../screen/VoiceScreen.tsx');
const code = stripComments(FILE, readFileSync(FILE, 'utf8'));

describe('closing the voice screen', () => {
  it('is the one hook, falling back to home', () => {
    expect(code.match(/useGoBack\(/g)).toHaveLength(1);
    expect(code).toContain('const goBack = useGoBack(routes.home);');
  });

  it('is the close action, and nothing more', () => {
    expect(code).toMatch(/\bclose: goBack,/);
    expect(code).not.toMatch(/\.(back|canGoBack)\(/);
  });

  it('is the menu square’s press', () => {
    expect(readFileSync(SCREEN, 'utf8')).toContain('onMenu={on.close}');
  });

  it('leaves the mic to the unmount: the screen keeps the mounted scope', () => {
    expect(code).toMatch(/useQuickAsk\(thread\);/);
  });
});
