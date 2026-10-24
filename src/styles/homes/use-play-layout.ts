// The Play switch on the shared routes (US-017g): Older chats, the Deliverables and a Deliverable
// are Ember's Conversations, Shelf and printed page when the resolved style's layout is Play, and
// A2's and A3's screens as built in every other. On the Shelf and a Deliverable Play draws its own
// header and way back, so the Command Centre's shell (top bar, head, tabs) steps aside there.

import { usePathname } from 'expo-router';

import { useStyle } from '../theme';
import { homeFor } from './layout';
import { shelfOwnsScreen } from './play-shelf';

/** The resolved style draws Play's layout. */
export function usePlayLayout(): boolean {
  return homeFor(useStyle().layout) === 'play';
}

/** The Command Centre's shell steps aside: Play, on the Shelf or a Deliverable. */
export function useShellStepsAside(): boolean {
  const pathname = usePathname();
  const play = usePlayLayout();
  return play && shelfOwnsScreen(pathname);
}
