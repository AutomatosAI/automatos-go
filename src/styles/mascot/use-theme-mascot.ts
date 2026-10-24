// An installed theme's Auto on this phone (US-016i, D-MASCOT): the local copies of the state on
// screen, when the style's mascot is the theme's. The copies arrive while the theme is painted
// (themes/sync.ts watchPaintFiles) and nothing in the store says so, so each new state looks again;
// one state's two files at a time, by URL (themes/files.ts localThemeFile). A copy not on the phone
// yet keeps the bundled Auto for that state (media.ts).

import { useMemo } from 'react';

import type { MascotName } from '../../core/web/lib/mascot/types';
import { useStyleStore } from '../provider/context';
import type { ResolvedStyle } from '../provider/resolve';
import { localThemeFile } from '../themes/files';
import { themeMascotMedia, type ThemeMascotMedia } from './media';
import { themeMascotFor, themeMascotOf } from './stage';

const localMascotCopy = (url: string): string | null => localThemeFile(url, 'mascot')?.uri ?? null;

export function useThemeMascot(
  style: Pick<ResolvedStyle, 'mascot' | 'choice'>,
  showing: MascotName,
): ThemeMascotMedia | null {
  const paint = useStyleStore((state) => state.themePaint);
  const files = style.mascot === 'theme' ? themeMascotOf(style.choice, paint) : null;
  return useMemo(
    () => (files ? themeMascotMedia(themeMascotFor(files, showing), localMascotCopy) : null),
    [files, showing],
  );
}
