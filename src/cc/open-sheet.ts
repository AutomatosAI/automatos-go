// The sheet route open now (use-sheet-route.ts), for what opens a screen from outside the Command
// Centre: a notification's tap (src/push/inbound/navigate.ts). A screen pushed while a sheet route
// is presented sits under its invisible full-screen modal, so such a caller never pushes past an
// open sheet: it asks the sheet to leave for the screen, which is sheet-exit.ts's push (the sheet
// slides away, the route goes back, and only then is the screen pushed). The sheet route attaches
// its push while it is focused and detaches it on blur or unmount; a later attach wins (the next
// sheet can focus before the last one blurs), and a stale detach changes nothing. Pure: no React.

/** What the open sheet route offers: leave, then open this screen (its SheetExits.push). */
export type OpenSheet = Readonly<{ leaveFor: (href: string) => void }>;

export type OpenSheetStore = Readonly<{
  /** The sheet route focused now, or null. */
  current: () => OpenSheet | null;
  /** Attaches the sheet; the answer detaches it, if it is still the one attached. */
  attach: (sheet: OpenSheet) => () => void;
}>;

export function createOpenSheetStore(): OpenSheetStore {
  let current: OpenSheet | null = null;
  return Object.freeze({
    current: () => current,
    attach: (sheet: OpenSheet) => {
      current = sheet;
      return () => {
        if (current === sheet) current = null;
      };
    },
  });
}

/** The app's one store: the sheet routes attach, a notification's tap reads. */
export const openSheets: OpenSheetStore = createOpenSheetStore();
