// The app standard's rule 4.2: back goes through one hook, which falls back to home when there is
// nothing behind, so a screen opened first (a tapped notification, a link) never strands the
// person. The rule itself is back.ts, pure; the hook is read from the source and rendered once with
// react-dom's server renderer over a stand-in router (vitest runs no React Native renderer). No
// other file calls the router's back for itself.

import { createRequire } from 'node:module';
import { createElement, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { codeOf } from '../../release/__tests__/support/code';
import { productFiles, readRepoFile } from '../../release/__tests__/support/tree';
import { backMove } from '../back';
import { routes } from '../routes';
import { useGoBack } from '../use-go-back';

const HOOK = 'src/navigation/use-go-back.ts';
const ROUTER_BACK = /\brouter\.(back|canGoBack)\(/;

/** The stand-in router: whether a screen is behind, and what it was asked to do. */
const router = vi.hoisted(() => ({ behind: false, asked: [] as string[] }));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    canGoBack: () => router.behind,
    back: () => router.asked.push('back'),
    replace: (href: string) => router.asked.push(`replace ${href}`),
  }),
}));

// react-dom ships no types here (@types/react-dom is not a dependency): typed at the one call used
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  readonly renderToStaticMarkup: (element: ReactElement) => string;
};

/** What the hook hands a screen, from one render of a component that calls it. */
function goBackFrom(...fallback: [] | [string]): () => void {
  const handed: (() => void)[] = [];
  function Probe() {
    handed.push(useGoBack(...fallback));
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  const [goBack] = handed;
  if (goBack === undefined) throw new Error('the probe did not render');
  return goBack;
}

/** The rule as the chat route, Older chats and the voice screen each wrote it by hand. */
function handWritten(stand: { canGoBack(): boolean; back(): void; replace(href: string): void }) {
  if (stand.canGoBack()) stand.back();
  else stand.replace(routes.home);
}

/** What the router was asked, after `run`. */
function askedAfter(behind: boolean, run: () => void): readonly string[] {
  router.behind = behind;
  router.asked = [];
  run();
  return [...router.asked];
}

beforeEach(() => {
  router.behind = false;
  router.asked = [];
});

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

  it('is the only place that calls the router back', () => {
    // the raw text first: only a file that names the call at all is parsed for its code, so the
    // walk over every product file stays quick
    const callers = productFiles().filter(
      (file) =>
        file !== HOOK && ROUTER_BACK.test(readRepoFile(file)) && ROUTER_BACK.test(codeOf(file)),
    );
    expect(callers).toEqual([]);
  });
});

describe('the one back hook, over a router (rule 4.2)', () => {
  it('goes back, and only back, when there is a screen behind', () => {
    expect(askedAfter(true, goBackFrom())).toEqual(['back']);
  });

  it('puts home in this screen’s place when there is nothing behind', () => {
    expect(askedAfter(false, goBackFrom())).toEqual([`replace ${routes.home}`]);
  });

  it('puts the fallback a screen names there instead', () => {
    expect(askedAfter(false, goBackFrom(routes.settings))).toEqual([
      `replace ${routes.settings}`,
    ]);
  });

  it.each([true, false])(
    'given home, asks what the hand-written rule asked (a screen behind: %s)',
    (behind) => {
      const stand = {
        canGoBack: () => router.behind,
        back: () => router.asked.push('back'),
        replace: (href: string) => router.asked.push(`replace ${href}`),
      };
      const before = askedAfter(behind, () => handWritten(stand));
      expect(askedAfter(behind, goBackFrom(routes.home))).toEqual(before);
    },
  );
});
