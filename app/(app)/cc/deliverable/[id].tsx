// /cc/deliverable/{id}, the path PRD-001's kit names for the page: it goes on to the foundation's
// builder, routes.cc.deliverable (/cc/deliverables/{id}, KX3 "follow the builder"), so every link
// lands on the one screen; an id that is not one opens the gallery.
import { Redirect, useLocalSearchParams } from 'expo-router';

import { deliverableIdParam } from '../../../../src/cc/deliverables/detail';
import { routes } from '../../../../src/navigation/routes';

export default function DeliverableAlias() {
  const id = deliverableIdParam(useLocalSearchParams());
  return <Redirect href={id ? routes.cc.deliverable(id) : routes.cc.deliverables} />;
}
