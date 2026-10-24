import { describe, expect, it } from 'vitest';

import { SHELLS } from '../../../core/web/lib/looks/catalogue';
import { MASCOT_STATES, type MascotName } from '../../../core/web/lib/mascot/types';
import type { ThemeMascot } from '../../themes/types';
import type { BundledMascot } from '../bundled';
import {
  MASCOT_TINTED_CLIPS,
  mascotMedia,
  themeMascotMedia,
  type MascotMediaInput,
  type MascotPlatform,
  type ThemeMascotMedia,
} from '../media';
import { cssFilterToColorMatrix } from '../shell-matrix';

/** Stand-in module ids: clips 100 + i, stills 200 + i. */
const table = (base: number) =>
  Object.fromEntries(MASCOT_STATES.map((state, i) => [state, base + i])) as Record<
    MascotName,
    number
  >;
const IOS_TABLE: BundledMascot = { clips: table(100), stills: table(200) };
const ANDROID_TABLE: BundledMascot = { clips: null, stills: table(200) };
const clipOf = (state: MascotName) => 100 + MASCOT_STATES.indexOf(state);
const stillOf = (state: MascotName) => 200 + MASCOT_STATES.indexOf(state);

function input(overrides: Partial<MascotMediaInput> = {}): MascotMediaInput {
  const platform: MascotPlatform = overrides.platform ?? 'ios';
  return {
    platform,
    reduceMotion: false,
    shellFilter: SHELLS.bronze.filter,
    tintedClips: true,
    bundled: platform === 'ios' ? IOS_TABLE : ANDROID_TABLE,
    ...overrides,
  };
}

const GOLD = SHELLS.gold.filter;

describe('the bundled Auto', () => {
  it('KS11: tinted clips are on by default, one named constant', () => {
    expect(MASCOT_TINTED_CLIPS).toBe(true);
  });

  it.each(MASCOT_STATES)('iOS with motion and no tint plays %s’s clip', (state) => {
    expect(mascotMedia(input(), state)).toEqual({
      kind: 'clip',
      clip: clipOf(state),
      still: stillOf(state),
    });
  });

  it('iOS with motion and a tinted shell plays the clip through the matrix', () => {
    expect(mascotMedia(input({ shellFilter: GOLD }), 'thinking')).toEqual({
      kind: 'tinted-clip',
      clip: clipOf('thinking'),
      still: stillOf('thinking'),
      matrix: cssFilterToColorMatrix(GOLD),
    });
  });

  it('a tinted shell shows the tinted still when tinted clips are off', () => {
    expect(mascotMedia(input({ shellFilter: GOLD, tintedClips: false }), 'idle')).toEqual({
      kind: 'tinted-still',
      still: stillOf('idle'),
      matrix: cssFilterToColorMatrix(GOLD),
    });
  });

  const stillCases: [string, Partial<MascotMediaInput>][] = [
    ['Android', { platform: 'android' }],
    ['Reduce Motion on iOS', { reduceMotion: true }],
    ['Reduce Motion on Android', { platform: 'android', reduceMotion: true }],
  ];

  it.each(stillCases)('%s shows the still, tinted or not', (_, overrides) => {
    expect(mascotMedia(input(overrides), 'oops')).toEqual({
      kind: 'still',
      still: stillOf('oops'),
    });
    expect(mascotMedia(input({ ...overrides, shellFilter: GOLD }), 'oops')).toEqual({
      kind: 'tinted-still',
      still: stillOf('oops'),
      matrix: cssFilterToColorMatrix(GOLD),
    });
  });

  it('iOS without a clip in its table shows the still', () => {
    expect(mascotMedia(input({ bundled: ANDROID_TABLE }), 'idle')).toEqual({
      kind: 'still',
      still: stillOf('idle'),
    });
  });
});

const COPY = (url: string) => `file:///cache/theme-files/${url.split('/files/')[1]}`;
const themeFile = (name: string, ext: 'mp4' | 'png') =>
  `/api/themes/files/abc123/assets/mascot/${name}.${ext}`;
const THEME_CLIPS: ThemeMascot = {
  mode: 'clips',
  states: [
    { name: 'idle', clip: themeFile('idle', 'mp4'), still: themeFile('idle', 'png') },
    { name: 'thinking', clip: themeFile('thinking', 'mp4'), still: themeFile('thinking', 'png') },
    { name: 'waving', clip: themeFile('waving', 'mp4'), still: themeFile('waving', 'png') },
  ],
};

describe('an installed theme’s Auto', () => {
  const clips = themeMascotMedia(THEME_CLIPS, COPY);

  it('keeps the states the reducer shows, as local copies', () => {
    expect(Object.keys(clips.states)).toEqual(['idle', 'thinking']);
    expect(clips.states.idle).toEqual({
      clip: 'file:///cache/theme-files/abc123/assets/mascot/idle.mp4',
      still: 'file:///cache/theme-files/abc123/assets/mascot/idle.png',
    });
  });

  it('replaces the bundled files, untinted, with motion on iOS', () => {
    const media = mascotMedia(input({ theme: clips, shellFilter: GOLD }), 'idle');
    expect(media).toEqual({
      kind: 'clip',
      clip: clips.states.idle?.clip,
      still: clips.states.idle?.still,
    });
  });

  it('shows the theme’s still on Android, under Reduce Motion and in stills mode', () => {
    const still = { kind: 'still', still: clips.states.idle?.still };
    expect(mascotMedia(input({ theme: clips, platform: 'android' }), 'idle')).toEqual(still);
    expect(mascotMedia(input({ theme: clips, reduceMotion: true }), 'idle')).toEqual(still);
    const stills = themeMascotMedia({ ...THEME_CLIPS, mode: 'stills' }, COPY);
    expect(mascotMedia(input({ theme: stills }), 'idle')).toEqual(still);
  });

  it('keeps the bundled Auto for a state whose copy is not on the phone', () => {
    const cachedNothing = themeMascotMedia(THEME_CLIPS, () => null);
    expect(mascotMedia(input({ theme: cachedNothing }), 'idle')).toEqual(
      mascotMedia(input(), 'idle'),
    );
    expect(mascotMedia(input({ theme: clips }), 'oops')).toEqual(mascotMedia(input(), 'oops'));
  });

  it('a clip without its still waits for the still', () => {
    const clipOnly = themeMascotMedia(THEME_CLIPS, (url) =>
      url.endsWith('.mp4') ? COPY(url) : null,
    );
    expect(mascotMedia(input({ theme: clipOnly }), 'idle')).toEqual(mascotMedia(input(), 'idle'));
  });

  it("mode 'none' shows no mascot in any state", () => {
    const none: ThemeMascotMedia = themeMascotMedia(null, COPY);
    expect(none).toEqual({ mode: 'none', states: {} });
    for (const state of MASCOT_STATES) {
      expect(mascotMedia(input({ theme: none }), state)).toEqual({ kind: 'none' });
    }
  });

  it('no theme is the bundled Auto', () => {
    expect(mascotMedia(input({ theme: null }), 'idle')).toEqual(mascotMedia(input(), 'idle'));
  });
});
