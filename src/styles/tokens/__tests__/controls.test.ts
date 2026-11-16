// Each style's control sizes (tokens/controls.ts): the four styles keep Studio's controls and say
// only how tall a button and a filter pill are at least, the numbers the dress wrote by hand before
// (Ember's and HUD's 44, HUD's 46 in a panel, Ember's 40 pt chips). Every look of every style
// resolves with its style's list, an installed theme with Studio's, and the dress reads its heights
// from it, so each style draws exactly as before. The primitives read the list through useStyle()
// (read from source: no React Native renderer in node).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONTROL_SPECS, STUDIO_CONTROLS } from '../../controls';
import { dressOf } from '../../dress/dress';
import {
  ARCADE_STYLES,
  CANDY_STYLES,
  HUD_STYLES,
  PLAY_STYLES,
  STUDIO_STYLES,
} from '../../dress/__tests__/fixtures';
import { BUILT_IN_STYLE_IDS } from '../../registry/style-id';
import {
  DRESS_MIN_HEIGHT,
  HUD_PANEL_BUTTON_HEIGHT,
  PLAY_PILL_HEIGHT,
  STYLE_CONTROLS,
} from '../controls';

const UI = path.resolve(__dirname, '..', '..', '..', 'ui');
const read = (file: string) => readFileSync(path.join(UI, file), 'utf8');

/** What each style raised by hand before: the least a button, a button in a panel and a pill are. */
const RAISED = {
  play: [44, 44, 40],
  hud: [44, 46, 44],
  arcade: [44, 44, 44],
  candy: [44, 44, 44],
} as const;

describe('STYLE_CONTROLS', () => {
  it('has a list for every built-in style, and Studio’s is the default', () => {
    expect(Object.keys(STYLE_CONTROLS).sort()).toEqual([...BUILT_IN_STYLE_IDS].sort());
    expect(STYLE_CONTROLS.studio).toBe(STUDIO_CONTROLS);
    expect([DRESS_MIN_HEIGHT, HUD_PANEL_BUTTON_HEIGHT, PLAY_PILL_HEIGHT]).toEqual([44, 46, 40]);
  });

  it.each(Object.entries(RAISED))(
    'gives %s Studio’s controls with its own least button and pill heights',
    (id, [button, inPanel, pill]) => {
      const controls = STYLE_CONTROLS[id as keyof typeof RAISED];
      expect(controls).toEqual({
        ...CONTROL_SPECS,
        buttonMinHeight: button,
        panelButtonMinHeight: inPanel,
        pillMinHeight: pill,
      });
    },
  );
});

describe('every style resolves with its list', () => {
  const sets = [
    ['studio', STUDIO_STYLES],
    ['play', PLAY_STYLES],
    ['hud', HUD_STYLES],
    ['arcade', ARCADE_STYLES],
    ['candy', CANDY_STYLES],
  ] as const;

  it.each(sets)('%s, at every look (an installed theme: Studio’s)', (id, styles) => {
    for (const style of styles) expect(style.controls).toBe(STYLE_CONTROLS[id]);
  });

  it.each(sets)('%s: the dress takes its least heights from the list', (_id, styles) => {
    for (const style of styles) {
      const dress = dressOf(style);
      expect(dress.button.minHeight).toBe(style.controls.buttonMinHeight);
      expect(dress.button.panelMinHeight).toBe(style.controls.panelButtonMinHeight);
      expect(dress.pill.minHeight).toBe(style.controls.pillMinHeight);
    }
  });
});

describe('the primitives read their style’s list', () => {
  it.each([
    ['Button.tsx', /const metrics = style\.controls\.button\[size\];/],
    ['IconButton.tsx', /const \{ box, icon \} = useStyle\(\)\.controls\.iconButton\[size\];/],
    ['TextField.tsx', /const \{ field \} = style\.controls;/],
    ['CommandCentreButton.tsx', /const \{ commandCentre \} = style\.controls;/],
    ['SegmentedControl.tsx', /const sizes = style\.controls\.segment;/],
  ])('%s', (file, reads) => {
    const source = read(file);
    expect(source).toMatch(reads);
    expect(source).not.toMatch(
      /BUTTON_SIZES|ICON_BUTTON_SIZES|FIELD_HEIGHT|SEGMENT_(MIN_HEIGHT|TRACK_INSET|PADDING_Y|GAP)/,
    );
  });

  it('draws a field at its list’s heights, one line or many', () => {
    expect(read('TextField.tsx')).toMatch(
      /minHeight: multiline \? field\.multilineMinHeight : field\.height/,
    );
  });
});
