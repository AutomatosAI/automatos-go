// An installed theme's fonts (D58, D-FONTS): each role the painting sets (sans, serif, mono) is
// loaded with expo-font's loadAsync from its copy on the phone (files.ts) under the family
// 'theme-<installId>-<role>' (type.ts), and the Studio layout's body, title and mono faces use it
// while the theme is the style (resolve.ts). A role whose copy is not on the phone yet, or that
// fails to load, keeps Studio's face (logged). The style provider loads the cached painting's fonts
// at launch (useThemeFontLoader, no session needed: the copies are local); ThemeSync loads them
// again after it has downloaded a painting's files. Nothing is fetched from a font service.

import * as Font from 'expo-font';
import { useEffect } from 'react';
import { useStore } from 'zustand';

import { logger } from '../../lib/logger';
import type { StyleStoreApi } from '../provider/store';
import { localThemeFile } from './files';
import { THEME_FONT_ROLES, type ThemeFontRole } from './schemas';
import { themeFontFamily } from './type';
import type { LoadedThemeFonts, ThemePaint } from './types';

/** The URL each family was loaded from this launch: a family is registered once per process. */
const loadedFrom = new Map<string, string>();

async function loadRole(paint: ThemePaint, role: ThemeFontRole): Promise<string | null> {
  const url = paint.fonts?.[role];
  const copy = localThemeFile(url, 'font');
  if (!url || !copy) return null;
  const family = themeFontFamily(paint.installId, role);
  const earlier = loadedFrom.get(family);
  if (earlier !== undefined) {
    // a theme update brings a new file under the same family: it shows from the next launch
    if (earlier !== url) logger.warn(`[styles] ${family} changed; the new face shows next launch`);
    return family;
  }
  try {
    await Font.loadAsync({ [family]: copy.uri });
    loadedFrom.set(family, url);
    return family;
  } catch (error) {
    logger.warn(`[styles] ${family} could not be loaded; Studio's face stays`, error);
    return null;
  }
}

/** The families loaded for the painting's fonts (only the roles that loaded). */
export async function loadThemeFonts(paint: ThemePaint): Promise<LoadedThemeFonts> {
  const loaded = await Promise.all(THEME_FONT_ROLES.map((role) => loadRole(paint, role)));
  const families = THEME_FONT_ROLES.flatMap((role, index) => {
    const family = loaded[index];
    return family ? [[role, family] as const] : [];
  });
  return Object.freeze({
    installId: paint.installId,
    families: Object.freeze(Object.fromEntries(families)),
  });
}

/** Loads the painting's fonts and hands them to the store while that painting is still held. */
export async function applyThemeFonts(store: StyleStoreApi, paint: ThemePaint): Promise<void> {
  const fonts = await loadThemeFonts(paint);
  if (store.getState().themePaint?.installId !== paint.installId) return;
  store.getState().setThemeFonts(fonts);
}

/** The style provider's loader: the held painting's fonts, from the copies on the phone. */
export function useThemeFontLoader(store: StyleStoreApi): void {
  const paint = useStore(store, (state) => state.themePaint);
  useEffect(() => {
    if (!paint?.fonts || Object.keys(paint.fonts).length === 0) return;
    void applyThemeFonts(store, paint);
  }, [store, paint]);
}
