// The app's one query cache (D-CACHE): one QueryClient for the whole app (QueryRoot, at the root),
// and its persister over the encrypted MMKV store (PersistedCache, in the signed-in gate). The
// persister mounts only while someone is signed in because the saved cache belongs to that one
// person (query-client.ts cacheBuster): keyed by their id, a different person's sign-in starts a
// fresh restore that discards the other's copy. While it restores, queries wait (useIsRestoring).

import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider, type Persister } from '@tanstack/react-query-persist-client';
import { useMemo, type ReactNode } from 'react';

import { createQueryClient, createQueryPersister, persistOptions } from '../api/query-client';
import { logger } from '../lib/logger';
import { appStorage } from '../storage/mmkv';

export const appQueryClient = createQueryClient();

let persister: Persister | null = null;

/** The persister over the app's encrypted store, opened on first use. */
export function appPersister(): Persister {
  persister ??= createQueryPersister(appStorage());
  return persister;
}

function restoreFailed(): void {
  // TanStack has already removed the unreadable copy: the app starts from an empty cache
  logger.warn('[cache] the saved query cache could not be restored; starting empty');
}

export function QueryRoot({ children }: { readonly children: ReactNode }) {
  return <QueryClientProvider client={appQueryClient}>{children}</QueryClientProvider>;
}

export type PersistedCacheProps = {
  /** The signed-in person (AuthSession.ownerId). */
  readonly ownerId: string;
  readonly children: ReactNode;
};

export function PersistedCache({ ownerId, children }: PersistedCacheProps) {
  const options = useMemo(() => persistOptions(appPersister(), ownerId), [ownerId]);
  return (
    <PersistQueryClientProvider
      key={ownerId}
      client={appQueryClient}
      persistOptions={options}
      onError={restoreFailed}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
