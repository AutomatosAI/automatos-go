// One Deliverable (routes.cc.deliverable: /cc/deliverables/{id}), under the Command Centre's shell
// over the tab it was opened from (the gallery, a ticket's Deliverables). The screen only wires the
// route's id; the page is src/cc/deliverables/DeliverableDetail.tsx.
import { useLocalSearchParams } from 'expo-router';

import { DeliverableDetail } from '../../../../src/cc/deliverables/DeliverableDetail';
import { deliverableIdParam } from '../../../../src/cc/deliverables/detail';

export default function DeliverableScreen() {
  return <DeliverableDetail id={deliverableIdParam(useLocalSearchParams())} />;
}
