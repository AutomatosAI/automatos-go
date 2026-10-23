// The thread drawn like the web (D72), read from the source (vitest runs no React Native renderer),
// in the kit's style: the user's words in the grey box, never the primary slab; Auto's in its box
// beside the sail avatar, with no 'A' tile or 'AUTO' label; the sail tinted white with both sides
// pinned and VoiceOver's 'Auto said, Auto is an AI' on it; the list placed by threadPlaces with no
// flat gap, a turn's notice folded into the reply it ends, the thinking pill and a notice boxed by
// thread-look alone, and only the live rows animated; the thinking pill in words, not italics, in
// the label face thread-look names and announced on iOS; the composer in the thread's 16/24.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CHAT_COPY } from '../strings';

const COMPONENTS = path.resolve(__dirname, '..', 'components');
const read = (...parts: string[]) => readFileSync(path.resolve(__dirname, '..', ...parts), 'utf8');
const component = (file: string) => readFileSync(path.join(COMPONENTS, file), 'utf8');

describe('the user’s box', () => {
  const bubble = component('UserBubble.tsx');

  it('is the grey box in the thread’s words, never the primary slab with inverse words', () => {
    expect(bubble).not.toMatch(/colours\.primary/);
    expect(bubble).not.toMatch(/tone="inverse"/);
    expect(bubble).toContain("bubbleStyle(tokens, 'user')");
    expect(bubble).toContain('variant="thread"');
  });
});

describe('Auto’s message', () => {
  const message = component('AutoMessage.tsx');
  const avatar = component('AutoAvatar.tsx');

  it('drops the ‘A’ tile and the ‘AUTO’ label for the sail avatar and Auto’s box', () => {
    expect(message).not.toMatch(/CHAT_COPY\.auto(Mark|Label)/);
    expect(message).toContain('<AutoColumn avatar="header" report={report}>');
    expect(message).toContain("bubbleStyle(tokens, 'auto')");
  });

  it('draws the white sail from the bundled mark, both sides pinned, never a new PNG', () => {
    expect(avatar).toContain("require('../../../assets/brand/splash.png')");
    expect(avatar).toContain('tintColor: thread.sail');
    expect(avatar).toContain('width: THREAD.sail.width, height: THREAD.sail.height');
    expect(avatar).toContain('resizeMode="contain"');
  });

  it('is VoiceOver’s ‘Auto said, Auto is an AI’ heading and carries Report this', () => {
    expect(avatar).toContain('accessibilityLabel={AUTO_AVATAR_LABEL}');
    expect(avatar).toContain('accessibilityRole="header"');
    expect(avatar).toContain('{...report}');
  });
});

describe('the list and the thinking pill', () => {
  const list = component('MessageList.tsx');

  it('places every row with threadPlaces, with no flat gap between them', () => {
    expect(list).toContain('foldNotices(rows)');
    expect(list).toContain('threadPlaces(shown)');
    expect(list).toContain('data={shown}');
    expect(list).not.toMatch(/gap: spacing\.space7/);
  });

  it('boxes the thinking pill and a notice only as thread-look decides', () => {
    expect(list).toContain('<WorkingIndicator boxed={ownBox(place)} />');
    expect(list).toContain('noticeStyle(tokens, ownBox(place))');
    expect(list).not.toMatch(/place\.avatar !== 'none'/);
  });

  it('animates only the live rows; every other row is a plain view', () => {
    expect(list).toContain('if (entrance === null) return <View style={style}>{children}</View>;');
  });

  it('says ‘Thinking’ in words, with no italic, in thread-look’s label face', () => {
    const working = component('WorkingIndicator.tsx');
    expect(working).not.toMatch(/italic/);
    expect(working).toContain('CHAT_COPY.thinking');
    expect(working).toContain('accessibilityLabel={CHAT_COPY.thinkingLabel}');
    expect(working).toContain('level={THINKING_LABEL.level}');
    expect(working).toContain('weight={THINKING_LABEL.weight}');
    // iOS has no live regions: VoiceOver is told once
    expect(working).toContain('AccessibilityInfo.announceForAccessibility(words)');
  });

  it('writes the composer in the thread’s 16/24', () => {
    expect(read('composer', 'PillInput.tsx')).toContain("textFace(tokens.type, 'thread')");
  });
});

describe('the thread’s copy', () => {
  it('has no ‘A’ mark, ‘AUTO’ label or ‘Auto is working…’ left', () => {
    expect(CHAT_COPY).not.toHaveProperty('autoMark');
    expect(CHAT_COPY).not.toHaveProperty('autoLabel');
    expect(CHAT_COPY).not.toHaveProperty('working');
    expect([CHAT_COPY.thinking, CHAT_COPY.thinkingLabel]).toEqual(['Thinking', 'Auto is thinking']);
  });
});
