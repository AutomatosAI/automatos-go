// A thread's end kept in view when its view shrinks (the keyboard coming up over the message box):
// the rule, and the three thread lists that follow it, read from source (vitest runs in node with
// no React renderer).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { END_SLACK, NO_METRICS, atListEnd, endMetrics, keepsEndInView } from '../end-in-view';

const read = (file: string) =>
  readFileSync(path.resolve(__dirname, '..', '..', '..', file), 'utf8');

describe('atListEnd', () => {
  it('is at the end when the view reaches the content’s foot', () => {
    expect(atListEnd({ offset: 600, view: 400, content: 1000 })).toBe(true);
  });

  it('is at the end within the slack', () => {
    expect(atListEnd({ offset: 600 - END_SLACK, view: 400, content: 1000 })).toBe(true);
    expect(atListEnd({ offset: 599 - END_SLACK, view: 400, content: 1000 })).toBe(false);
  });

  it('is at the end when the content fits the view', () => {
    expect(atListEnd({ offset: 0, view: 800, content: 300 })).toBe(true);
  });

  it('is not at the end scrolled back up through the thread', () => {
    expect(atListEnd({ offset: 100, view: 400, content: 1000 })).toBe(false);
  });
});

describe('keepsEndInView', () => {
  it('scrolls back to the end when the view shrinks under someone reading there', () => {
    expect(keepsEndInView({ offset: 600, view: 400, content: 1000 }, 250)).toBe(true);
  });

  it('scrolls a thread that fitted, now taller than its view, to its end', () => {
    expect(keepsEndInView({ offset: 0, view: 900, content: 700 }, 500)).toBe(true);
  });

  it('leaves someone scrolled back up where they are', () => {
    expect(keepsEndInView({ offset: 100, view: 400, content: 1000 }, 250)).toBe(false);
  });

  it('does nothing when the view grows or keeps its height', () => {
    expect(keepsEndInView({ offset: 600, view: 400, content: 1000 }, 600)).toBe(false);
    expect(keepsEndInView({ offset: 600, view: 400, content: 1000 }, 400)).toBe(false);
  });

  it('does nothing on the first layout', () => {
    expect(keepsEndInView(NO_METRICS, 500)).toBe(false);
  });

  it('follows a second shrink before the first scroll is reported (the keyboard settling)', () => {
    const first = endMetrics(1000, 400);
    expect(atListEnd(first)).toBe(true);
    expect(keepsEndInView(first, 330)).toBe(true);
  });
});

describe('endMetrics', () => {
  it('puts the view on the content’s last stretch', () => {
    expect(endMetrics(1000, 400)).toEqual({ offset: 600, view: 400, content: 1000 });
  });

  it('stays at the top when the content fits', () => {
    expect(endMetrics(300, 400)).toEqual({ offset: 0, view: 400, content: 300 });
  });
});

describe('the thread lists', () => {
  const hook = read('src/chat/components/use-end-in-view.ts');

  it('takes the view’s height from layout only, so a scroll before the layout cannot hide a shrink', () => {
    expect(hook).toMatch(/const view = event\.nativeEvent\.layout\.height;/);
    expect(hook).not.toMatch(/layoutMeasurement/);
    expect(hook).toMatch(/if \(!keep\) return;\n\s+holdFoot\(\);\n\s+followFrames\(\);/);
  });

  it('scrolls to the end again over the next frames, cancelled when it unmounts', () => {
    // the native list can take its new height a frame or more after the layout event, and a
    // scroll sent before that is clamped to the old end (the message box growing a line)
    expect(hook).toMatch(/const FOLLOW_FRAMES = 3;/);
    expect(hook).toMatch(/frame\.current = left > 0 \? requestAnimationFrame\(next\) : null;/);
    expect(hook).toMatch(/if \(frame\.current !== null\) cancelAnimationFrame\(frame\.current\);/);
  });

  it('scrolls to the content’s foot, past the bottom padding FlatList’s scrollToEnd stops short of', () => {
    expect(hook).toMatch(
      /list\.current\?\.scrollToOffset\(\{ offset: endMetrics\(content, view\)\.offset, animated: animate \}\);/,
    );
    // only a shrink notes the end before the scroll is reported
    expect(hook).toMatch(
      /metrics\.current = endMetrics\(metrics\.current\.content, metrics\.current\.view\);\n\s+scrollToFoot\(false\);/,
    );
    // scrollToEnd only before the first layout, when the view's height is not known yet
    expect(hook.match(/scrollToEnd\(/g)).toHaveLength(1);
    expect(hook).toMatch(/if \(view === 0\) \{\n\s+list\.current\?\.scrollToEnd\(/);
  });

  it('scrolls to the foot when a row is added, animated unless Reduce Motion, then runs the focus', () => {
    expect(hook).toMatch(/if \(shouldScrollToEnd\(previous\.current, count\)\) \{/);
    expect(hook).toMatch(/const animated = !useReducedMotion\(\);/);
    expect(hook).toMatch(
      /if \(pending\.current !== 'none'\) \{\n\s+scrollToFoot\(pending\.current === 'add' && animated\);\n\s+pending\.current = 'none';\n\s+\}\n\s+afterContent\(\);/,
    );
  });

  it('opens a thread at its newest row, its already-loaded rows counted as added, not animated (#51)', () => {
    // counted from none, not from the rows at mount, so a cached thread scrolls too
    expect(hook).toMatch(/const previous = useRef\(0\);/);
    expect(hook).toMatch(/pending\.current = previous\.current === 0 \? 'open' : 'add';/);
    // the focus scroll still runs after it (afterContent), so a thread opened at a message stays there
  });

  it.each([
    ['src/chat/components/MessageList.tsx', 'rows'],
    ['src/styles/homes/PlayThread.tsx', 'drawn'],
    ['src/styles/candy/home/ChatView.tsx', 'entries'],
  ])('%s scrolls through the hook, the focus after the jump to the end', (file, rows) => {
    const source = read(file);
    expect(source).toContain(`const endInView = useEndInView(list, ${rows}.length, focus.run);`);
    expect(source).toMatch(/\{\.\.\.endInView\}/);
    expect(source).not.toMatch(/scrollToEnd\(|useScrollOnAdd|onContentSizeChange=/);
    // nothing on the list can quietly replace the hook's own handlers
    expect(source).not.toMatch(/\b(onScroll|onLayout|scrollEventThrottle)=/);
  });
});
