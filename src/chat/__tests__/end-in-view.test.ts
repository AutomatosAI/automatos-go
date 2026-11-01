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
    expect(hook).toMatch(/if \(!keep\) return;\n\s+toFoot\(false\);/);
    // a frame on as well: Android clamps a scroll sent before the native list has its new height
    expect(hook).toMatch(/requestAnimationFrame\(\(\) => toFoot\(false\)\);/);
  });

  it('scrolls to the content’s foot, past the bottom padding FlatList’s scrollToEnd stops short of', () => {
    expect(hook).toMatch(/metrics\.current = endMetrics\(content, view\);/);
    expect(hook).toMatch(
      /list\.current\?\.scrollToOffset\(\{ offset: metrics\.current\.offset, animated: animate \}\);/,
    );
    // scrollToEnd only before the first layout, when the view's height is not known yet
    expect(hook.match(/scrollToEnd\(/g)).toHaveLength(1);
    expect(hook).toMatch(/if \(view === 0\) \{\n\s+list\.current\?\.scrollToEnd\(/);
  });

  it('scrolls to the foot when a row is added, animated unless Reduce Motion, then runs the focus', () => {
    expect(hook).toMatch(
      /if \(shouldScrollToEnd\(previous\.current, count\)\) pending\.current = true;/,
    );
    expect(hook).toMatch(/const animated = !useReducedMotion\(\);/);
    expect(hook).toMatch(
      /if \(pending\.current\) \{\n\s+pending\.current = false;\n\s+toFoot\(animated\);\n\s+\}\n\s+afterContent\(\);/,
    );
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
  });
});
