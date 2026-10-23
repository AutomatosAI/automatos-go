// The thread's paint (D72, Gerard 23 Oct: "white box around me ... light grey box around us both"),
// in Studio Light and Dark: the user's box is the web's bg-primary/10 with border-primary/10,
// resolved over the page, and never again a cream or ink slab; Auto's box is a Studio card; Auto's
// avatar is the accent disc with the web's white mark. Every pair the thread draws reads (WCAG,
// measured with the vendored contrastRatio), and the two boxes differ a little.

import { describe, expect, it } from 'vitest';

import { contrastRatio, mixHex } from '../../core/web/lib/look-kit/contrast';
import { tokensFor, type ColourScheme } from '../tokens';
import { STUDIO_COLOURS, STUDIO_THREAD } from '../tokens/studio';
import { USER_TINT } from '../tokens/thread';

/** Bytes to #RRGGBB: colours are written as bytes in src (no colour literals, eslint D-TOKENS). */
function hexOf(bytes: readonly number[]): string {
  return `#${bytes.map((b) => b.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

const AA_TEXT = 4.5;
const AA_GRAPHIC = 3;
/** Under this the user's box is a soft grey, never a slab (build 7's cream was 14.68:1). */
const NEVER_A_SLAB = 1.5;
/** The two boxes differ a touch. */
const BOXES_DIFFER = 1.1;
/** A box's 1 pt edge shows on the page. */
const EDGE_SHOWS = 1.25;

const SCHEMES: readonly ColourScheme[] = ['light', 'dark'];

/** The web's composite of bg-primary/10 and border-primary/10, measured. */
const PINNED: Readonly<Record<ColourScheme, { fill: string; border: string }>> = {
  dark: { fill: hexOf([0x2f, 0x2c, 0x28]), border: hexOf([0x42, 0x3f, 0x3a]) },
  light: { fill: hexOf([0xdf, 0xd8, 0xcc]), border: hexOf([0xcb, 0xc5, 0xba]) },
};

describe.each(SCHEMES)('the thread’s paint in Studio %s', (scheme) => {
  const { colours, thread } = tokensFor('studio', scheme);

  it('paints the user’s box as the web does: primary at 10 % over the page, edge 10 % more', () => {
    expect(USER_TINT).toBe(0.1);
    expect(thread.userFill).toBe(mixHex(colours.background, colours.primary, USER_TINT));
    expect(thread.userBorder).toBe(mixHex(thread.userFill, colours.primary, USER_TINT));
    expect({ fill: thread.userFill, border: thread.userBorder }).toEqual(PINNED[scheme]);
  });

  it('never draws the user’s box as a slab of the primary (the white box around me)', () => {
    expect(thread.userFill).not.toBe(colours.primary);
    expect(contrastRatio(thread.userFill, colours.background)).toBeLessThan(NEVER_A_SLAB);
  });

  it('draws Auto’s box as a Studio card and its avatar as the accent disc with a white sail', () => {
    expect(thread.autoFill).toBe(colours.card);
    expect(thread.autoBorder).toBe(colours.border);
    expect(thread.avatar).toBe(colours.accent);
    expect(thread.sail).toBe(hexOf([0xff, 0xff, 0xff]));
    expect(thread.sail).toBe(STUDIO_COLOURS.light.onStrong);
  });

  it('keeps the two boxes a touch apart, and both edges visible on the page', () => {
    expect(contrastRatio(thread.userFill, thread.autoFill)).toBeGreaterThanOrEqual(BOXES_DIFFER);
    for (const edge of [thread.userBorder, thread.autoBorder]) {
      expect(contrastRatio(edge, colours.background)).toBeGreaterThanOrEqual(EDGE_SHOWS);
    }
  });

  it('reads: words on both boxes, the muted ink and links in Auto’s, the sail and the disc', () => {
    const textOn: readonly (readonly [string, string])[] = [
      [colours.foreground, thread.userFill],
      [colours.foreground, thread.autoFill],
      [colours.mutedForeground, thread.autoFill],
      [colours.accent, thread.autoFill],
    ];
    for (const [ink, ground] of textOn) {
      expect(contrastRatio(ink, ground), `${ink} on ${ground}`).toBeGreaterThanOrEqual(AA_TEXT);
    }
    expect(contrastRatio(thread.sail, thread.avatar)).toBeGreaterThanOrEqual(AA_GRAPHIC);
    expect(contrastRatio(thread.avatar, colours.background)).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });

  it('is frozen and the same object on every call, so memoised styles hold', () => {
    expect(Object.isFrozen(thread)).toBe(true);
    expect(tokensFor('studio', scheme).thread).toBe(thread);
    expect(thread).toBe(STUDIO_THREAD[scheme]);
  });
});
