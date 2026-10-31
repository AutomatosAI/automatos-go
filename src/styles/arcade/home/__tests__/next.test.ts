// Auto's suggestions under Arcade's status bar (next.ts; PRD-268 US-G01, D-ARC-7): the IDEAS · N
// chip is the header count's, and the NEXT line follows HudNext's order — nothing where discovery
// does not list `suggestions`, 'Started. Auto is on it.' after a Start, else the newest open one.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { suggestion } from '../../../../suggestions/__tests__/fixtures';
import { countText, suggestionView } from '../../../../suggestions/model';
import { SUGGESTION_COPY } from '../../../../suggestions/strings';
import { ARCADE_DRESS_COPY, ARCADE_HOME_COPY } from '../../../strings';
import { arcadeNext, ideasChip, nextLabel, nextWord, refusalFor } from '../next';

const NEWEST = suggestion('s-2', { title: 'Lisbon flights', created_at: '2026-10-28T09:00:00Z' });
const OLDER = suggestion('s-1');
const noop = () => undefined;

describe('the IDEAS · N chip', () => {
  it('shows the header count’s words, with its own label for VoiceOver', () => {
    const button = {
      text: countText(3) ?? '',
      label: SUGGESTION_COPY.countLabel(3),
      onPress: noop,
    };
    expect(ideasChip(button)).toEqual({
      text: 'Ideas · 3',
      label: "Auto's ideas: 3 open. Opens them all",
      onPress: noop,
    });
  });

  it('is nothing while the header count is nothing (not offered, or none open)', () => {
    expect(ideasChip(null)).toBeNull();
    expect(countText(0)).toBeNull();
  });
});

describe('the NEXT line', () => {
  it('is nothing where discovery does not list `suggestions`, even mid-Start', () => {
    expect(arcadeNext({ offered: false, open: [NEWEST], started: false })).toEqual({
      kind: 'none',
    });
    expect(arcadeNext({ offered: false, open: [NEWEST], started: true })).toEqual({
      kind: 'none',
    });
  });

  it('is nothing when none is open', () => {
    expect(arcadeNext({ offered: true, open: [], started: false })).toEqual({ kind: 'none' });
  });

  it("says 'Started. Auto is on it.' for the 4 s after a Start", () => {
    expect(arcadeNext({ offered: true, open: [NEWEST], started: true })).toEqual({
      kind: 'started',
    });
    expect(arcadeNext({ offered: true, open: [], started: true })).toEqual({ kind: 'started' });
  });

  it('shows the newest open suggestion (the list comes newest first)', () => {
    const shown = arcadeNext({ offered: true, open: [NEWEST, OLDER], started: false });
    expect(shown).toEqual({ kind: 'next', view: suggestionView(NEWEST) });
  });

  it('says ▶ NEXT, and VoiceOver hears the title, then a refused Start’s line', () => {
    expect(nextWord()).toBe(`${ARCADE_DRESS_COPY.cursor} ${ARCADE_HOME_COPY.next.word}`);
    expect(nextLabel({ title: 'Lisbon flights' }, null)).toBe('Next: Lisbon flights');
    const refused = SUGGESTION_COPY.refused.offline;
    expect(nextLabel({ title: 'Lisbon flights' }, refused)).toBe(
      `Next: Lisbon flights. ${refused}`,
    );
  });

  it('shows a refusal only under the suggestion whose Start was refused', () => {
    const refusal = { id: 's-2', text: SUGGESTION_COPY.refused.expired };
    expect(refusalFor(refusal, 's-2')).toBe(SUGGESTION_COPY.refused.expired);
    expect(refusalFor(refusal, 's-1')).toBeNull();
    expect(refusalFor(null, 's-2')).toBeNull();
  });
});

describe('next.ts', () => {
  it('imports no React, React Native, Expo or Skia (D-SHAPE)', () => {
    const source = readFileSync(path.resolve(__dirname, '..', 'next.ts'), 'utf8');
    expect(source).not.toMatch(/from '(react|react-native[^']*|expo[^']*|@shopify\/[^']*)'/);
  });
});
