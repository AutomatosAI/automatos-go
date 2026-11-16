// Every switch in the app, read from every product file (rules 10.1, 10.2 and 10.4): the Switch
// primitive and its row, and the switches a style draws itself (Candy's Motion knob, HUD's drawer
// switches). Each is one control: it takes its state from switch-model.ts, its touch is at least
// 44 points, and where React Native's own switch is drawn it is only drawn, out of the touch and
// out of the accessibility tree, so it is neither a second, smaller target nor a second stop. Their
// colours are held in the contrast test (src/styles/__tests__/contrast.test.ts).

import { describe, expect, it } from 'vitest';

import { productFiles, readRepoFile } from '../../release/__tests__/support/tree';
import { dressOf } from '../../styles/dress/dress';
import { CANDY_STYLES } from '../../styles/dress/__tests__/fixtures';
import { HUD_DRAWER } from '../../styles/hud/drawer-model';
import { STUDIO_COLOURS } from '../../styles/tokens/studio';
import { MIN_TOUCH } from '../paint';
import { ownSwitchPaint } from '../switch-model';

const CANDY_KNOBS = 'src/styles/candy/look-page/KnobRows.tsx';
const HUD_SWITCHES = 'src/styles/hud/drawer/DrawerControls.tsx';
const ROLE = 'accessibilityRole="switch"';
const NATIVE_SWITCH = /import\s*\{[^}]*\bSwitch\b[^}]*\}\s*from 'react-native'/;

const files = productFiles().filter((file) => file.endsWith('.tsx'));
const sources = files.map((file) => ({ file, source: readRepoFile(file) }));
const switches = sources.filter(({ source }) => source.includes(ROLE));
const natives = sources.filter(({ source }) => NATIVE_SWITCH.test(source));

describe('every switch is one control', () => {
  it('finds the primitive, its row and the switches the styles draw', () => {
    expect(switches.map(({ file }) => file)).toEqual(
      expect.arrayContaining([
        'src/ui/Switch.tsx',
        'src/ui/SwitchRow.tsx',
        CANDY_KNOBS,
        HUD_SWITCHES,
      ]),
    );
    expect(natives.map(({ file }) => file)).toEqual(
      expect.arrayContaining(['src/ui/Switch.tsx', CANDY_KNOBS]),
    );
  });

  it('takes its state from switch-model.ts wherever a switch is heard', () => {
    const own = switches.filter(({ source }) => !source.includes('switchAccessibilityState('));
    expect(own.map(({ file }) => file)).toEqual([]);
  });

  it("draws React Native's switch only: not touched, not heard, and never its own press", () => {
    for (const { file, source } of natives) {
      expect(source, file).toMatch(
        /accessibilityElementsHidden\s+importantForAccessibility="no-hide-descendants"/,
      );
      expect(source, file).toMatch(/pointerEvents: 'none'/);
      expect(source, file).toMatch(/accessible=\{false\}/);
      expect(source, file).not.toContain('onValueChange');
    }
  });

  it("Candy's Motion: its whole row is the press, at least the 44 pt target tall", () => {
    const source = readRepoFile(CANDY_KNOBS);
    expect(source).toContain(
      'onPress={() => pressSwitch(item.on, item.disabled, page.switchMotion)}',
    );
    expect(source).toContain('accessibilityLabel={item.title}');
    expect(source).toContain('accessibilityHint={item.words}');
    for (const style of CANDY_STYLES) {
      expect(dressOf(style).row.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH);
    }
  });

  it("HUD's drawer switches: each a third of the row, 44 tall, its state in its word", () => {
    expect(HUD_DRAWER.switches.height).toBeGreaterThanOrEqual(MIN_TOUCH);
    const source = readRepoFile(HUD_SWITCHES);
    expect(source).toContain('accessibilityLabel={item.label}');
    expect(source).toContain('minHeight: switches.height');
    expect(source).toContain('{item.text}');
  });
});

describe("a style's own switch colours, by the switch's one rule", () => {
  const { card: PAGE, foreground: INK, background: PALE, fg3: MID } = STUDIO_COLOURS.light;

  it('keeps the first colour that reads on every ground and under the thumb', () => {
    const paint = ownSwitchPaint({
      on: [INK],
      off: [PALE, MID],
      thumb: PAGE,
      grounds: [PAGE],
      fallback: INK,
    });
    expect(paint).toEqual({
      trackColor: { false: MID, true: INK },
      thumbColor: PAGE,
      iosBackground: MID,
    });
  });

  it('falls back to the ink that reads where none does', () => {
    const paint = ownSwitchPaint({
      on: [PALE],
      off: [PALE],
      thumb: PAGE,
      grounds: [PAGE],
      fallback: INK,
    });
    expect(paint.trackColor).toEqual({ false: INK, true: INK });
  });
});
