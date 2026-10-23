// The ticket sheet's route (routes.cc.ticket: /cc/ticket/{row id}), drawn as a sheet over the tab
// it was opened from (app/(app)/cc/_layout.tsx gives it SHEET_ROUTE_OPTIONS). The screen only
// wires the route's id; the sheet is src/cc/ticket/TicketSheet.tsx.
import { useLocalSearchParams } from 'expo-router';

import { taskIdParam } from '../../../../src/cc/ticket/sheet';
import { TicketSheet } from '../../../../src/cc/ticket/TicketSheet';

export default function TicketScreen() {
  return <TicketSheet taskId={taskIdParam(useLocalSearchParams())} />;
}
