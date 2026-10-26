// R17 (PRD-001 US-021 AC3; D38) as a test that keeps running in CI: across every product file of
// every wave and every style, text grows with Dynamic Type (no allowFontScaling off, no cap under
// 2 without a reason above it), nothing is drawn under 11 pt, every pressable that shows no words
// has an accessibility label, and every icon-only button is the IconButton primitive, whose label
// its type requires. A true negative is an ALLOWED entry in support/a11y-allowed.ts. The screens
// themselves, at the largest size in every style, are Gerard's (docs/release/accessibility-pass.md,
// OT-R8). D38's floor was never a lint rule: eslint.config.js carries the colour half of the
// foundation's 'text never below 11 pt; no colour literal (lint)', and the scale holds the size.

import path from 'node:path';

import { ESLint } from 'eslint';
import type { LucideIcon } from 'lucide-react-native';
import { describe, expect, it } from 'vitest';

import { MIN_TEXT_SIZE, TEXT_SCALING, TYPE_SPECS } from '../../styles/type';
import type { IconButtonProps } from '../../ui/IconButton';
import type { TextProps } from '../../ui/Text';
import {
  fontSizesOf,
  isIconOnly,
  isReasonedCap,
  placeOf,
  pressablesOf,
  scalingOf,
  turnsScalingOff,
  usesOf,
  type FoundPressable,
  type FoundScaling,
} from './support/a11y';
import {
  ALLOWED,
  ICON_BUTTON_FILE,
  LEAST_FONT_SCALE_CAP,
  MIN_TEXT_POINTS,
  type A11yRule,
} from './support/a11y-allowed';
import { productFiles, readRepoFile, repoRoot } from './support/tree';

const files = productFiles();
const pressables = files.flatMap((file) => pressablesOf(file, readRepoFile(file)));
const scaling = files.flatMap((file) => scalingOf(file, readRepoFile(file)));
const key = (file: string, rule: A11yRule, text: string) => `${file}\n${rule}\n${text}`;
const allowed = new Set(ALLOWED.map((entry) => key(entry.file, entry.rule, entry.text)));
const at = (found: { file: string; line: number }) => `${found.file}:${found.line}`;
const scalingText = (found: FoundScaling) => `${found.kind}: ${found.value}`;

const iconOnly = pressables.filter((each) => isIconOnly(each) && each.file !== ICON_BUTTON_FILE);
const scalingOff = scaling.filter(turnsScalingOff);
const shown = new Set([
  ...iconOnly.map((each) => key(each.file, 'ICON_ONLY', placeOf(each))),
  ...scalingOff.map((each) => key(each.file, 'SCALING_OFF', scalingText(each))),
]);

const someIcon = (() => null) as unknown as LucideIcon;
const noop = () => undefined;
// The types are the guard: an IconButton without a label, or a Text that stops scaling, does not
// compile (npm run typecheck, CI's 'typecheck · lint · test').
// @ts-expect-error accessibilityLabel is required: an icon says nothing to VoiceOver
const unlabelled: IconButtonProps = { icon: someIcon, onPress: noop };
const labelled: IconButtonProps = { icon: someIcon, onPress: noop, accessibilityLabel: 'Menu' };
// @ts-expect-error allowFontScaling is not a Text prop: Dynamic Type cannot be turned off there
const unscaled: TextProps = { allowFontScaling: false };

describe('the tree the audit reads', () => {
  it('reads every pressable of every wave and style', () => {
    expect(pressables.length).toBeGreaterThan(50);
    const where = new Set(pressables.map((each) => each.file));
    [ICON_BUTTON_FILE, 'src/chat/home/MenuButton.tsx', 'src/cc/shell/TopBar.tsx']
      .concat(['src/styles/play/companion/PlayHeader.tsx', 'src/styles/hud/core/HudTopBar.tsx'])
      .forEach((file) => expect(where).toContain(file));
  });

  it('finds what a pressable shows, its label, and a component that forwards into one', () => {
    const source = [
      "import Menu from 'lucide-react-native/icons/menu';",
      "import { Pressable, Text, View } from 'react-native';",
      'function Row({ label, children }) {',
      '  return <Pressable accessibilityLabel={label}>{children}</Pressable>;',
      '}',
      'export const A = ({ Icon }) => (',
      '  <View>',
      '    <Pressable accessibilityLabel="Menu"><Menu size={22} /></Pressable>',
      '    <Pressable><Menu /><Text>Menu</Text></Pressable>',
      '    <Pressable><View /></Pressable>',
      '    <Pressable accessibilityLabel="">{() => <Icon />}</Pressable>',
      '    <Pressable accessible={false} onLongPress={noop}>{body}</Pressable>',
      '    <Row label="Settings"><Menu /></Row>',
      '  </View>',
      ');',
    ].join('\n');
    const pick = (each: FoundPressable) =>
      [each.kind, each.labelled, each.emptyLabel, each.accessible, each.words, each.icon].join();
    expect(pressablesOf('a.tsx', source).map(pick)).toEqual([
      'raw,true,false,true,false,false',
      'raw,true,false,true,false,true',
      'raw,false,false,true,true,true',
      'raw,false,false,true,false,false',
      'raw,false,true,true,false,true',
      'raw,false,false,false,false,false',
      'forwarding,true,false,true,false,true',
    ]);
    expect(pressablesOf('a.tsx', source).filter(isIconOnly).map(placeOf)).toEqual([
      'Pressable in A',
      'Pressable in A',
      'Row in A',
    ]);
  });

  it('finds scaling turned off or capped, and font sizes written as numbers', () => {
    const source = [
      'export const A = () => (',
      '  <>',
      '    <Text allowFontScaling={false}>a</Text>',
      '    <TextInput allowFontScaling />',
      '    <Text maxFontSizeMultiplier={1.5}>b</Text>',
      '    {/* no reason */}',
      '    <Text maxFontSizeMultiplier={2}>c</Text>',
      '  </>',
      ');',
      'const off = { allowFontScaling: false };',
      '// the chip must fit the 34 pt row',
      'const capped = { maxFontSizeMultiplier: 2 };',
      'const sizes = { fontSize: 10, other: { fontSize: (12) }, scaled: { fontSize: size } };',
    ].join('\n');
    const found = scalingOf('a.tsx', source);
    expect(found.filter(turnsScalingOff).map((each) => each.line)).toEqual([3, 10]);
    const caps = found.filter((each) => each.kind === 'maxFontSizeMultiplier');
    expect(caps.map((each) => isReasonedCap(each, LEAST_FONT_SCALE_CAP))).toEqual([
      false,
      false,
      true,
    ]);
    expect(fontSizesOf('a.tsx', source).map((each) => each.size)).toEqual([10, 12]);
  });
});

describe('Dynamic Type stays on (R17)', () => {
  it('never turns text scaling off but where ALLOWED', () => {
    const found = scalingOff
      .filter((each) => !allowed.has(key(each.file, 'SCALING_OFF', scalingText(each))))
      .map((each) => `${at(each)} ${scalingText(each)}`);
    expect(found).toEqual([]);
  });

  it('caps Dynamic Type only at 2 or more, with a one-line reason directly above', () => {
    const caps = scaling.filter((each) => each.kind === 'maxFontSizeMultiplier');
    const found = caps.filter((each) => !isReasonedCap(each, LEAST_FONT_SCALE_CAP));
    expect(found.map((each) => `${at(each)} ${scalingText(each)} (above: ${each.above})`)).toEqual(
      [],
    );
  });

  it('keeps the Text primitive scaling: TEXT_SCALING is on and no caller can turn it off', () => {
    expect(TEXT_SCALING).toEqual({ allowFontScaling: true });
    expect(unscaled).toEqual({ allowFontScaling: false });
  });
});

describe('nothing under 11 pt (D38)', () => {
  it('holds the floor at the scale', () => {
    expect(MIN_TEXT_SIZE).toBe(MIN_TEXT_POINTS);
    Object.entries(TYPE_SPECS).forEach(([role, spec]) =>
      expect(spec.size, role).toBeGreaterThanOrEqual(MIN_TEXT_SIZE),
    );
  });

  it('writes no font size under 11 pt in any product file', () => {
    const sizes = files.flatMap((file) => fontSizesOf(file, readRepoFile(file)));
    const small = sizes.filter((each) => each.size < MIN_TEXT_SIZE);
    expect(small.map((each) => `${at(each)} fontSize ${each.size}`)).toEqual([]);
  });

  it('still lints colour literals out of product code (the foundation’s D38 lint half)', async () => {
    const eslint = new ESLint({ cwd: repoRoot() });
    const config = await eslint.calculateConfigForFile(path.join(repoRoot(), 'src/ui/Text.tsx'));
    const rule: unknown = config.rules?.['no-restricted-syntax'];
    expect(JSON.stringify(rule)).toMatch(/Colour literal \(D-TOKENS\)/);
  });
});

describe('every control says what it is to VoiceOver', () => {
  it('labels every pressable that shows no words', () => {
    const found = pressables
      .filter((each) => each.accessible && !each.words && !each.labelled)
      .map((each) => `${at(each)} ${placeOf(each)}`);
    expect(found).toEqual([]);
  });

  it('gives no pressable an empty label', () => {
    expect(pressables.filter((each) => each.emptyLabel).map(at)).toEqual([]);
  });

  it('sends every icon-only button through IconButton but where ALLOWED', () => {
    const found = iconOnly
      .filter((each) => !allowed.has(key(each.file, 'ICON_ONLY', placeOf(each))))
      .map((each) => `${at(each)} ${placeOf(each)}`);
    expect(found).toEqual([]);
    iconOnly.forEach((each) => expect(each.labelled, at(each)).toBe(true));
  });

  it('requires IconButton’s label by its type, and every use gives one', () => {
    expect(labelled.accessibilityLabel).toBe('Menu');
    expect(unlabelled.accessibilityLabel).toBeUndefined();
    const uses = files.flatMap((file) =>
      usesOf(file, readRepoFile(file), 'IconButton', 'accessibilityLabel').map((use) => ({
        file,
        ...use,
      })),
    );
    expect(uses.length).toBeGreaterThan(10);
    const bad = uses.filter((use) => use.value === null || ["''", '""'].includes(use.value));
    expect(bad.map(at)).toEqual([]);
  });
});

describe('the ALLOWED list', () => {
  it('allows only what is there and still trips its rule (no stale entry)', () => {
    const stale = ALLOWED.filter((entry) => !shown.has(key(entry.file, entry.rule, entry.text)));
    expect(stale.map((entry) => `${entry.file}: ${entry.text}`)).toEqual([]);
  });

  it('gives every entry a reviewed reason', () => {
    ALLOWED.forEach((entry) => {
      expect(entry.reason.length, entry.text).toBeGreaterThan(60);
      expect(entry.reason, entry.text).toMatch(/\((?:D|KS|US-0)\d+/);
    });
  });
});
