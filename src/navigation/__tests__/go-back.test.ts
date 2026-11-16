// The app standard's rule 4.2: back goes through one hook, which falls back to home when there is
// nothing behind, so a screen opened first (a tapped notification, a link) never strands the
// person. The rule itself is back.ts, pure; the hook is read from the source (vitest runs no
// React Native renderer). No other file calls the router's back for itself, but the three listed
// below, which write the same rule out by hand.

import { describe, expect, it } from 'vitest';

import { codeOf } from '../../release/__tests__/support/code';
import { productFiles } from '../../release/__tests__/support/tree';
import { backMove } from '../back';
import { routes } from '../routes';

const HOOK = 'src/navigation/use-go-back.ts';
const ROUTER_BACK = /\brouter\.(back|canGoBack)\(/;

/**
 * Files that still ask the router themselves, each exactly as the hook does it: back when there is
 * a screen behind, home when there is not. Owed: each moves to useGoBack(). A new file fails here,
 * and a listed one that has moved fails until it is taken off.
 */
const WRITTEN_BY_HAND: readonly string[] = [
  'app/(app)/chat/[id].tsx',
  'src/chat/history/ChatsScreen.tsx',
  'src/voice/screen/use-voice-screen.ts',
];

describe('where Back goes (rule 4.2)', () => {
  it('is the screen behind, when there is one', () => {
    expect(backMove(true, routes.home)).toEqual({ kind: 'back' });
    expect(backMove(true, routes.settings)).toEqual({ kind: 'back' });
  });

  it('is the fallback, in this screen’s place, when there is nothing behind', () => {
    expect(backMove(false, routes.home)).toEqual({ kind: 'replace', href: routes.home });
    expect(backMove(false, routes.settings)).toEqual({ kind: 'replace', href: routes.settings });
  });

  it('is a frozen answer', () => {
    expect(Object.isFrozen(backMove(true, routes.home))).toBe(true);
    expect(Object.isFrozen(backMove(false, routes.home))).toBe(true);
  });
});

describe('the one back hook (rule 4.2)', () => {
  const hook = codeOf(HOOK);

  it('falls back to home when there is nothing behind', () => {
    expect(hook).toContain('fallback: string = routes.home');
    expect(hook).toContain('backMove(router.canGoBack(), fallback)');
  });

  it('does what the rule says: back, or the fallback in this screen’s place', () => {
    expect(hook).toMatch(
      /if \(move\.kind === 'back'\)\s+router\.back\(\);\s+else\s+router\.replace\(move\.href\);/,
    );
  });

  it('is the only place that calls the router back, but where listed', () => {
    const callers = productFiles().filter(
      (file) => file !== HOOK && ROUTER_BACK.test(codeOf(file)),
    );
    expect(callers).toEqual([...WRITTEN_BY_HAND].sort());
  });

  it('where it is written by hand, it still falls back to home', () => {
    for (const file of WRITTEN_BY_HAND) {
      expect(codeOf(file), file).toContain('router.replace(routes.home)');
    }
  });
});
