// The app standard's rule 4.2: back goes through one hook, which falls back to home when there is
// nothing behind, so a screen opened first (a tapped notification, a link) never strands the
// person, and stays (does nothing) on a tab's root and where the fallback is the screen already
// showing, comparing routes as the router does. The rule itself is back.ts, pure; the hook is read
// from the source and rendered once with
// react-dom's server renderer over a stand-in router (vitest runs no React Native renderer). No
// other file calls the router's back for itself.

import { createRequire } from 'node:module';
import { createElement, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { codeOf } from '../../release/__tests__/support/code';
import { productFiles, readRepoFile } from '../../release/__tests__/support/tree';
import { backMove, sameScreen, screenPath, type BackMove, type BackPlace } from '../back';
import { routes } from '../routes';
import { useBack, useGoBack } from '../use-go-back';

const HOOK = 'src/navigation/use-go-back.ts';
const ROUTER_BACK = /\brouter\.(back|canGoBack)\(/;
/** A screen that is not home, where the person is unless a test says otherwise. */
const ELSEWHERE = routes.chats;

/** The stand-in router: whether a screen is behind, where the person is, what it was asked. */
const router = vi.hoisted(() => ({ behind: false, here: '/chats', asked: [] as string[] }));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    canGoBack: () => router.behind,
    back: () => router.asked.push('back'),
    replace: (href: string) => router.asked.push(`replace ${href}`),
  }),
  usePathname: () => router.here,
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

/** What the hook's useBack hands the Header, from one render of a component that calls it. */
function backFrom(fallback: string, root: boolean): BackMove {
  const handed: BackMove[] = [];
  function Probe() {
    handed.push(useBack(fallback, root).move);
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  const [move] = handed;
  if (move === undefined) throw new Error('the probe did not render');
  return move;
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

/** Where Back goes from a place: nothing behind, the fallback home, elsewhere, unless given. */
const from = (place: Partial<BackPlace>) =>
  backMove({ canGoBack: false, fallback: routes.home, here: ELSEWHERE, ...place });

beforeEach(() => {
  router.behind = false;
  router.here = ELSEWHERE;
  router.asked = [];
});

describe('where Back goes (rule 4.2)', () => {
  it('is the screen behind, when there is one', () => {
    expect(from({ canGoBack: true })).toEqual({ kind: 'back' });
    expect(from({ canGoBack: true, fallback: routes.settings })).toEqual({ kind: 'back' });
    expect(from({ canGoBack: true, here: routes.home })).toEqual({ kind: 'back' });
  });

  it('is the fallback, in this screen’s place, when there is nothing behind', () => {
    expect(from({})).toEqual({ kind: 'replace', href: routes.home });
    expect(from({ fallback: routes.settings })).toEqual({ kind: 'replace', href: routes.settings });
  });

  it('stays where nothing is behind and the fallback is the screen already showing', () => {
    expect(from({ here: routes.home })).toEqual({ kind: 'stay' });
    expect(from({ here: routes.settings, fallback: routes.settings })).toEqual({ kind: 'stay' });
  });

  it("stays on a tab's root, whatever is behind it", () => {
    expect(from({ root: true })).toEqual({ kind: 'stay' });
    expect(from({ root: true, canGoBack: true })).toEqual({ kind: 'stay' });
    expect(from({ root: false })).toEqual({ kind: 'replace', href: routes.home });
  });

  it('is a frozen answer', () => {
    for (const place of [{ canGoBack: true }, {}, { here: routes.home }, { root: true }]) {
      expect(Object.isFrozen(from(place))).toBe(true);
    }
  });
});

describe('routes compared as the router matches them', () => {
  it('reads a trailing slash, a query, a fragment, a group and a doubled slash as the same screen', () => {
    for (const fallback of [
      `${routes.settings}/`,
      `${routes.settings}?tab=voice`,
      `${routes.settings}#top`,
      `/(app)${routes.settings}`,
      `/(app)/(tabs)${routes.settings}//`,
      `  ${routes.settings}  `,
    ]) {
      expect(screenPath(fallback)).toBe(routes.settings);
      expect(from({ here: routes.settings, fallback })).toEqual({ kind: 'stay' });
    }
    expect(screenPath('/(app)')).toBe(routes.home);
    expect(screenPath(routes.chatWithTicket(419))).toBe('/chat');
  });

  it('keeps two screens apart: another path, another id, a segment that only looks like a group', () => {
    expect(sameScreen(routes.settings, routes.licences)).toBe(false);
    expect(sameScreen(routes.chat('c-1'), routes.chat('c-2'))).toBe(false);
    expect(sameScreen('/(app', '/')).toBe(false);
    expect(from({ here: routes.chat('c-1'), fallback: routes.chat('c-2') })).toEqual({
      kind: 'replace',
      href: routes.chat('c-2'),
    });
  });
});

describe('the one back hook (rule 4.2)', () => {
  const hook = codeOf(HOOK);

  it('falls back to home when there is nothing behind', () => {
    expect(hook).toContain('useBack(fallback: string = routes.home');
    expect(hook).toContain('useGoBack(fallback: string = routes.home)');
    expect(hook).toContain('backMove({ canGoBack: router.canGoBack(), fallback, here, root })');
    expect(hook).toContain('const here = usePathname();');
  });

  it('does what the rule says: back, the fallback in this screen’s place, or nothing', () => {
    expect(hook).toMatch(
      /if \(move\.kind === 'back'\)\s+router\.back\(\);\s+else if \(move\.kind === 'replace'\)\s+router\.replace\(move\.href\);\s+\}/,
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
    expect(askedAfter(false, goBackFrom(routes.settings))).toEqual([`replace ${routes.settings}`]);
  });

  it('asks the router nothing when the fallback is where the person already is', () => {
    router.here = routes.settings;
    expect(askedAfter(false, goBackFrom(`/(app)${routes.settings}/`))).toEqual([]);
    router.here = routes.home;
    expect(askedAfter(false, goBackFrom())).toEqual([]);
    expect(askedAfter(true, goBackFrom())).toEqual(['back']);
  });

  it("hands the Header the move as it stands: stay on a tab's root and on its own fallback", () => {
    expect(backFrom(routes.home, false)).toEqual({ kind: 'replace', href: routes.home });
    expect(backFrom(routes.home, true)).toEqual({ kind: 'stay' });
    router.here = routes.settings;
    expect(backFrom(routes.settings, false)).toEqual({ kind: 'stay' });
    router.behind = true;
    expect(backFrom(routes.settings, false)).toEqual({ kind: 'back' });
    expect(backFrom(routes.settings, true)).toEqual({ kind: 'stay' });
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
