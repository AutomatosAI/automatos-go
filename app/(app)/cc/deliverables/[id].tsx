// One Deliverable (routes.cc.deliverable: /cc/deliverables/{id}), under the Command Centre's shell
// over the tab it was opened from (the gallery, a ticket's Deliverables). The screen only wires the
// route's id; the page is src/cc/deliverables/DeliverableDetail.tsx. In Play it is the printed page
// (src/styles/homes/PlayDeliverable.tsx, Ember 05) over A3's same page, and the shell steps aside;
// the switch is src/styles/homes/PlaySwitch.tsx.
import { useLocalSearchParams } from 'expo-router';

import { deliverableIdParam } from '../../../../src/cc/deliverables/detail';
import { StyleDeliverable } from '../../../../src/styles/homes/PlaySwitch';

export default function DeliverableScreen() {
  const id = deliverableIdParam(useLocalSearchParams());
  return <StyleDeliverable id={id} />;
}
