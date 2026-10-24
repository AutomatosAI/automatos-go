// One Deliverable (routes.cc.deliverable: /cc/deliverables/{id}), under the Command Centre's shell
// over the tab it was opened from (the gallery, a ticket's Deliverables). The screen only wires the
// route's id; the page is src/cc/deliverables/DeliverableDetail.tsx. In Play it is the printed page
// (src/styles/homes/PlayDeliverable.tsx, Ember 05) over A3's same page, and the shell steps aside.
import { useLocalSearchParams } from 'expo-router';

import { DeliverableDetail } from '../../../../src/cc/deliverables/DeliverableDetail';
import { deliverableIdParam } from '../../../../src/cc/deliverables/detail';
import { PlayDeliverable } from '../../../../src/styles/homes/PlayDeliverable';
import { usePlayLayout } from '../../../../src/styles/homes/use-play-layout';

export default function DeliverableScreen() {
  const id = deliverableIdParam(useLocalSearchParams());
  return usePlayLayout() ? <PlayDeliverable id={id} /> : <DeliverableDetail id={id} />;
}
