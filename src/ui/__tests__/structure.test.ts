// The shape K5 relies on, read from the source (vitest runs no React Native renderer): one
// component per file, each exported from index.ts under its file's name; every pressable or input
// primitive sets its accessibility role or label and its state; no primitive sets a font size of
// its own (sizes come from the type scale, which holds the 11 pt floor).

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const UI_DIR = path.resolve(__dirname, '..');
const COMPONENTS = readdirSync(UI_DIR)
  .filter((file) => file.endsWith('.tsx'))
  .map((file) => ({ name: path.basename(file, '.tsx'), source: read(file) }));
const INDEX = read('index.ts');

function read(file: string): string {
  return readFileSync(path.join(UI_DIR, file), 'utf8');
}

const AC_PRIMITIVES = [
  'Screen',
  'Text',
  'Button',
  'IconButton',
  'Card',
  'Pill',
  'Chip',
  'StatusPip',
  'CountBadge',
  'SegmentedControl',
  'TextField',
  'ListRow',
  'EmptyState',
  'ErrorState',
  'LoadingState',
  'Divider',
];

describe('src/ui: one component per file, all from index.ts', () => {
  it('has every primitive FND-2 names', () => {
    const names = COMPONENTS.map((component) => component.name);
    for (const name of AC_PRIMITIVES) expect(names).toContain(name);
  });

  it("exports each file's component, named after the file, from index.ts", () => {
    for (const { name, source } of COMPONENTS) {
      expect(source, name).toMatch(new RegExp(`export function ${name}\\b`));
      expect(INDEX, name).toMatch(
        new RegExp(`export \\{\\s*${name},[^}]*\\btype ${name}Props\\b[^}]*\\} from './${name}';`),
      );
    }
  });

  it('declares exactly one exported component per file', () => {
    for (const { name, source } of COMPONENTS) {
      const exported = source.match(/^export function [A-Z]\w*/gm) ?? [];
      expect(exported, name).toHaveLength(1);
    }
  });
});

describe('src/ui: accessibility', () => {
  const interactive = COMPONENTS.filter(({ source }) => /<(Pressable|TextInput)\b/.test(source));

  it('covers every pressable and input primitive', () => {
    expect(interactive.map((component) => component.name).sort()).toEqual(
      ['Button', 'Card', 'IconButton', 'ListRow', 'Pill', 'SegmentedControl', 'TextField'].sort(),
    );
  });

  it('sets a label and a state on each, and a role on each pressable', () => {
    for (const { name, source } of interactive) {
      expect(source, name).toContain('accessibilityLabel=');
      expect(source, name).toContain('accessibilityState=');
      if (source.includes('<Pressable')) expect(source, name).toContain('accessibilityRole=');
    }
  });

  it('makes an icon-only button say what it does', () => {
    const iconButton = COMPONENTS.find((component) => component.name === 'IconButton');
    expect(iconButton?.source).toMatch(/readonly accessibilityLabel: string;/);
  });
});

describe('src/ui: text sizes come from the scale', () => {
  it('sets no fontSize of its own outside the type scale', () => {
    for (const { name, source } of COMPONENTS) {
      expect(source, name).not.toMatch(/fontSize:\s*\d/);
    }
  });

  it('turns Dynamic Type off nowhere', () => {
    for (const { name, source } of COMPONENTS) {
      expect(source, name).not.toMatch(/allowFontScaling=\{false\}|maxFontSizeMultiplier/);
    }
  });
});
