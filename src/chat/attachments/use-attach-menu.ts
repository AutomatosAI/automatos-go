// The [+] menu's wiring (US-009b): the sheet's three choices, the camera's permission asked at the
// tap (a denial turns the sheet into how to allow it in Settings), and each picker opened once the
// sheet has gone: a system picker presented over a closing modal is dismissed with it on iOS.
// FOUNDATION GAP: src/ui/Sheet says nothing when it has finished closing (no onClosed), so the
// picker waits PICKER_AFTER_SHEET_MS: the sheet's 220 ms slide, then the modal's dismissal.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';

import { logger } from '../../lib/logger';
import { useToast } from '../../ui';
import { SHEET_DURATION_MS } from '../../ui/overlay';
import { ATTACH_COPY } from '../strings';
import { MAX_ATTACHMENTS, type PickResult, type PickedFile } from './picked';
import { askForCamera, chooseFiles, choosePhotos, takePhoto } from './pickers';

/** How long after the sheet starts closing a picker is presented: its slide and its dismissal. */
export const PICKER_AFTER_SHEET_MS = SHEET_DURATION_MS + 280;

/** What the sheet shows; it keeps showing it while it slides away. */
export type AttachMenuContent = 'choices' | 'cameraDenied';

type MenuState = { readonly visible: boolean; readonly content: AttachMenuContent };

const CLOSED: MenuState = Object.freeze({ visible: false, content: 'choices' });

export type AttachMenu = MenuState & {
  readonly open: () => void;
  readonly close: () => void;
  readonly camera: () => void;
  readonly library: () => void;
  readonly files: () => void;
  readonly openSettings: () => void;
};

/** A picker run once the sheet has gone; what it chose goes on, a failure is said. */
function usePickerAfterSheet(onPicked: (files: readonly PickedFile[]) => void) {
  const toast = useToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const run = useCallback(
    (pick: () => Promise<PickResult>) => {
      pick()
        .then(({ files, left }) => {
          if (files.length > 0) onPicked(files);
          if (left > 0) toast.show(ATTACH_COPY.full(MAX_ATTACHMENTS));
        })
        .catch((error: unknown) => {
          logger.warn('[chat] a picker did not open', error);
          toast.show(ATTACH_COPY.pickerFailed);
        });
    },
    [onPicked, toast],
  );
  return useCallback(
    (pick: () => Promise<PickResult>) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => run(pick), PICKER_AFTER_SHEET_MS);
    },
    [run],
  );
}

export function useAttachMenu(
  room: number,
  onPicked: (files: readonly PickedFile[]) => void,
): AttachMenu {
  const [menu, setMenu] = useState<MenuState>(CLOSED);
  const later = usePickerAfterSheet(onPicked);
  const close = useCallback(() => setMenu((shown) => ({ ...shown, visible: false })), []);
  const afterClose = useCallback(
    (pick: () => Promise<PickResult>) => {
      close();
      later(pick);
    },
    [close, later],
  );
  const camera = useCallback(() => {
    askForCamera()
      .catch((error: unknown) => {
        logger.warn('[chat] the camera permission was not read', error);
        return false;
      })
      .then((granted) =>
        granted ? afterClose(takePhoto) : setMenu({ visible: true, content: 'cameraDenied' }),
      );
  }, [afterClose]);
  const library = useCallback(() => afterClose(() => choosePhotos(room)), [afterClose, room]);
  const files = useCallback(() => afterClose(() => chooseFiles(room)), [afterClose, room]);
  const openSettings = useCallback(() => {
    close();
    Linking.openSettings().catch((error: unknown) => {
      logger.warn('[chat] Settings did not open', error);
    });
  }, [close]);
  const open = useCallback(() => setMenu({ visible: true, content: 'choices' }), []);
  return { ...menu, open, close, camera, library, files, openSettings };
}
