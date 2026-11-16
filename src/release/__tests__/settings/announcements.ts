// The announcement audit's lists (announcements.test.ts, rule 10): the speaking live regions that
// do not call useAnnounce, each by its file and component, with its reason: present from the start
// (VoiceOver reads it in order), or owed the hook. A listed region that is gone, or that now uses
// the hook, fails the audit.

import { frozen } from './types';

/** A region by '<file>#<component>', and why it stands without the hook. */
export type Listed = Readonly<{ id: string; why: string }>;

/** Regions on screen from the moment their view opens, read by VoiceOver in order. */
export const PRESENT_FROM_START: readonly Listed[] = frozen([
  {
    id: 'src/styles/arcade/home/QuestsView.tsx#Unread',
    why: 'the loading words the view opens with, until the quests replace them',
  },
  {
    id: 'src/styles/arcade/home/InventoryView.tsx#Unread',
    why: 'the loading words the view opens with, until the Deliverables replace them',
  },
]);

/** Regions that should announce and do not yet, each with why it waits. */
export const OWED: readonly Listed[] = frozen([
  {
    id: 'src/chat/history/ChatsScreen.tsx#ListFooter',
    why:
      "Load more's failure appears after a tap; the file changed in parallel, so only the " +
      'out-of-date line went in with this change',
  },
]);
