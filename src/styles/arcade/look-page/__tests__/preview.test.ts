// Options' PREVIEW window, its pure rules (US-022j; the design kit's looks/look-preview.tsx at
// 034fa629c as the reference): the title names the palette, a new text speed types the line again,
// the four game colours in the kit's order each read at AA on the window they sit on in every
// palette, and nothing is set under 11 pt.

import { describe, expect, it } from 'vitest';

import { contrastRatio } from '../../../../core/web/lib/look-kit/contrast';
import { saveAsNew, INITIAL_ARCADE_LOOKS } from '../../arcade-looks';
import { ARCADE_PRESET_LOOKS, type ArcadeLook } from '../../look-schema';
import { MIN_TEXT_SIZE } from '../../../type';
import { ARCADE_BODY_MIN } from '../../../typeface/arcade-type';
import { arcadeVars } from '../../../tokens/arcade';
import {
  OPTIONS_PREVIEW,
  PREVIEW_STATE,
  gameColours,
  previewLabel,
  previewTitle,
  previewTypingId,
} from '../preview';

/** WCAG AA for normal text: the game words are Press Start 2P at 11. */
const AA = 4.5;

describe("Options' preview", () => {
  it('names the palette in its title, a saved look too', () => {
    const nightCity = ARCADE_PRESET_LOOKS[3] as ArcadeLook;
    expect(previewTitle(nightCity)).toBe('Preview · Night City');
    const change = saveAsNew({
      ...INITIAL_ARCADE_LOOKS,
      active: { ...nightCity, palette: 'neon' },
    });
    if (!change.ok) throw new Error('saved');
    expect(change.looks.active.name).toBe('Save slot 1');
    expect(previewTitle(change.looks.active)).toBe('Preview · Neon Cabinet');
  });

  it('says its title and the whole line to VoiceOver, once', () => {
    expect(previewLabel(ARCADE_PRESET_LOOKS[0] as ArcadeLook)).toBe(
      'Preview · Overworld. Text types out at this speed. Press on, hero.',
    );
  });

  it('types the line again when the text speed changes, and only then', () => {
    const [overworld, dungeon] = ARCADE_PRESET_LOOKS as readonly ArcadeLook[];
    expect(previewTypingId(overworld)).toBe(previewTypingId(dungeon));
    const ids = ['instant', 'normal', 'slow'].map((textSpeed) =>
      previewTypingId({ textSpeed } as Pick<ArcadeLook, 'textSpeed'>),
    );
    expect(new Set(ids).size).toBe(3);
  });

  it('shows Auto celebrating, as the kit does', () => {
    expect(PREVIEW_STATE).toBe('celebrate');
  });

  it("lists the game colours in the kit's order, each a word", () => {
    expect(gameColours().map(({ tone, word }) => [tone, word])).toEqual([
      ['hp', 'HP'],
      ['xp', 'XP'],
      ['mp', 'Mana'],
      ['qs', '! Quest'],
    ]);
  });

  it('reads every game word at AA on the window, in every palette', () => {
    for (const look of ARCADE_PRESET_LOOKS) {
      const vars = arcadeVars(look);
      for (const { tone } of gameColours()) {
        expect(contrastRatio(vars[tone], vars.win), `${look.id} ${tone}`).toBeGreaterThanOrEqual(
          AA,
        );
      }
    }
  });

  it('sets its running text at Arcade’s body floor, nothing under 11 pt', () => {
    for (const size of [OPTIONS_PREVIEW.lineSize, OPTIONS_PREVIEW.itemSize]) {
      expect(size).toBeGreaterThanOrEqual(ARCADE_BODY_MIN);
      expect(size).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
    }
  });
});
