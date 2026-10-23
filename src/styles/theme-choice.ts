// Light / Dark / System (PRD-001 §4.6, D59): the phone keeps its own choice in the encrypted MMKV
// store and starts on System. Pure over the KeyValueStorage port, so it runs in vitest; theme.tsx
// wires React, Appearance and the app's store. A stored value that is missing or unknown reads as
// System; a store that fails is logged and the choice still applies for this launch.

import { z } from 'zod';

import { logger } from '../lib/logger';
import type { KeyValueStorage } from '../storage/encrypted-storage';
import type { ColourScheme } from './tokens';

export const THEME_CHOICES = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export const DEFAULT_THEME_CHOICE: ThemeChoice = 'system';

/** The MMKV key (the query cache's sibling: automatos.query-cache). */
export const THEME_CHOICE_STORAGE_KEY = 'automatos.theme-choice';

const ThemeChoiceSchema = z.enum(THEME_CHOICES);

/** 'light' | 'dark' | null | undefined, as React Native's useColorScheme() reports it. */
export type SystemScheme = ColourScheme | null | undefined;

export function parseThemeChoice(raw: unknown): ThemeChoice {
  const parsed = ThemeChoiceSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_THEME_CHOICE;
}

/** The scheme to paint: the choice, or the phone's appearance under System (light when unknown). */
export function resolveScheme(choice: ThemeChoice, system: SystemScheme): ColourScheme {
  if (choice !== 'system') return choice;
  return system === 'dark' ? 'dark' : 'light';
}

/** What Appearance.setColorScheme takes: null hands the app back to the phone's setting. */
export function appearanceOverride(choice: ThemeChoice): ColourScheme | null {
  return choice === 'system' ? null : choice;
}

export function readThemeChoice(storage: KeyValueStorage): ThemeChoice {
  try {
    return parseThemeChoice(storage.getItem(THEME_CHOICE_STORAGE_KEY));
  } catch (error) {
    logger.warn('[theme] could not read the theme choice; using System', error);
    return DEFAULT_THEME_CHOICE;
  }
}

/** true when the choice was saved; false (logged) when the store refused it. */
export function saveThemeChoice(storage: KeyValueStorage, choice: ThemeChoice): boolean {
  try {
    storage.setItem(THEME_CHOICE_STORAGE_KEY, choice);
    return true;
  } catch (error) {
    logger.warn('[theme] could not save the theme choice; it applies until the app closes', error);
    return false;
  }
}
