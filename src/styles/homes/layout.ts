// The homes per style (D54, US-016k), pure: which home a layout draws, and when a home shows First
// open (PRD-001 §4.7 Edges, US-017f). Every home talks to the same Auto over A2's one thread
// (src/chat/controller): Studio is A2's home as built, Play the Companion chat (Ember 01-02), HUD
// its voice-first core. An installed theme paints the Studio layout, so it has Studio's home.
//
// First open is the home before the first message: its conversation is a draft with nothing in it
// (no chat, no saved message, no turn on screen, no failure), the rule A2's menu reads for "this
// already is New chat" (src/chat/home/menu.ts menuHere). A conversation about a ticket is never
// First open: it opens with the ticket.

import type { ThreadState } from '../../chat/controller/thread';
import type { Layout } from '../registry/style-id';

export type HomeKind = 'studio' | 'play' | 'hud';

const HOME_OF: Readonly<Record<Layout, HomeKind>> = Object.freeze({
  studio: 'studio',
  play: 'play',
  hud: 'hud',
  arcade: 'studio', // ARCADE_STAND_IN US-022g
});

/** The home the resolved style's layout draws. */
export function homeFor(layout: Layout): HomeKind {
  return HOME_OF[layout];
}

type BlankDraftFacts = Pick<ThreadState, 'chatId' | 'status' | 'messages' | 'live' | 'failure'>;

/** A draft with nothing in it: no chat yet, nothing saved, no turn on screen, nothing failed. */
export function isBlankDraft(state: BlankDraftFacts): boolean {
  return (
    state.chatId === null &&
    state.status === 'idle' &&
    state.messages.length === 0 &&
    state.live === null &&
    state.failure === null
  );
}

/** First open shows on home while its conversation is a blank draft about no ticket. */
export function showsFirstOpen(state: BlankDraftFacts, ticketId: string | null = null): boolean {
  return ticketId === null && isBlankDraft(state);
}
