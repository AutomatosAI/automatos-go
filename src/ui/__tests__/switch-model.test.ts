// The Switch and SwitchRow, pure and from source (vitest runs no React Native renderer): the word
// beside the switch, what a press does, what VoiceOver hears it as, its touch (the whole row; a
// bare switch grown to 44 pt by its slop), and its paint on the tokens, looked up per palette so
// every mark reads at 3 to 1 (rule 10.4; the contrast test holds the pairs in every palette).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { contrastRatio } from '../../core/web/lib/look-kit/contrast';
import { STYLE_IDS, tokensFor, type Colours } from '../../styles/tokens';
import { STUDIO_COLOURS } from '../../styles/tokens/studio';
import { MARK_CONTRAST } from '../accent';
import { MIN_TOUCH } from '../paint';
import { UI_COPY } from '../strings';
import {
  NATIVE_SWITCH_SIZE,
  SWITCH_DETAIL_LEVEL,
  SWITCH_ROW_MIN_HEIGHT,
  SWITCH_SLOP,
  SWITCH_TITLE_LEVEL,
  pressSwitch,
  switchAccessibilityState,
  switchPaint,
  switchPress,
  switchRowHint,
  switchRowLines,
  switchTokens,
  switchWord,
} from '../switch-model';

const read = (file: string) => readFileSync(path.resolve(__dirname, '..', file), 'utf8');
const SCHEMES = ['light', 'dark'] as const;
const PALETTES = [
  ...new Set(STYLE_IDS.flatMap((style) => SCHEMES.map((scheme) => tokensFor(style, scheme)))),
];
const nameOf = ({ style, scheme }: { style: string; scheme: string }) => `${style} ${scheme}`;

describe('the switch', () => {
  it('says its state in a word beside it: On or Off', () => {
    expect([switchWord(true), switchWord(false)]).toEqual(['On', 'Off']);
    expect([UI_COPY.switchOn, UI_COPY.switchOff]).toEqual(['On', 'Off']);
  });

  it('turns on a press, and a disabled one does not change', () => {
    expect(switchPress(false, false)).toBe(true);
    expect(switchPress(true, false)).toBe(false);
    expect(switchPress(true, true)).toBeNull();
    const onChange = vi.fn();
    pressSwitch(false, false, onChange);
    pressSwitch(true, true, onChange);
    expect(onChange.mock.calls).toEqual([[true]]);
  });

  it('is heard as checked or not, and whether it can change', () => {
    expect(switchAccessibilityState(true, false)).toEqual({ checked: true, disabled: false });
    expect(switchAccessibilityState(false, true)).toEqual({ checked: false, disabled: true });
  });

  it('on its own, reaches the 44 pt touch target through its slop', () => {
    expect(NATIVE_SWITCH_SIZE).toEqual({ width: 51, height: 31 });
    expect(SWITCH_SLOP).toEqual({ top: 7, bottom: 7, left: 0, right: 0 });
    expect(NATIVE_SWITCH_SIZE.height + SWITCH_SLOP.top + SWITCH_SLOP.bottom).toBeGreaterThanOrEqual(
      MIN_TOUCH,
    );
    expect(NATIVE_SWITCH_SIZE.width).toBeGreaterThanOrEqual(MIN_TOUCH);
  });

  it('is one control: the press round the drawn switch is named, stated and grown (read from source)', () => {
    const source = read('Switch.tsx');
    expect(source).toContain('onPress={() => pressSwitch(value, disabled, onChange)}');
    expect(source).toMatch(/disabled=\{disabled\}\s+hitSlop=\{SWITCH_SLOP\}/);
    expect(source).toContain('accessibilityRole="switch"');
    expect(source).toContain('accessibilityLabel={accessibilityLabel}');
    expect(source).toMatch(/readonly accessibilityLabel: string;/);
    expect(source).toContain('accessibilityState={switchAccessibilityState(value, disabled)}');
    // the word and the native switch are drawn only: no touch, no second stop
    expect(source).toMatch(
      /accessibilityElementsHidden\s+importantForAccessibility="no-hide-descendants"/,
    );
    expect(source).toContain(
      "face: { flexDirection: 'row', alignItems: 'center', pointerEvents: 'none' }",
    );
    expect(source).toMatch(
      /<NativeSwitch\s+value=\{value\}\s+disabled=\{disabled\}\s+accessible=\{false\}/,
    );
    expect(source).not.toContain('onValueChange');
  });
});

describe('the switch row', () => {
  it('is at least the 44 pt touch target tall, its words at Title 6 and Body 6', () => {
    expect(SWITCH_ROW_MIN_HEIGHT).toBe(MIN_TOUCH);
    expect(SWITCH_ROW_MIN_HEIGHT).toBe(44);
    expect([SWITCH_TITLE_LEVEL, SWITCH_DETAIL_LEVEL]).toEqual([6, 6]);
    expect(read('SwitchRow.tsx')).toMatch(/minHeight: SWITCH_ROW_MIN_HEIGHT/);
  });

  it('is the control: a press anywhere turns it, named by its title, its lines as the hint', () => {
    const source = read('SwitchRow.tsx');
    expect(source).toContain('onPress={() => pressSwitch(value, disabled, onChange)}');
    expect(source).toContain('disabled={disabled}');
    expect(source).toContain('accessibilityRole="switch"');
    expect(source).toContain('accessibilityLabel={title}');
    expect(source).toContain('accessibilityHint={switchRowHint(detail, note)}');
    expect(source).toContain('accessibilityState={switchAccessibilityState(value, disabled)}');
  });

  it('draws the Switch inside out of the touch and out of the accessibility tree', () => {
    const source = read('SwitchRow.tsx');
    expect(source).toMatch(
      /style=\{styles\.drawnOnly\}\s+accessibilityElementsHidden\s+importantForAccessibility="no-hide-descendants"\s*>\s*<Switch \{\.\.\.control\} accessibilityLabel=\{title\} \/>/,
    );
    expect(source).toContain("drawnOnly: { pointerEvents: 'none' }");
  });

  it('shows the detail, then the note, and drops an empty one', () => {
    expect(switchRowLines('Covers questions', 'Only owners change it')).toEqual([
      'Covers questions',
      'Only owners change it',
    ]);
    expect(switchRowLines(undefined, 'A note')).toEqual(['A note']);
    expect(switchRowLines('', null)).toEqual([]);
  });

  it('says the detail and the note as its hint, each a sentence', () => {
    expect(switchRowHint('Covers questions', 'Only owners change it.')).toBe(
      'Covers questions. Only owners change it.',
    );
    expect(switchRowHint('Sent at 8?', null)).toBe('Sent at 8?');
    expect(switchRowHint(' A note ', undefined)).toBe('A note.');
    expect(switchRowHint(undefined, null)).toBeUndefined();
  });
});

describe('the switch’s paint (rule 10.4)', () => {
  it.each(PALETTES.map((tokens) => [nameOf(tokens), tokens.colours] as const))(
    '%s: the on look is the primary track and a card thumb, as before',
    (_name, colours) => {
      const { onTrack, thumb } = switchTokens(colours);
      expect([onTrack, thumb]).toEqual(['primary', 'card']);
      expect(switchPaint(colours).trackColor.true).toBe(colours.primary);
      expect(switchPaint(colours).thumbColor).toBe(colours.card);
    },
  );

  it('chooses the quietest off track that reads, per palette', () => {
    const chosen = Object.fromEntries(
      PALETTES.map((tokens) => [nameOf(tokens), switchTokens(tokens.colours).offTrack]),
    );
    expect(chosen).toEqual({
      'studio light': 'fg3',
      'studio dark': 'fg3',
      'play dark': 'fg3',
      'hud dark': 'border2',
      'arcade dark': 'border2',
      'candy light': 'border2',
    });
  });

  it.each(PALETTES.map((tokens) => [nameOf(tokens), tokens.colours] as const))(
    '%s: paints iOS’s off track and the off track in the one token',
    (_name, colours) => {
      const paint = switchPaint(colours);
      expect(paint.iosBackground).toBe(paint.trackColor.false);
      expect(paint.trackColor.false).toBe(colours[switchTokens(colours).offTrack]);
    },
  );

  it('keeps the muted track where it reads, and falls to the main ink where nothing does', () => {
    const light = STUDIO_COLOURS.light;
    const readable: Colours = { ...light, muted: light.mutedForeground };
    expect(switchTokens(readable).offTrack).toBe('muted');
    const lost: Colours = {
      ...light,
      muted: light.background,
      border2: light.background,
      fg3: light.background,
      mutedForeground: light.background,
    };
    expect(switchTokens(lost).offTrack).toBe('foreground');
    expect(contrastRatio(lost.foreground, lost.card)).toBeGreaterThanOrEqual(MARK_CONTRAST);
  });

  it('takes the main ink on where the strong ink is lost, so the card thumb still reads on it', () => {
    const light = STUDIO_COLOURS.light;
    const paleOn: Colours = { ...light, primary: light.card };
    expect(switchTokens(paleOn)).toEqual({ onTrack: 'foreground', thumb: 'card', offTrack: 'fg3' });
  });

  it.each(PALETTES.map((tokens) => [nameOf(tokens), tokens.colours] as const))(
    '%s: the card thumb reads on both tracks',
    (_name, colours) => {
      const { onTrack, offTrack } = switchTokens(colours);
      for (const track of [onTrack, offTrack]) {
        expect(contrastRatio(colours.card, colours[track]), track).toBeGreaterThanOrEqual(
          MARK_CONTRAST,
        );
      }
    },
  );

  it('decides once for a palette object', () => {
    const palette = { ...STUDIO_COLOURS.light };
    expect(switchTokens(palette).offTrack).toBe('fg3');
    palette.muted = palette.foreground; // a palette is never changed in place: this shows the answer is kept
    expect(switchTokens(palette).offTrack).toBe('fg3');
    expect(switchTokens({ ...palette }).offTrack).toBe('muted');
  });
});
