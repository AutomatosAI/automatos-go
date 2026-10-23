// The composer stays above the keyboard when a bar sits above the signed-in stack (P001C-SEAM-1):
// ChatFrame offsets its KeyboardAvoidingView by where the stack starts, useSafeAreaFrame's y, and
// no signed-in screen under src/chat or app/(app) has a KeyboardAvoidingView without that offset.
// The foundation's Sheet (src/ui/Sheet.tsx) sits in a native Modal from the window's top, so it is
// outside this check.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repo = path.resolve(__dirname, '../../..');
const SIGNED_IN_ROOTS = ['src/chat', 'app/(app)'];

/** The code alone: comments may name a KeyboardAvoidingView without rendering one. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const screens = SIGNED_IN_ROOTS.flatMap((root) =>
  readdirSync(path.join(repo, root), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.tsx') && !file.includes('__tests__'))
    .map((file) => {
      const name = path.join(root, file);
      return { file: name, text: code(readFileSync(path.join(repo, name), 'utf8')) };
    }),
);

const avoidingViews = (text: string) => text.match(/<KeyboardAvoidingView\b[^>]*>/g) ?? [];

/** The name bound to useSafeAreaFrame's y, if the source reads it. */
const frameTop = (text: string) =>
  /const \{ y: (\w+) \} = useSafeAreaFrame\(\);/.exec(text)?.[1] ??
  /const (\w+) = useSafeAreaFrame\(\)\.y;/.exec(text)?.[1];

describe('ChatFrame: the composer lifts clear of the keyboard under a bar', () => {
  const frame = screens.find(({ file }) => file === path.join('src/chat', 'screens/ChatFrame.tsx'));

  it('reads where the signed-in stack starts from react-native-safe-area-context', () => {
    expect(frame?.text).toMatch(
      /import \{[^}]*\buseSafeAreaFrame\b[^}]*\} from 'react-native-safe-area-context';/,
    );
    expect(frameTop(frame?.text ?? '')).toBeDefined();
  });

  it('passes that y as its KeyboardAvoidingView’s keyboardVerticalOffset', () => {
    const top = frameTop(frame?.text ?? '');
    const views = avoidingViews(frame?.text ?? '');
    expect(views).toHaveLength(1);
    expect(views[0]).toContain(`keyboardVerticalOffset={${top}}`);
  });
});

describe('every signed-in KeyboardAvoidingView carries the offset', () => {
  it('finds the screens it checks', () => {
    expect(screens.length).toBeGreaterThan(0);
    expect(screens.some(({ text }) => avoidingViews(text).length > 0)).toBe(true);
  });

  it('has no KeyboardAvoidingView under src/chat or app/(app) without useSafeAreaFrame’s y', () => {
    const offenders = screens
      .filter(({ text }) => avoidingViews(text).length > 0)
      .filter(({ text }) => {
        const top = frameTop(text);
        return (
          top === undefined ||
          avoidingViews(text).some((view) => !view.includes(`keyboardVerticalOffset={${top}}`))
        );
      })
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
