// How a notification's screen opens (handler.ts's navigate). With a Command Centre sheet route open
// (a ticket, a social post), a screen pushed at once would sit under the route's invisible
// full-screen modal (src/cc/use-sheet-route.ts), so the route is handed to the open sheet
// (src/cc/open-sheet.ts), which slides away, leaves its route and only then pushes it. With none
// open, the push is the router's, as before. Pure: use-notification-responses.ts passes router.push.

import { openSheets, type OpenSheetStore } from '../../cc/open-sheet';

/** Opens a route past an open sheet route: through its leaving push, else with push. */
export function navigateFor(
  push: (route: string) => void,
  sheets: Pick<OpenSheetStore, 'current'> = openSheets,
): (route: string) => void {
  return (route: string) => {
    const sheet = sheets.current();
    if (sheet) sheet.leaveFor(route);
    else push(route);
  };
}
