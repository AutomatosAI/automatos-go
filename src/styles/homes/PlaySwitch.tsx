// The Play switch on the shared routes (US-017g; use-play-layout.ts decides): where the resolved
// style's layout is Play, Older chats are the Companion's Conversations (Ember 03), the Deliverables
// tab is the Shelf (Ember 04) and a Deliverable is the printed page (Ember 05), over the same history
// and the same Deliverables; in every other style, A2's and A3's screens as built. On the Shelf and
// a Deliverable the Command Centre's shell steps aside for Play (useShellStepsAside). The routes,
// app/(app)/chats.tsx and app/(app)/cc/deliverables(/[id]).tsx, only mount these (rule 4.4).

import { DeliverableDetail } from '../../cc/deliverables/DeliverableDetail';
import { DeliverablesTab } from '../../cc/deliverables/DeliverablesTab';
import { ChatsScreen } from '../../chat/history/ChatsScreen';
import { PlayConversationsScreen } from './PlayConversationsScreen';
import { PlayDeliverable } from './PlayDeliverable';
import { PlayShelf } from './PlayShelf';
import { usePlayLayout } from './use-play-layout';

/** Older chats (routes.chats, D28): Play's Conversations, else A2's list. */
export function StyleChats() {
  return usePlayLayout() ? <PlayConversationsScreen /> : <ChatsScreen />;
}

/** The Deliverables tab (routes.cc.deliverables): Play's Shelf, else A3's gallery. */
export function StyleDeliverables() {
  return usePlayLayout() ? <PlayShelf /> : <DeliverablesTab />;
}

/** One Deliverable (routes.cc.deliverable), its id the route's or null: Play's page, else A3's. */
export function StyleDeliverable({ id }: { readonly id: string | null }) {
  return usePlayLayout() ? <PlayDeliverable id={id} /> : <DeliverableDetail id={id} />;
}
