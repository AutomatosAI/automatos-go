// Remove this phone on Account (KP16), wired: shown only on the hosted server, while PushRoot has
// attached the session's link and the phone holds a push record for this server and workspace, or
// owes a removal the server has not confirmed (read through the link when it is attached, keeping
// only the row's id). The yes closes the sheet, runs the session's removal once (remove-phone.ts:
// hold, DELETE, teardown, 'ask') and tells the outcome in a toast (removeAndTell: never rejects, so
// the button never stays busy), then reads the row again: gone once removed, still offered while a
// removal is owed. The words are remove-phone.ts's and strings.ts's.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useAppSession } from '../../app-state/session';
import { useToast } from '../../ui';
import { phoneLinks, type PhoneLink } from '../settings/phone-link';
import { removeAndTell, removeShown } from './remove-phone';

type Recorded = Readonly<{ link: PhoneLink; deviceId: string | null }>;

/** The attached link's device row, read when the link changes; none from an earlier link. */
function useRecordedDeviceId(link: PhoneLink | null) {
  const [recorded, setRecorded] = useState<Recorded | null>(null);
  useEffect(() => {
    if (!link) return undefined;
    let live = true;
    void link.removal.deviceId().then((deviceId) => {
      if (live) setRecorded({ link, deviceId });
    });
    return () => {
      live = false;
    };
  }, [link]);
  const reread = useCallback(async () => {
    if (!link) return;
    const deviceId = await link.removal.deviceId().catch(() => null);
    setRecorded({ link, deviceId });
  }, [link]);
  return { deviceId: recorded?.link === link ? recorded.deviceId : null, reread };
}

export function useRemovePhone() {
  const { server } = useAppSession();
  const toast = useToast();
  const link = useSyncExternalStore(phoneLinks.subscribe, phoneLinks.current, phoneLinks.current);
  const { deviceId, reread } = useRecordedDeviceId(link);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const remove = useCallback(async () => {
    setAsking(false);
    if (!link) return;
    setBusy(true);
    await removeAndTell(link.removal, toast.show);
    setBusy(false);
    await reread();
  }, [link, reread, toast]);
  return {
    shown: removeShown({ source: server.source, linked: link !== null, deviceId }),
    asking,
    busy,
    ask: () => setAsking(true),
    close: () => setAsking(false),
    remove,
  };
}
