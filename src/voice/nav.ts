// The voice wave's app paths (KV17, US-019j): the voice screen, app/(app)/voice.tsx at '/voice',
// with the conversation in its query ('/voice?chat=<id>') when a chat opened it, else A2's home
// thread (KC4); and Settings → Voice, app/(app)/settings/voice.tsx at '/settings/voice'. They live
// here, not in src/navigation/routes.ts, which the foundation owns and the connect kit edits; the
// idiom is that file's and A5's src/styles/nav.ts: expo-router's typed routes stay off, so a route
// is a plain string. Every other destination is the foundation's routes or A5's look pages. Pure:
// no React, no expo-router, so vitest loads it.

import { isUsableId, type RouteParams } from '../navigation/routes';
import { STYLE_SCREENS, lookScreen, type StyleScreenPath } from '../styles/nav';
import { styleEntry } from '../styles/registry/registry';
import type { Layout } from '../styles/registry/style-id';

export const VOICE_SCREENS = Object.freeze({
  /** The voice screen, A5's HUD core in every style (D60): app/(app)/voice.tsx. */
  voice: '/voice',
  /** Settings → Voice, Auto's voice, speed and pitch: app/(app)/settings/voice.tsx. */
  settings: '/settings/voice',
} as const);

/** The query parameter the voice screen reads its conversation from. */
export const VOICE_CHAT_PARAM = 'chat';

/** The route's own options: full screen, no header (the (app) stack's are set in its layout). */
export const VOICE_ROUTE_OPTIONS = Object.freeze({ headerShown: false } as const);

/** '/voice' for the home thread, '/voice?chat=<id>' for a conversation (the id URI-encoded). */
export function voiceRoute(chatId?: string | null): string {
  const id = chatIdOf(chatId);
  if (id === null) return VOICE_SCREENS.voice;
  return `${VOICE_SCREENS.voice}?${VOICE_CHAT_PARAM}=${encodeURIComponent(id)}`;
}

export type VoiceParams = {
  /** The conversation to talk into; null for A2's home thread. */
  readonly chatId: string | null;
};

/** An id the voice screen can open (routes.chat's rule: not blank, not a dot segment), trimmed. */
function chatIdOf(value: string | null | undefined): string | null {
  const id = value?.trim();
  return id && isUsableId(id) ? id : null;
}

/**
 * The voice screen's conversation from its route params: untrusted text, kept only when it could be
 * an id. expo-router hands the query value decoded; an array (a repeated key) takes its first.
 */
export function parseVoiceParams(params: RouteParams): VoiceParams {
  const value = params[VOICE_CHAT_PARAM];
  return Object.freeze({ chatId: chatIdOf(Array.isArray(value) ? value[0] : value) });
}

/**
 * LOOK on the voice screen: the style's look page (A5's lookScreen): Play's 'Make it yours', HUD's
 * Looks drawer; Studio's look (and an installed theme's, on the Studio layout) is Light / Dark /
 * System on the style picker's Studio card.
 */
export function voiceLookPath(layout: Layout): StyleScreenPath {
  return lookScreen(styleEntry(layout).lookPage) ?? STYLE_SCREENS.settingsStyle;
}
