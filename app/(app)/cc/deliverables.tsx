// The Deliverables tab's screen (routes.cc.deliverables: /cc/deliverables), under the Command
// Centre's shell. The screen only wires; the tab is src/cc/deliverables/DeliverablesTab.tsx. In
// Play it is the Shelf (src/styles/homes/PlayShelf.tsx, Ember 04) over the same Deliverables, and
// the shell steps aside for it.
import { DeliverablesTab } from '../../../src/cc/deliverables/DeliverablesTab';
import { PlayShelf } from '../../../src/styles/homes/PlayShelf';
import { usePlayLayout } from '../../../src/styles/homes/use-play-layout';

export default function DeliverablesScreen() {
  return usePlayLayout() ? <PlayShelf /> : <DeliverablesTab />;
}
