// The renderer's shape, read from the source (vitest runs no React Native renderer), in the kit's
// style: the markdown components paint from the look's tokens only (no colour literal, no font
// family or size of their own), the view-model and its helpers are pure, links go through the
// thread's onLink (never Linking or a WebView here; another site only after the reader has seen
// its address), Auto's answer is drawn by Markdown and the user's words are not, the answer is
// lexed incrementally and drawn memoised while it streams, and a notice and 'What Auto did' are
// quiet blocks with no box (Gerard, 23 Oct).

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const CHAT = path.resolve(__dirname, '..', '..');
const MARKDOWN = path.join(CHAT, 'markdown');
const ROOT = path.resolve(CHAT, '..', '..');

const read = (file: string) => readFileSync(file, 'utf8');
/** The code alone: header comments may name what a file leaves out. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*\*|\*)/.test(line))
    .join('\n');

const sources = readdirSync(MARKDOWN)
  .filter((file) => /\.tsx?$/.test(file))
  .map((file) => ({ file, text: read(path.join(MARKDOWN, file)) }));
const components = sources.filter(({ file }) => file.endsWith('.tsx'));
const pure = sources.filter(({ file }) => file.endsWith('.ts'));

/** The lint guard's colour literal (eslint.config.js COLOUR). */
const COLOUR =
  /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_])|\b(rgba?|hsla?)\s*\(/;

describe('src/chat/markdown: tokens only', () => {
  it('has the renderer’s components and its pure modules', () => {
    expect(components.map(({ file }) => file).sort()).toEqual(
      ['CodeBlockView.tsx', 'InlineText.tsx', 'Markdown.tsx', 'TableView.tsx'].sort(),
    );
    expect(pure.map(({ file }) => file).sort()).toEqual(
      ['blocks.ts', 'inline.ts', 'lex.ts', 'links.ts', 'look.ts'].sort(),
    );
  });

  it('names no colour, font family or font size of its own', () => {
    for (const { file, text } of sources) {
      const body = code(text);
      expect(body, file).not.toMatch(COLOUR);
      expect(body, file).not.toMatch(/fontFamily:\s*['"`]/);
      expect(body, file).not.toMatch(/fontSize:\s*\d/);
      expect(body, file).not.toMatch(/(Geist|Newsreader|Menlo|Courier|monospace)/);
    }
  });

  it('paints every component from the look’s tokens', () => {
    for (const { file, text } of components) {
      expect(text, file).toMatch(/useTokens\(\)/);
    }
  });

  it('keeps the view-model and its helpers pure: no React or React Native at run time', () => {
    for (const { file, text } of pure) {
      expect(text, file).not.toMatch(
        /^import (?!type )[^;]*from '(react|react-native|expo[^']*)';/m,
      );
    }
  });

  it('opens links through the thread’s onLink: never Linking, a browser or a WebView here', () => {
    for (const { file, text } of sources) {
      expect(text, file).not.toMatch(/react-native-webview|expo-web-browser|\bLinking\b/);
    }
  });

  it('asks before another site opens, naming its host and address; app and Studio links do not', () => {
    const inline = code(read(path.join(MARKDOWN, 'InlineText.tsx')));
    expect(inline).toMatch(/if \(site === null\) \{\s*onLink\(target\);\s*return;\s*\}/);
    expect(inline).toMatch(/Alert\.alert\(copy\.title\(site\.host\), site\.address, \[/);
    expect(inline).toMatch(/\{ text: copy\.cancel, style: 'cancel' \}/);
    expect(inline).toMatch(/\{ text: copy\.open, onPress: \(\) => onLink\(target\) \}/);
    expect(inline).toMatch(/onPress=\{\(\) => follow\(link, context\.onLink\)\}/);
  });

  it('lexes with marked only, pinned exactly', () => {
    const pkg = JSON.parse(read(path.join(ROOT, 'package.json'))) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies.marked).toBe('18.1.1');
    const markdownDeps = Object.keys(pkg.dependencies).filter((name) =>
      /markdown|remark|rehype|markdown-it|commonmark/.test(name),
    );
    expect(markdownDeps).toEqual([]);
    expect(read(path.join(MARKDOWN, 'blocks.ts'))).toMatch(/from 'marked';/);
  });
});

describe('the thread: Auto’s answer is formatted, the user’s words are not', () => {
  const autoMessage = read(path.join(CHAT, 'components', 'AutoMessage.tsx'));
  const userBubble = read(path.join(CHAT, 'components', 'UserBubble.tsx'));
  const markdown = read(path.join(MARKDOWN, 'Markdown.tsx'));

  it('draws Auto’s answer with Markdown, through the thread’s link handling and Report this', () => {
    expect(autoMessage).toMatch(/import \{ Markdown \} from '\.\.\/markdown\/Markdown';/);
    expect(autoMessage).toMatch(
      /<Markdown text=\{row\.answer\} onLink=\{onLink\} report=\{report\} \/>/,
    );
    expect(code(autoMessage)).not.toMatch(/paragraphs/);
  });

  it('lexes once per text, from the last lex’s settled blocks, and draws memoised', () => {
    expect(markdown).toMatch(/useMemo\(\(\) => lexMarkdown\(text, last\.current\), \[text\]\)/);
    expect(markdown).toMatch(/export const Markdown = memo\(/);
    expect(markdown).toMatch(/const BlockView = memo\(/);
    // the report actions stay one object, so the memoised answer is not drawn again every frame
    expect(autoMessage).toMatch(/const report = useReportActions\(onReport\);/);
    expect(autoMessage).toMatch(/\[offered\],/);
  });

  it('leaves the user’s message plain text', () => {
    expect(userBubble).not.toMatch(/Markdown|markdown/);
    expect(userBubble).toMatch(/\{row\.text\}/);
  });
});

describe('a notice is a quiet line, not a box', () => {
  const notice = code(read(path.join(CHAT, 'components', 'TurnNotice.tsx')));

  it('draws no border, card or ground', () => {
    expect(notice).not.toMatch(/border|<Card|backgroundColor|colours\.card/);
  });

  it('draws ‘What Auto did’ as a quiet block too: no border, card or ground', () => {
    const receipts = code(read(path.join(CHAT, 'components', 'ReceiptsCard.tsx')));
    expect(receipts).not.toMatch(/border|\bCard\b|backgroundColor|colours\.card|shadow/);
    expect(receipts).toMatch(/\{CHAT_COPY\.receiptsTitle\}/);
    expect(receipts).toMatch(/receipts\.note \?/);
  });

  it('keeps the mark in its tone, the words muted, and Try again where offered', () => {
    expect(notice).toMatch(/color: colours\[MARK_COLOURS\[notice\.tone\]\]/);
    expect(notice).toMatch(/tone="muted"/);
    expect(notice).toMatch(/notice\.retry && onRetry \?/);
    expect(notice).toMatch(/label=\{CHAT_COPY\.retry\}/);
    expect(notice).toMatch(/accessibilityRole=\{alert \? 'alert' : 'text'\}/);
  });
});
