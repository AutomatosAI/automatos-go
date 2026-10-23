// The primitives' logic against the handoff and the tokens: every variant, size and state names a
// token that exists in Studio Light and Dark, no reachable text is below 11 pt (D38), every status
// has its word (§4.6), counts and plurals read right, and an error shows only the taxonomy's copy.

import { describe, expect, it } from 'vitest';

import { ApiError, type ApiErrorKind } from '../../api/errors';
import { API_ERROR_COPY } from '../../api/strings';
import { BOARD_COLUMNS, STATUS_CONFIG, type BoardStatus } from '../../core/web/types/board';
import { tokensFor, type ColourName, type Tokens } from '../../styles/tokens';
import { MIN_TEXT_SIZE, STUDIO_TYPE, type TypeScale } from '../../styles/type';
import { UI_COPY } from '../strings';
import { tint } from '../paint';
import {
  BUTTON_PAINTS,
  BUTTON_SIZES,
  FOCUS_RING,
  ICON_BUTTON_SIZES,
  PIP_TOKENS,
  TEXT_TONES,
  TONES,
  badgeText,
  buttonPaint,
  cardPaint,
  countPhrase,
  defaultTone,
  errorCopy,
  fieldNote,
  fieldPaint,
  isPipStatus,
  pillPaint,
  pluralForm,
  segmentPaint,
  statusPip,
  textFace,
  textRole,
  tonePaint,
  type ButtonVariant,
  type TextLevel,
  type TextVariant,
} from '../variants';

const LIGHT = tokensFor('studio', 'light');
const DARK = tokensFor('studio', 'dark');
const SCHEMES: readonly Tokens[] = [LIGHT, DARK];
const HEX = /^#[0-9A-F]{6}([0-9A-F]{2})?$/;
const VARIANTS: readonly TextVariant[] = ['title', 'body', 'mono', 'eyebrow', 'thread'];
const LEVELS: readonly (TextLevel | undefined)[] = [undefined, 1, 2, 3, 4, 5, 6];
const BUTTON_VARIANTS = Object.keys(BUTTON_PAINTS) as ButtonVariant[];
const BOARD_STATUSES = Object.keys(STATUS_CONFIG) as BoardStatus[];

function expectColour(tokens: Tokens, key: string) {
  expect(tokens.colours[key as ColourName], key).toMatch(HEX);
}

describe('text roles', () => {
  it('maps Title and Body levels 1–6 onto the scale, level 1 by default', () => {
    expect(textRole('title')).toBe('title1');
    expect(textRole('title', 4)).toBe('title4');
    expect(textRole('title', 6)).toBe('title6');
    expect(textRole('body')).toBe('body1');
    expect(textRole('body', 5)).toBe('body5');
  });

  it('reads Mono as the label, or a figure with a level (clamped to 1–3)', () => {
    expect(textRole('mono')).toBe('label');
    expect(textRole('mono', 1)).toBe('figure1');
    expect(textRole('mono', 3)).toBe('figure3');
    expect(textRole('mono', 6)).toBe('figure3');
  });

  it('has one Eyebrow whatever the level, and the thread’s words with its two headings (D72)', () => {
    expect([textRole('eyebrow'), textRole('eyebrow', 3)]).toEqual(['eyebrow', 'eyebrow']);
    const thread = ([undefined, 1, 2, 3, 6] as const).map((level) => textRole('thread', level));
    expect(thread).toEqual(['thread', 'threadTitle1', 'threadTitle2', 'thread', 'thread']);
  });

  it('never reaches text below 11 pt (D38)', () => {
    for (const variant of VARIANTS) {
      for (const level of LEVELS) {
        const role = textRole(variant, level);
        expect(STUDIO_TYPE[role].fontSize, `${variant} ${level}`).toBeGreaterThanOrEqual(
          MIN_TEXT_SIZE,
        );
      }
    }
  });

  it('paints every tone from a token in Light and Dark; eyebrows are muted by default', () => {
    for (const tokens of SCHEMES) {
      for (const key of Object.values(TEXT_TONES)) expectColour(tokens, key);
    }
    expect(VARIANTS.map(defaultTone).join()).toBe('default,default,default,muted,default');
  });
});

describe('text faces', () => {
  const type: TypeScale = LIGHT.type;

  it('is the scale itself with no override', () => {
    expect(textFace(type, 'body1')).toBe(type.body1);
    expect(textFace(type, 'title2', {})).toBe(type.title2);
  });

  it('takes a bundled weight or italic (button labels at 500, a title in italic)', () => {
    expect(textFace(type, 'body5', { weight: 500 }).fontFamily).toBe('Geist-Medium');
    expect(textFace(type, 'title4', { italic: true }).fontFamily).toBe(
      'Newsreader16pt16pt-MediumItalic',
    );
    expect(textFace(type, 'body5', { weight: 500 }).fontSize).toBe(type.body5.fontSize);
  });

  it("falls back to the role's face for one the app doesn't bundle, never throwing", () => {
    expect(textFace(type, 'title1', { weight: 700 })).toBe(type.title1);
    expect(textFace(type, 'body1', { italic: true })).toBe(type.body1);
  });
});

describe('buttons', () => {
  it('names only tokens that exist in Light and Dark', () => {
    for (const tokens of SCHEMES) {
      for (const set of Object.values(BUTTON_PAINTS)) {
        for (const p of [set.rest, set.pressed]) {
          for (const key of [p.background, p.border, p.foreground]) {
            if (key !== 'transparent') expectColour(tokens, key);
          }
        }
      }
    }
  });

  it('paints primary in ink on Light and cream on Dark (the handoff: the CTA inverts)', () => {
    const light = buttonPaint(LIGHT.colours, 'primary');
    const dark = buttonPaint(DARK.colours, 'primary');
    expect(light.backgroundColor).toBe(LIGHT.colours.foreground);
    expect(light.color).toBe(LIGHT.colours.primaryForeground);
    expect(dark.backgroundColor).toBe(DARK.colours.foreground);
    expect(dark.color).toBe(DARK.colours.primaryForeground);
  });

  it('presses primary to 90 %, outline and ghost to the hover ground', () => {
    const { colours } = LIGHT;
    expect(buttonPaint(colours, 'primary', { pressed: true }).opacity).toBe(0.9);
    expect(buttonPaint(colours, 'outline')).toEqual({
      backgroundColor: colours.card,
      borderColor: colours.border,
      color: colours.foreground,
      opacity: 1,
    });
    expect(buttonPaint(colours, 'outline', { pressed: true })).toEqual({
      backgroundColor: colours.ccHover,
      borderColor: colours.ccHoverBorder,
      color: colours.foreground,
      opacity: 1,
    });
    expect(buttonPaint(colours, 'ghost')).toMatchObject({
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      color: colours.mutedForeground,
    });
    expect(buttonPaint(colours, 'ghost', { pressed: true }).color).toBe(colours.foreground);
  });

  it('dims a disabled button to half and ignores a press on it', () => {
    for (const variant of BUTTON_VARIANTS) {
      const off = buttonPaint(LIGHT.colours, variant, { disabled: true, pressed: true });
      expect(off.opacity).toBe(0.5);
      expect(off.backgroundColor).toBe(buttonPaint(LIGHT.colours, variant).backgroundColor);
    }
  });

  it('sizes sm at 30 and md at 40, with labels from the scale at 11 pt or more', () => {
    expect(BUTTON_SIZES.sm.height).toBe(30);
    expect(BUTTON_SIZES.md.height).toBe(40);
    for (const size of Object.values(BUTTON_SIZES)) {
      expect(LIGHT.spacing[size.paddingX]).toBeGreaterThan(0);
      expect(LIGHT.spacing[size.gap]).toBeGreaterThan(0);
      const role = textRole('body', size.level);
      expect(STUDIO_TYPE[role].fontSize).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
    }
    expect(STUDIO_TYPE[textRole('body', BUTTON_SIZES.md.level)].fontSize).toBe(14);
    expect(STUDIO_TYPE[textRole('body', BUTTON_SIZES.sm.level)].fontSize).toBe(12);
  });

  it('sizes icon buttons 30, 36 and 42 with the icon inside the box', () => {
    expect(Object.values(ICON_BUTTON_SIZES).map((s) => s.box)).toEqual([30, 36, 42]);
    for (const { box, icon } of Object.values(ICON_BUTTON_SIZES)) expect(icon).toBeLessThan(box);
  });
});

describe('cards, pills and segments', () => {
  it('presses a card to the hover ground and border', () => {
    const { colours } = LIGHT;
    expect(cardPaint(colours, false)).toEqual({
      backgroundColor: colours.card,
      borderColor: colours.border,
    });
    expect(cardPaint(colours, true)).toEqual({
      backgroundColor: colours.ccHover,
      borderColor: colours.ccHoverBorder,
    });
  });

  it('paints a selected filter pill solid ink and an idle one on card', () => {
    for (const { colours } of SCHEMES) {
      expect(pillPaint(colours, true)).toEqual({
        backgroundColor: colours.foreground,
        borderColor: colours.foreground,
        color: colours.card,
        opacity: 1,
      });
      expect(pillPaint(colours, false)).toEqual({
        backgroundColor: colours.card,
        borderColor: colours.border,
        color: colours.foreground,
        opacity: 1,
      });
    }
    expect(pillPaint(LIGHT.colours, false, { pressed: true }).backgroundColor).toBe(
      LIGHT.colours.ccHover,
    );
    expect(pillPaint(LIGHT.colours, true, { pressed: true }).backgroundColor).toBe(
      LIGHT.colours.foreground,
    );
    expect(pillPaint(LIGHT.colours, false, { disabled: true }).opacity).toBe(0.5);
  });

  it('puts the chosen segment on card and leaves the rest on the track', () => {
    const { colours } = DARK;
    expect(segmentPaint(colours, true)).toEqual({
      backgroundColor: colours.card,
      color: colours.foreground,
    });
    expect(segmentPaint(colours, false)).toEqual({
      backgroundColor: 'transparent',
      color: colours.mutedForeground,
    });
  });

  it('tints the reason chip with the accent at 10 % and the other tones from tokens', () => {
    const { colours } = LIGHT;
    expect(tonePaint(colours, 'accent')).toEqual({
      backgroundColor: tint(colours.accent, 0.1),
      color: colours.accent,
    });
    expect(tonePaint(colours, 'success').color).toBe(colours.olive);
    expect(tonePaint(colours, 'muted').backgroundColor).toBe(tint(colours.muted, 1));
    for (const tokens of SCHEMES) {
      for (const tone of Object.values(TONES)) {
        expectColour(tokens, tone.ink);
        expectColour(tokens, tone.fill);
      }
    }
  });
});

describe('status pips: every colour status has a word (§4.6)', () => {
  it("gives every board status a token and the web's own word", () => {
    for (const status of BOARD_STATUSES) {
      const pip = statusPip(status);
      expect(pip.word).toBe(STATUS_CONFIG[status].label);
      expect(pip.word.trim()).not.toBe('');
      for (const tokens of SCHEMES) expectColour(tokens, pip.tokenKey);
    }
    for (const column of BOARD_COLUMNS) expect(isPipStatus(column.status)).toBe(true);
  });

  it("paints the handoff's column dots: ink, navy, warn-ink, warning, orange, olive", () => {
    expect(PIP_TOKENS.inbox).toBe('foreground');
    expect(PIP_TOKENS.assigned).toBe('info');
    expect(PIP_TOKENS.in_progress).toBe('warnInk');
    expect(PIP_TOKENS.review).toBe('warning');
    expect(PIP_TOKENS.blocked).toBe('accent');
    expect(PIP_TOKENS.done).toBe('success');
  });

  it('says Live beside the live dot', () => {
    expect(statusPip('live')).toEqual({ tokenKey: 'ccLiveDot', word: UI_COPY.live });
  });

  it("shows a status this version doesn't know muted, in its own words, never crashing", () => {
    expect(statusPip('paused_by_admin')).toEqual({
      tokenKey: 'mutedForeground',
      word: 'paused by admin',
    });
    expect(isPipStatus('toString')).toBe(false);
    expect(statusPip('toString').tokenKey).toBe('mutedForeground');
  });
});

describe('counts and plurals', () => {
  it('hides the badge at nothing and caps it at 99+', () => {
    for (const nothing of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(badgeText(nothing)).toBeNull();
    }
    expect(badgeText(1)).toBe('1');
    expect(badgeText(3.7)).toBe('3');
    expect(badgeText(99)).toBe('99');
    expect(badgeText(100)).toBe('99+');
    expect(badgeText(12, 9)).toBe('9+');
  });

  it('pluralises the English way', () => {
    const forms = { one: 'question', other: 'questions' };
    expect(pluralForm(1, forms)).toBe('question');
    expect(pluralForm(0, forms)).toBe('questions');
    expect(pluralForm(2, forms)).toBe('questions');
    expect(countPhrase(1, { one: 'agent working', other: 'agents working' })).toBe(
      '1 agent working',
    );
    expect(countPhrase(6, forms)).toBe('6 questions');
  });
});

describe('text fields', () => {
  it('rests on card with the border and no ring', () => {
    const { colours } = LIGHT;
    expect(fieldPaint(colours)).toEqual({
      backgroundColor: colours.card,
      borderColor: colours.border,
      color: colours.foreground,
      opacity: 1,
      placeholder: colours.mutedForeground,
      boxShadow: undefined,
    });
  });

  it('rings a focused field in olive, 3 pt at 18 %', () => {
    const { colours } = LIGHT;
    const focused = fieldPaint(colours, { focused: true });
    expect(focused.borderColor).toBe(colours.ring);
    expect(focused.boxShadow).toEqual([
      {
        offsetX: 0,
        offsetY: 0,
        spreadDistance: FOCUS_RING.width,
        color: tint(colours.ring, FOCUS_RING.alpha),
      },
    ]);
  });

  it('keeps an invalid field orange even when focused, and a disabled one dim and unringed', () => {
    const { colours } = DARK;
    expect(fieldPaint(colours, { focused: true, invalid: true }).borderColor).toBe(colours.accent);
    const off = fieldPaint(colours, { focused: true, disabled: true });
    expect(off.opacity).toBe(0.5);
    expect(off.boxShadow).toBeUndefined();
    expect(off.borderColor).toBe(colours.border);
  });

  it('puts the error under the field before the helper', () => {
    expect(fieldNote('Required', 'Shown to your team')).toEqual({
      text: 'Required',
      tone: 'accent',
    });
    expect(fieldNote(undefined, 'Shown to your team')).toEqual({
      text: 'Shown to your team',
      tone: 'muted',
    });
    expect(fieldNote(undefined, undefined)).toBeNull();
  });
});

describe('error states', () => {
  const KINDS = Object.keys(API_ERROR_COPY) as ApiErrorKind[];

  it("shows each kind in the taxonomy's own words", () => {
    for (const kind of KINDS) {
      const copy = errorCopy(new ApiError(kind, { status: 500 }));
      expect(copy.title).toBe(UI_COPY.errorTitle);
      expect(copy.message).toBe(API_ERROR_COPY[kind]);
    }
  });

  it('offers a retry only where one can help (not auth, forbidden or not found)', () => {
    const retryable = KINDS.filter((kind) => errorCopy(new ApiError(kind)).canRetry);
    expect(retryable.sort()).toEqual(
      ['conflict', 'invalid_response', 'network', 'server', 'stream'].sort(),
    );
  });

  it("never shows the server's internals; a conflict shows the server's own words", () => {
    const leaky = new ApiError('server', {
      status: 500,
      code: 'E_TRACE',
      serverMessage: 'Traceback at /api/v1/tasks',
    });
    expect(errorCopy(leaky).message).toBe(API_ERROR_COPY.server);
    const waitlist = new ApiError('conflict', { status: 409, serverMessage: "You're on the list" });
    expect(errorCopy(waitlist).message).toBe("You're on the list");
  });

  it('treats a non-API failure as the server copy, with a retry', () => {
    expect(errorCopy(new Error('boom'))).toEqual({
      title: UI_COPY.errorTitle,
      message: API_ERROR_COPY.server,
      canRetry: true,
    });
  });
});
