// Rule 10 (docs/app-standard.md): one way to announce. React Native honours accessibilityLiveRegion
// on Android only, so a polite region speaks to TalkBack and says nothing to VoiceOver. The app's
// one hook, src/ui/use-announce.ts, announces a region's words on an iPhone as they appear or
// change. This walks every product file: no file but the hook calls announceForAccessibility, and
// every live region that speaks (polite or assertive) sits in a component that calls useAnnounce,
// or is on a short list with its reason: present from the start (VoiceOver reads it in order), or
// owed. A listed region that is gone, or that now uses the hook, fails too, so the lists stay true.
// Both lists, each entry with its reason, are the app's (settings/announcements.ts).

import { describe, expect, it } from 'vitest';

import { OWED, PRESENT_FROM_START } from './settings/announcements';
import { productFiles, readRepoFile } from './support/tree';

const HOOK_FILE = 'src/ui/use-announce.ts';
const ANNOUNCES = /\bannounceForAccessibility\w*\s*\(/;
const LIVE_REGION = /accessibilityLiveRegion=(\{[^}]*\}|"[^"]*")/g;
const SPEAKS = /\b(?:polite|assertive)\b/;
/** A top-level declaration: where one component ends and the next begins. */
const DECLARATION = /^(?:export\s+)?(?:default\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=)/gm;
const USES_HOOK = /\buseAnnounce\(/;
// The walk reads every product file, as the other whole-tree audits do.
const WHOLE_TREE_MS = 30_000;

type Region = Readonly<{ id: string; line: number; usesHook: boolean }>;

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

/** Each speaking live region in a file, by the component it sits in. */
function regionsOf(file: string): Region[] {
  const source = readRepoFile(file);
  const declarations = [...source.matchAll(DECLARATION)].map((match) => ({
    name: match[1] ?? match[2] ?? '',
    at: match.index,
  }));
  return [...source.matchAll(LIVE_REGION)]
    .filter((match) => SPEAKS.test(match[1] ?? ''))
    .map((match) => {
      const owner = declarations.filter((each) => each.at <= match.index).at(-1);
      const end = declarations.find((each) => each.at > match.index)?.at ?? source.length;
      const body = source.slice(owner?.at ?? 0, end);
      return {
        id: `${file}#${owner?.name ?? '(file)'}`,
        line: lineAt(source, match.index),
        usesHook: USES_HOOK.test(body),
      };
    });
}

const files = productFiles();
const regions = files.filter((file) => file.endsWith('.tsx')).flatMap(regionsOf);
const listed = new Map([...PRESENT_FROM_START, ...OWED].map((entry) => [entry.id, entry.why]));

describe('one way to announce', () => {
  it(
    'no file but the hook calls AccessibilityInfo.announceForAccessibility',
    () => {
      const callers = files.filter((file) => ANNOUNCES.test(readRepoFile(file)));
      expect(callers).toEqual([HOOK_FILE]);
    },
    WHOLE_TREE_MS,
  );

  it('finds the regions the app has, the shared ones among them', () => {
    expect(regions.length).toBeGreaterThan(30);
    const ids = regions.map((region) => region.id);
    [
      'src/ui/ErrorState.tsx#ErrorState',
      'src/ui/Toast.tsx#Toast',
      'src/ui/OutOfDateNote.tsx#OutOfDateNote',
    ]
      .concat(['src/chat/components/TurnNotice.tsx#TurnNotice'])
      .forEach((id) => expect(ids).toContain(id));
  });

  it('gives every speaking live region the hook, or a reason on a list', () => {
    const silent = regions
      .filter((region) => !region.usesHook && !listed.has(region.id))
      .map((region) => `${region.id} (line ${region.line})`);
    expect(silent).toEqual([]);
  });

  it.each([...PRESENT_FROM_START, ...OWED])(
    '$id is listed with its reason: $why',
    ({ id, why }) => {
      expect(why.trim()).not.toBe('');
      const found = regions.filter((region) => region.id === id);
      expect(found.length, 'a listed region that is gone').toBeGreaterThan(0);
      expect(
        found.some((region) => region.usesHook),
        'a listed region that now uses the hook',
      ).toBe(false);
    },
  );

  it('lists each region once, never as both present from the start and owed', () => {
    const ids = [...PRESENT_FROM_START, ...OWED].map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the walk itself', () => {
  it('reads a region in a branch as speaking, and "none" as silent', () => {
    expect(SPEAKS.test("{alert ? 'polite' : 'none'}")).toBe(true);
    expect(SPEAKS.test('"assertive"')).toBe(true);
    expect(SPEAKS.test('"none"')).toBe(false);
  });

  it('splits a file into its top-level components', () => {
    const source = [
      'function Quiet() {',
      '  return <Text accessibilityLiveRegion="polite">a</Text>;',
      '}',
      'export function Loud() {',
      '  useAnnounce(words);',
      '  return <Text accessibilityLiveRegion="polite">b</Text>;',
      '}',
      'const styles = StyleSheet.create({});',
    ].join('\n');
    const names = [...source.matchAll(DECLARATION)].map((match) => match[1] ?? match[2]);
    expect(names).toEqual(['Quiet', 'Loud', 'styles']);
  });
});
