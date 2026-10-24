// usePushSession() (US-014h): the push session of the signed-in shell, for <PushRoot session={…}/>
// in app/(app)/_layout.tsx. Only under the gate's ready session (it reads useAppSession). Rebuilt
// when the server, the paired server, the discovery document or the provider changes; PushRoot
// wires push again only when its server or push gates change (sessionKeyOf). The building is
// build-session.ts's.

import { useMemo } from 'react';

import { useAppSession } from '../../app-state/session';
import { useAuthSession } from '../../auth/AuthRoot';
import { ownServer } from '../../connect/current-server';
import { useCurrentServer } from '../../connect/use-current-server';
import type { PushSession } from '../session';
import { buildPushSession } from './build-session';

export function usePushSession(): PushSession {
  const { server, discovery } = useAppSession();
  const { provider } = useAuthSession();
  const own = ownServer(useCurrentServer());
  return useMemo(
    () => buildPushSession({ server, own, discovery, provider }),
    [server, own, discovery, provider],
  );
}
