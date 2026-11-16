// The Switch and SwitchRow, pure and from source (vitest runs no React Native renderer): the word
// beside the switch, its paint on the tokens, what VoiceOver hears it as, and the row's 44 pt
// least height. The look is the one Settings → Notifications drew before the switch moved here.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { studioTokens } from '../../styles/tokens/studio';
import { MIN_TOUCH } from '../paint';
import { UI_COPY } from '../strings';
import {
  SWITCH_DETAIL_LEVEL,
  SWITCH_ROW_MIN_HEIGHT,
  SWITCH_TITLE_LEVEL,
  switchAccessibilityState,
  switchPaint,
  switchRowLines,
  switchWord,
} from '../switch-model';

const read = (file: string) => readFileSync(path.resolve(__dirname, '..', file), 'utf8');

describe('the switch', () => {
  it('says its state in a word beside it: On or Off', () => {
    expect([switchWord(true), switchWord(false)]).toEqual(['On', 'Off']);
    expect([UI_COPY.switchOn, UI_COPY.switchOff]).toEqual(['On', 'Off']);
  });

  it('paints the muted track off, the primary track on and a card thumb, in both tones', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const { colours } = studioTokens(scheme);
      expect(switchPaint(colours)).toEqual({
        trackColor: { false: colours.muted, true: colours.primary },
        thumbColor: colours.card,
        iosBackground: colours.muted,
      });
    }
  });

  it('is heard as checked or not, and whether it can change', () => {
    expect(switchAccessibilityState(true, false)).toEqual({ checked: true, disabled: false });
    expect(switchAccessibilityState(false, true)).toEqual({ checked: false, disabled: true });
  });

  it('keeps its role, its name and its state (read from source)', () => {
    const source = read('Switch.tsx');
    expect(source).toContain('accessibilityRole="switch"');
    expect(source).toContain('accessibilityLabel={accessibilityLabel}');
    expect(source).toMatch(/readonly accessibilityLabel: string;/);
    expect(source).toContain('accessibilityState={switchAccessibilityState(value, disabled)}');
    // the word beside it is not read a second time
    expect(source).toMatch(/importantForAccessibility="no"\s+accessible=\{false\}/);
  });
});

describe('the switch row', () => {
  it('is at least the 44 pt touch target tall, its words at Title 6 and Body 6', () => {
    expect(SWITCH_ROW_MIN_HEIGHT).toBe(MIN_TOUCH);
    expect(SWITCH_ROW_MIN_HEIGHT).toBe(44);
    expect([SWITCH_TITLE_LEVEL, SWITCH_DETAIL_LEVEL]).toEqual([6, 6]);
    expect(read('SwitchRow.tsx')).toMatch(/minHeight: SWITCH_ROW_MIN_HEIGHT/);
  });

  it('names the switch by its title, with the detail as the hint', () => {
    expect(read('SwitchRow.tsx')).toContain(
      '<Switch {...control} accessibilityLabel={title} accessibilityHint={detail} />',
    );
  });

  it('shows the detail, then the note, and drops an empty one', () => {
    expect(switchRowLines('Covers questions', 'Only owners change it')).toEqual([
      'Covers questions',
      'Only owners change it',
    ]);
    expect(switchRowLines(undefined, 'A note')).toEqual(['A note']);
    expect(switchRowLines('', null)).toEqual([]);
  });
});
